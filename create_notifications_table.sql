-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id TEXT NOT NULL, -- References technician (using string ID as per current schema)
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for faster queries by technician
CREATE INDEX IF NOT EXISTS idx_notifications_technician_id ON notifications(technician_id);

-- Enable RLS (optional, for safety, but open for logic for now if using admin key or general access)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Technicians can read their own notifications
CREATE POLICY "Technicians can read own notifications" ON notifications
    FOR SELECT
    USING (technician_id = auth.uid()::text OR technician_id = current_setting('request.jwt.claim.sub', true)); -- Adjust based on how tech IDs map to auth, currently they might not match exactly if IDs are custom '#TEC-'.
    -- The current system uses custom ID strings like #TEC-1234. These don't match Auth UIDs. 
    -- Since we use specific "technician_id" column, we just need to ensure the query filters by it.
    -- For now, allow public/authenticated read if RLS is tricky with custom IDs without a mapping table.
    -- Better simple policy for this prototype phase: allow all authenticated to read, app logic filters.

CREATE POLICY "Enable read access for all users" ON notifications FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON notifications FOR UPDATE USING (true);
