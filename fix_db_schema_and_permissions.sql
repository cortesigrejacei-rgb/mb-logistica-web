-- 1. Ensure 'state' column exists
ALTER TABLE collections ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- 2. Enable RLS but make it permissive
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- 3. Nuke existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable updates for authenticated users only" ON collections;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON collections;
DROP POLICY IF EXISTS "Enable all access for all users" ON collections;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON collections;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON collections;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON collections;

-- 4. Create ONE Master Policy for Public Access (Dev Mode)
CREATE POLICY "Enable all access for all users"
ON collections
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 5. Grant usage just in case
GRANT ALL ON TABLE collections TO postgres;
GRANT ALL ON TABLE collections TO anon;
GRANT ALL ON TABLE collections TO authenticated;
GRANT ALL ON TABLE collections TO service_role;
