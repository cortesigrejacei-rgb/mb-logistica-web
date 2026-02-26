-- Add actual_distance_km to route_summaries for GPS tracking
ALTER TABLE route_summaries 
ADD COLUMN IF NOT EXISTS actual_distance_km DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN route_summaries.actual_distance_km IS 'Real distance traveled measured by mobile GPS';
