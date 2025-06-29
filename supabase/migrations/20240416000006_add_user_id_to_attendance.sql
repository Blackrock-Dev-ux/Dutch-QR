-- Add user_id column to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update RLS policies to use user_id
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON attendance;

CREATE POLICY "Enable insert access for authenticated users"
ON attendance
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update access for authenticated users"
ON attendance
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id); 