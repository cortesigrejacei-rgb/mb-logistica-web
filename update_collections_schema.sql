-- Add columns to collections to track history and link to clients

-- Link to clients table
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- History and Metadata fields from CSV
ALTER TABLE collections 
ADD COLUMN IF NOT EXISTS tech_notes TEXT, -- 'OBS Técnico'
ADD COLUMN IF NOT EXISTS occurrence_date DATE, -- 'Data ocorrencia'
ADD COLUMN IF NOT EXISTS contract_status TEXT, -- 'Status Contrato'
ADD COLUMN IF NOT EXISTS service_type TEXT, -- 'Serviço'
ADD COLUMN IF NOT EXISTS contract_id TEXT, -- 'Contrato'
ADD COLUMN IF NOT EXISTS original_tech_name TEXT; -- 'Técnico' (Raw name from CSV for record)

-- Index for faster history lookups by client
CREATE INDEX IF NOT EXISTS idx_collections_client_id ON collections(client_id);
