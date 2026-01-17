-- Force add the 'body' column if it is missing
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';

-- Ensure other columns exist just in case
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Notificação';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS technician_id TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Force a schema cache reload (PostgREST)
NOTIFY pgrst, 'reload schema';
