-- Resolve table-specific fields only inside the matching trigger branch.
CREATE OR REPLACE FUNCTION check_published_area() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE post_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'Opportunity' THEN post_id := COALESCE(NEW.id, OLD.id);
  ELSE post_id := COALESCE(NEW."opportunityId", OLD."opportunityId"); END IF;
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
