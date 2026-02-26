-- Add expo_push_token to technicians table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'technicians' AND column_name = 'expo_push_token') THEN
        ALTER TABLE technicians ADD COLUMN expo_push_token TEXT;
    END IF;
END $$;
