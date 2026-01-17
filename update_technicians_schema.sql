-- Add monthly_goal column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'technicians' AND column_name = 'monthly_goal') THEN
        ALTER TABLE technicians ADD COLUMN monthly_goal INTEGER DEFAULT 100;
    END IF;
END $$;
