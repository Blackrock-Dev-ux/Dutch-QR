-- Create rosters table
CREATE TABLE IF NOT EXISTS rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('morning', 'evening', 'night', 'off')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rosters_employee_id ON rosters(employee_id);
CREATE INDEX IF NOT EXISTS idx_rosters_dates ON rosters(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON rosters;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON rosters;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON rosters;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON rosters;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
ON rosters FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON rosters FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON rosters FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users"
ON rosters FOR DELETE
TO authenticated
USING (true);

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_rosters_timestamp ON rosters;
DROP FUNCTION IF EXISTS update_rosters_updated_at();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_rosters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rosters_timestamp
    BEFORE UPDATE ON rosters
    FOR EACH ROW
    EXECUTE FUNCTION update_rosters_updated_at(); 