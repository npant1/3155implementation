-- Constraints not expressible in Prisma's schema language. Keep these in migration history.
ALTER TABLE "User" ADD CONSTRAINT user_email_normalized CHECK
  (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
ALTER TABLE "ProfessorProfile" ADD CONSTRAINT professor_profile_fields CHECK
  (length(btrim("displayName")) > 0 AND version >= 1
   AND cardinality("researchAreas") <= 20
   AND ("contactEmail" IS NULL OR "contactEmail" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
   AND ("virtualOfficeUrl" IS NULL OR "virtualOfficeUrl" LIKE 'https://%'));
ALTER TABLE "StudentProfile" ADD CONSTRAINT student_profile_fields CHECK
  (length(btrim("displayName")) > 0 AND length(btrim(major)) > 0 AND version >= 1
   AND year IN ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Other'));
ALTER TABLE "FileAsset" ADD CONSTRAINT valid_file_metadata CHECK
  ("sizeBytes" > 0 AND length(btrim("originalName")) > 0 AND length(btrim("storageKey")) > 0
   AND "storageKey" NOT LIKE '%://%' AND "storageKey" !~ '(^|/)\.\.(/|$)'
   AND ((purpose = 'PHOTO' AND "sizeBytes" <= 2097152 AND "mediaType" IN ('image/png', 'image/jpeg', 'image/webp'))
     OR (purpose = 'RESUME' AND "sizeBytes" <= 5242880 AND "mediaType" IN
       ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))));
ALTER TABLE "Opportunity" ADD CONSTRAINT opportunity_fields CHECK
  (length(btrim(title)) > 0 AND length(description) <= 20000
   AND (("hoursMin" IS NULL AND "hoursMax" IS NULL) OR
     ("hoursMin" IS NOT NULL AND "hoursMax" IS NOT NULL AND "hoursMin" BETWEEN 1 AND 168 AND "hoursMax" BETWEEN "hoursMin" AND 168))
   AND (status <> 'PUBLISHED' OR (length(btrim(description)) > 0 AND length(btrim(duration)) > 0
     AND duration IS NOT NULL AND "hoursMin" IS NOT NULL AND "hoursMax" IS NOT NULL
     AND deadline IS NOT NULL AND "publishedAt" IS NOT NULL
     AND cardinality(responsibilities) > 0 AND cardinality(goals) > 0 AND cardinality(prerequisites) > 0)));
ALTER TABLE "Application" ADD CONSTRAINT application_decision_fields CHECK
  ((status = 'PENDING' AND "decidedById" IS NULL AND "decidedAt" IS NULL AND "denialReason" IS NULL)
   OR (status = 'ACCEPTED' AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND "denialReason" IS NULL)
   OR (status = 'DECLINED' AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL AND "denialReason" IS NOT NULL AND length(btrim("denialReason")) > 0));
ALTER TABLE "Message" ADD CONSTRAINT nonempty_message CHECK (length(btrim(body)) > 0);
ALTER TABLE "ResearchArea" ADD CONSTRAINT nonempty_research_area CHECK (length(btrim(name)) > 0);
CREATE UNIQUE INDEX research_area_case_insensitive ON "ResearchArea" (lower(btrim(name)));

CREATE FUNCTION check_profile_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected "UserRole";
BEGIN
  expected := CASE WHEN TG_TABLE_NAME = 'ProfessorProfile' THEN 'PROFESSOR'::"UserRole" ELSE 'STUDENT'::"UserRole" END;
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = NEW."userId" AND role = expected) THEN
    RAISE EXCEPTION 'Profile owner has the wrong role' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."userId" <> OLD."userId" OR NEW.version <> OLD.version + 1) THEN
    RAISE EXCEPTION 'Profile owner is immutable and version must increment by one' USING ERRCODE = '23514';
  END IF;
  IF NEW."photoId" IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM "FileAsset" WHERE id = NEW."photoId" AND "ownerId" = NEW."userId" AND purpose = 'PHOTO') THEN
    RAISE EXCEPTION 'Photo must belong to the profile owner and have purpose PHOTO' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'StudentProfile' THEN
    IF NEW."resumeId" IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM "FileAsset" WHERE id = NEW."resumeId" AND "ownerId" = NEW."userId" AND purpose = 'RESUME') THEN
      RAISE EXCEPTION 'Resume must belong to the student and have purpose RESUME' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER professor_owner BEFORE INSERT OR UPDATE ON "ProfessorProfile" FOR EACH ROW EXECUTE FUNCTION check_profile_owner();
CREATE TRIGGER student_owner BEFORE INSERT OR UPDATE ON "StudentProfile" FOR EACH ROW EXECUTE FUNCTION check_profile_owner();

CREATE FUNCTION check_user_role_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role <> OLD.role AND (EXISTS (SELECT 1 FROM "ProfessorProfile" WHERE "userId" = OLD.id)
    OR EXISTS (SELECT 1 FROM "StudentProfile" WHERE "userId" = OLD.id)) THEN
    RAISE EXCEPTION 'Cannot change role while a profile exists' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_role_change BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION check_user_role_change();

