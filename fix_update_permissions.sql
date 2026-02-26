-- Enable RLS just in case
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Drop potential conflicting policies
DROP POLICY IF EXISTS "Enable updates for authenticated users only" ON collections;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON collections;
DROP POLICY IF EXISTS "Enable all access for all users" ON collections;

-- Create a permissive update policy for ALL users (Authenticated + Anon)
-- This is crucial for local dev where session might be anon
CREATE POLICY "Enable all access for all users"
ON collections
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Drop specific policies as the one above covers everything
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON collections;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON collections;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON collections;

