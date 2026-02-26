-- Make 'type' optional and set a default value
ALTER TABLE notifications ALTER COLUMN type DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN type SET DEFAULT 'info';

-- Update existing NULLs (if any managed to get in, though unlikely with NOT NULL) to 'info'
UPDATE notifications SET type = 'info' WHERE type IS NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
