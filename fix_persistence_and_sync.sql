-- 1. Create route_summaries if it doesn't exist
CREATE TABLE IF NOT EXISTS route_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID REFERENCES technicians(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_distance_km DECIMAL(10, 2),
    total_duration_seconds INTEGER,
    estimated_fuel_cost DECIMAL(10, 2),
    collection_count INTEGER,
    status TEXT, -- 'Calculated', 'Calculated (Map)', etc.
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(technician_id, date)
);

-- 2. Enable RLS on route_summaries
ALTER TABLE route_summaries ENABLE ROW LEVEL SECURITY;

-- 3. Create Policy for route_summaries (Allow everything for now to fix issues)
DROP POLICY IF EXISTS "Enable all access for route_summaries" ON route_summaries;

CREATE POLICY "Enable all access for route_summaries"
ON route_summaries
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Grant permissions
GRANT ALL ON route_summaries TO anon;
GRANT ALL ON route_summaries TO authenticated;
GRANT ALL ON route_summaries TO service_role;

-- 5. Helper: Fix Collections Permissions again (Just in case)
DROP POLICY IF EXISTS "Enable all access for collections" ON collections;

CREATE POLICY "Enable all access for collections"
ON collections
FOR ALL
USING (true)
WITH CHECK (true);

-- 6. Ensure Lat/Lng are writable (Implicit in ALL, but good to check triggers)
-- Disable any triggers that might be reverting changes (unlikely but possible)
-- (No triggers known)

-- 7. Add index for performance on route_summaries
CREATE INDEX IF NOT EXISTS idx_route_summaries_tech_date ON route_summaries(technician_id, date);
