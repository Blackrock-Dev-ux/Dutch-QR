-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON attendance;

-- Create a new policy that allows authenticated users to delete attendance records
CREATE POLICY "Enable delete access for authenticated users"
ON attendance
FOR DELETE
TO authenticated
USING (true);

-- Ensure RLS is enabled
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY; 