CREATE FUNCTION check_file_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'File metadata is immutable; register a replacement object' USING ERRCODE = '23514';
  END IF;
  IF NEW.purpose = 'RESUME' AND NOT EXISTS (SELECT 1 FROM "User" WHERE id = NEW."ownerId" AND role = 'STUDENT') THEN
    RAISE EXCEPTION 'Resume owner must be a student' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER file_metadata BEFORE INSERT OR UPDATE ON "FileAsset" FOR EACH ROW EXECUTE FUNCTION check_file_metadata();

CREATE FUNCTION check_opportunity_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."professorId" <> OLD."professorId" THEN
    RAISE EXCEPTION 'Opportunity ownership is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'PUBLISHED' AND (TG_OP = 'INSERT' OR OLD.status <> 'PUBLISHED') AND NEW.deadline <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Publishing requires a future deadline' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_change BEFORE INSERT OR UPDATE ON "Opportunity" FOR EACH ROW EXECUTE FUNCTION check_opportunity_change();

-- Deferred validation permits post and area links to be inserted in one transaction.
CREATE FUNCTION check_published_area() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE post_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'Opportunity' THEN post_id := COALESCE(NEW.id, OLD.id);
  ELSE post_id := COALESCE(NEW."opportunityId", OLD."opportunityId"); END IF;
  IF EXISTS (SELECT 1 FROM "Opportunity" WHERE id = post_id AND status = 'PUBLISHED') AND NOT EXISTS
    (SELECT 1 FROM "OpportunityResearchArea" WHERE "opportunityId" = post_id) THEN
    RAISE EXCEPTION 'Published opportunity requires a research area' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'OpportunityResearchArea' AND TG_OP = 'UPDATE' AND OLD."opportunityId" <> NEW."opportunityId" THEN
    IF EXISTS (SELECT 1 FROM "Opportunity" WHERE id = OLD."opportunityId" AND status = 'PUBLISHED') AND NOT EXISTS
      (SELECT 1 FROM "OpportunityResearchArea" WHERE "opportunityId" = OLD."opportunityId") THEN
      RAISE EXCEPTION 'Published opportunity requires a research area' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER published_post_area AFTER INSERT OR UPDATE ON "Opportunity" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_published_area();
CREATE CONSTRAINT TRIGGER linked_post_area AFTER INSERT OR UPDATE OR DELETE ON "OpportunityResearchArea" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_published_area();

CREATE FUNCTION check_application() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE post "Opportunity"%ROWTYPE;
BEGIN
  SELECT * INTO post FROM "Opportunity" WHERE id = NEW."opportunityId" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Opportunity not found' USING ERRCODE = '23503'; END IF;
  IF TG_OP = 'INSERT' AND (post.status <> 'PUBLISHED' OR post.deadline IS NULL OR post.deadline <= CURRENT_TIMESTAMP OR NEW.status <> 'PENDING') THEN
    RAISE EXCEPTION 'Applications require an open published opportunity and start pending' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW."studentId" <> OLD."studentId" OR NEW."opportunityId" <> OLD."opportunityId" OR NEW."resumeFileId" IS DISTINCT FROM OLD."resumeFileId" OR OLD.status <> 'PENDING' OR NEW.status = 'PENDING') THEN
    RAISE EXCEPTION 'Application identity and submitted resume are immutable; only pending decisions may change' USING ERRCODE = '23514';
  END IF;
  IF NEW.status <> 'PENDING' AND NEW."decidedById" <> post."professorId" THEN
    RAISE EXCEPTION 'Only the posting professor may decide an application' USING ERRCODE = '23514';
  END IF;
  IF NEW."resumeFileId" IS NOT NULL AND NOT EXISTS
    (SELECT 1 FROM "FileAsset" WHERE id = NEW."resumeFileId" AND "ownerId" = NEW."studentId" AND purpose = 'RESUME') THEN
    RAISE EXCEPTION 'Application must reference the student resume' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER application_rules BEFORE INSERT OR UPDATE ON "Application" FOR EACH ROW EXECUTE FUNCTION check_application();

CREATE FUNCTION check_message_sender() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Conversation" WHERE id = NEW."conversationId"
    AND ("studentId" = NEW."senderId" OR "professorId" = NEW."senderId")) THEN
    RAISE EXCEPTION 'Sender is not a conversation participant' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'Message history is immutable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER message_sender BEFORE INSERT OR UPDATE ON "Message" FOR EACH ROW EXECUTE FUNCTION check_message_sender();
CREATE FUNCTION immutable_conversation_pair() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."studentId" <> OLD."studentId" OR NEW."professorId" <> OLD."professorId" THEN
    RAISE EXCEPTION 'Conversation participants are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conversation_pair BEFORE UPDATE ON "Conversation" FOR EACH ROW EXECUTE FUNCTION immutable_conversation_pair();
