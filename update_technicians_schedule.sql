-- Add work_schedule column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'technicians' AND column_name = 'work_schedule') THEN
        ALTER TABLE technicians ADD COLUMN work_schedule JSONB DEFAULT '{"sun":false, "mon":true, "tue":true, "wed":true, "thu":true, "fri":true, "sat":true}';
    END IF;
END $$;
