-- Reset RLS settings for attendance table
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON attendance;

-- Create separate policies for each operation
CREATE POLICY "Enable read access for authenticated users" ON attendance
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON attendance
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON attendance
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Re-enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON attendance TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comment to explain the policies
COMMENT ON TABLE attendance IS 'Daily attendance records with granular RLS policies';
