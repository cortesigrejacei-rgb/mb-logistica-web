-- MASTER FIX: Relax all potential constraints on the notifications table
-- This script catches up the schema to the code's expectations.

-- 1. description (legacy field)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE notifications ALTER COLUMN description DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN description SET DEFAULT '';

-- 2. body (new field)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body TEXT;
ALTER TABLE notifications ALTER COLUMN body DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN body SET DEFAULT '';

-- 3. type (legacy field)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE notifications ALTER COLUMN type DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN type SET DEFAULT 'info';

-- 4. title
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE notifications ALTER COLUMN title DROP NOT NULL;
ALTER TABLE notifications ALTER COLUMN title SET DEFAULT 'Nova Notificação';

-- 5. time (legacy field check)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS time TEXT; -- Just in case old schema used this
ALTER TABLE notifications ALTER COLUMN time DROP NOT NULL;

-- 6. highlight (legacy field check)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS highlight TEXT;
ALTER TABLE notifications ALTER COLUMN highlight DROP NOT NULL;

-- 7. Ensure technician_id is correct
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS technician_id TEXT;
-- We keep technician_id nullable to avoid blocking, but ideally it should be set
ALTER TABLE notifications ALTER COLUMN technician_id DROP NOT NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
