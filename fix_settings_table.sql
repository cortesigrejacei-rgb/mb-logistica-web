-- Create settings table if not exists (this part works, skips if exists)
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB
);

-- Ensure columns exist (in case table existed but with different schema)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS value JSONB;

-- Add unique constraint if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'settings_key_key') THEN 
        ALTER TABLE settings ADD CONSTRAINT settings_key_key UNIQUE (key);
    END IF; 
END $$;

-- RLS for Settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON settings;
CREATE POLICY "Enable read access for all users" ON settings FOR SELECT TO authenticated USING (true);


-- Insert default settings if empty
INSERT INTO settings (key, value)
VALUES ('app_config', '{"theme": "dark"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
