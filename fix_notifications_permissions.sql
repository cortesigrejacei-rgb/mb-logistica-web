-- Ensure table exists
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Force enable RLS (good practice)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON notifications;
DROP POLICY IF EXISTS "Enable insert for all users" ON notifications;
DROP POLICY IF EXISTS "Enable update for all users" ON notifications;
DROP POLICY IF EXISTS "Technicians can read own notifications" ON notifications;

-- Create permissive policies for Web Panel and Mobile App
-- 1. Allow ANYONE to insert (Web Panel needs this if not Auth ID matches)
CREATE POLICY "Enable insert for all users" ON notifications FOR INSERT WITH CHECK (true);

-- 2. Allow ANYONE to read (Mobile App needs this)
CREATE POLICY "Enable read access for all users" ON notifications FOR SELECT USING (true);

-- 3. Allow ANYONE to update (Mark as read)
CREATE POLICY "Enable update for all users" ON notifications FOR UPDATE USING (true);

-- Grant permissions to public (anon) and authenticated roles
GRANT ALL ON TABLE notifications TO anon;
GRANT ALL ON TABLE notifications TO authenticated;
GRANT ALL ON TABLE notifications TO service_role;
