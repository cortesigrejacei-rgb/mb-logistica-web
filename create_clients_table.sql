-- CREATE CLIENTS TABLE
-- Stores unique client information extracted from imported spreadsheets.

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    segment TEXT, -- from 'Segmento'
    last_order_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    
    -- Constraint to allow UPSERT (update if name exists)
    -- We assume Name is the unique identifier for a client in this context since we don't have a specific Client ID in the CSV.
    CONSTRAINT clients_name_key UNIQUE (name)
);

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policies (Open for internal tool usage)
CREATE POLICY "Enable all access for clients" ON clients FOR ALL USING (true) WITH CHECK (true);

-- Permissions
GRANT ALL ON clients TO anon;
GRANT ALL ON clients TO authenticated;
GRANT ALL ON clients TO service_role;

-- Index for fast search
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_city ON clients(city);
