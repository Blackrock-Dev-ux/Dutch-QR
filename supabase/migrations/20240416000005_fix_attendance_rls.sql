-- Disable RLS temporarily
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Service role access" ON attendance;

-- Create comprehensive RLS policies for attendance table
CREATE POLICY "Service role access"
ON attendance
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users"
ON attendance 
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON attendance
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update access for authenticated users"
ON attendance
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Grant necessary permissions
GRANT ALL ON attendance TO authenticated;
GRANT ALL ON attendance TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Re-enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY; 