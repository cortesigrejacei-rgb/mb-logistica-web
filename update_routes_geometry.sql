-- Add geometry column to route_summaries to persist OSRM paths
ALTER TABLE route_summaries 
ADD COLUMN IF NOT EXISTS geometry JSONB;

-- Comment for clarity
COMMENT ON COLUMN route_summaries.geometry IS 'GeoJSON LineString of the calculated route from OSRM';
