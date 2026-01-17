-- FIX UNIQUE CONSTRAINT ON ROUTE_SUMMARIES
-- The error "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- means we are trying to UPSERT based on (technician_id, date), but the database doesn't guarantee uniqueness there.

-- 1. First, we MUST clean up any existing duplicates to avoid errors when applying the constraint.
-- We keep the most recent entry (based on updated_at or id) for each tech/date pair.
DELETE FROM route_summaries a USING route_summaries b
WHERE a.id < b.id 
  AND a.technician_id = b.technician_id 
  AND a.date = b.date;

-- 2. Now we can safely add the constraint.
-- We use DROP CONSTRAINT IF EXISTS to make the script idempotent (runnable multiple times).
ALTER TABLE route_summaries DROP CONSTRAINT IF EXISTS route_summaries_tech_date_key;
ALTER TABLE route_summaries DROP CONSTRAINT IF EXISTS route_summaries_technician_id_date_key; -- specific default name check

ALTER TABLE route_summaries
ADD CONSTRAINT route_summaries_tech_date_key UNIQUE (technician_id, date);

-- 3. Verify it's done
COMMENT ON CONSTRAINT route_summaries_tech_date_key ON route_summaries IS 'Ensures one route summary per technician per day';
