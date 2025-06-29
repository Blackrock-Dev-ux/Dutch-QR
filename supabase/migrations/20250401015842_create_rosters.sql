-- Drop existing table if it exists
DROP TABLE IF EXISTS rosters;

-- Create rosters table with enhanced structure
CREATE TABLE IF NOT EXISTS rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id),
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  shift_pattern JSONB NOT NULL, -- Store daily shift patterns
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS rosters_employee_id_idx ON rosters(employee_id);
CREATE INDEX IF NOT EXISTS rosters_department_idx ON rosters(department);
CREATE INDEX IF NOT EXISTS rosters_status_idx ON rosters(status);
CREATE INDEX IF NOT EXISTS rosters_date_idx ON rosters(start_date, end_date);

-- Enable Row Level Security
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users" ON rosters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON rosters
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON rosters
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON rosters
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_rosters_updated_at
    BEFORE UPDATE ON rosters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE rosters IS 'Employee work roster records';
COMMENT ON COLUMN rosters.shift_pattern IS 'JSON array of daily shifts for the roster period';
