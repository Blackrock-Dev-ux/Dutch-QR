-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON rosters;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON rosters;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON rosters;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON rosters;
DROP POLICY IF EXISTS "Allow anonymous access" ON rosters;

-- Enable Row Level Security
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;

-- Create policies for both anonymous and authenticated users
CREATE POLICY "Allow anonymous access"
ON rosters
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON rosters TO anon;
GRANT ALL ON rosters TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated; 