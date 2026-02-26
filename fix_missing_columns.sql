-- FIX MISSING COLUMNS IN ROUTE_SUMMARIES
-- The error "Could not find the 'total_duration_seconds' column" confirms that the table exists
-- but uses an OLD schema version (likely created before this column was added).

-- 1. Add 'total_duration_seconds' safely
ALTER TABLE route_summaries 
ADD COLUMN IF NOT EXISTS total_duration_seconds INTEGER;

-- 2. Ensure other potentially new columns exist as well (just to be safe)
ALTER TABLE route_summaries 
ADD COLUMN IF NOT EXISTS collection_count INTEGER;

ALTER TABLE route_summaries 
ADD COLUMN IF NOT EXISTS estimated_fuel_cost DECIMAL(10, 2);

ALTER TABLE route_summaries 
ADD COLUMN IF NOT EXISTS status TEXT;

ALTER TABLE route_summaries 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Force PostgREST schema cache reload (Implicitly happens on DDL, but good to know)
COMMENT ON TABLE route_summaries IS 'Cache for storing calculated route distances and costs per technician/date';
