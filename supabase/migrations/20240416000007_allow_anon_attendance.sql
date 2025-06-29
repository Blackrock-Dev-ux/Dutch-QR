-- Drop existing policies first
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Service role access" ON attendance;

-- Now safe to drop the user_id column
ALTER TABLE attendance
DROP COLUMN IF EXISTS user_id;

-- Create policies that allow anonymous access
CREATE POLICY "Allow anonymous read"
ON attendance
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anonymous insert"
ON attendance
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anonymous update"
ON attendance
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON attendance TO anon;
GRANT ALL ON attendance TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated; 