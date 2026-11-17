-- Match Prisma array defaults and reject NULL or malformed list items in direct SQL.
ALTER TABLE "ProfessorProfile" ALTER COLUMN "researchAreas" SET DEFAULT ARRAY[]::text[];
ALTER TABLE "ProfessorProfile" ALTER COLUMN "researchAreas" SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN responsibilities SET DEFAULT ARRAY[]::text[];
ALTER TABLE "Opportunity" ALTER COLUMN responsibilities SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN goals SET DEFAULT ARRAY[]::text[];
ALTER TABLE "Opportunity" ALTER COLUMN goals SET NOT NULL;
ALTER TABLE "Opportunity" ALTER COLUMN prerequisites SET DEFAULT ARRAY[]::text[];
ALTER TABLE "Opportunity" ALTER COLUMN prerequisites SET NOT NULL;
CREATE FUNCTION valid_text_list(vals text[], max_items integer, max_length integer) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
 SELECT vals IS NOT NULL AND cardinality(vals) <= max_items AND NOT EXISTS
 (SELECT 1 FROM unnest(vals) AS v WHERE v IS NULL OR length(btrim(v)) = 0 OR length(v) > max_length)
$$;
CREATE FUNCTION unique_text_list(vals text[]) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT cardinality(vals) = (SELECT count(DISTINCT lower(btrim(v))) FROM unnest(vals) AS v)
$$;
ALTER TABLE "ProfessorProfile" ADD CONSTRAINT valid_profile_areas CHECK
 (valid_text_list("researchAreas", 20, 100) AND unique_text_list("researchAreas"));
ALTER TABLE "Opportunity" ADD CONSTRAINT valid_opportunity_lists CHECK
 (valid_text_list(responsibilities, 50, 1000) AND valid_text_list(goals, 50, 1000) AND valid_text_list(prerequisites, 50, 1000));
-- Serialize role/profile creation and last-area removal/publication races.
CREATE OR REPLACE FUNCTION check_profile_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected "UserRole"; actual "UserRole";
BEGIN
  expected := CASE WHEN TG_TABLE_NAME = 'ProfessorProfile' THEN 'PROFESSOR'::"UserRole" ELSE 'STUDENT'::"UserRole" END;
  SELECT role INTO actual FROM "User" WHERE id = NEW."userId" FOR UPDATE;
  IF actual IS DISTINCT FROM expected THEN
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
CREATE OR REPLACE FUNCTION check_published_area() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE post_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'Opportunity' THEN post_id := COALESCE(NEW.id, OLD.id);
  ELSE post_id := COALESCE(NEW."opportunityId", OLD."opportunityId"); END IF;
  PERFORM 1 FROM "Opportunity" WHERE id = post_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "Opportunity" WHERE id = post_id AND status = 'PUBLISHED') AND NOT EXISTS
    (SELECT 1 FROM "OpportunityResearchArea" WHERE "opportunityId" = post_id) THEN
    RAISE EXCEPTION 'Published opportunity requires a research area' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'OpportunityResearchArea' THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD."opportunityId" <> NEW."opportunityId" THEN
    IF EXISTS (SELECT 1 FROM "Opportunity" WHERE id = OLD."opportunityId" AND status = 'PUBLISHED') AND NOT EXISTS
      (SELECT 1 FROM "OpportunityResearchArea" WHERE "opportunityId" = OLD."opportunityId") THEN
      RAISE EXCEPTION 'Published opportunity requires a research area' USING ERRCODE = '23514';
    END IF;
  END IF;
      END IF;
    END IF;
  RETURN NULL;
END $$;
