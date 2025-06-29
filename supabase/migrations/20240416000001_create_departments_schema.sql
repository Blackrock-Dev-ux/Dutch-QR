-- Create departments table if it doesn't exist
CREATE TABLE IF NOT EXISTS departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow read access to all authenticated users" ON departments;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON departments;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON departments;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON departments;
DROP POLICY IF EXISTS "Allow public read access" ON departments;
DROP POLICY IF EXISTS "Allow public insert" ON departments;

-- Create RLS policies
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users"
    ON departments
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy to allow insert access to authenticated users
CREATE POLICY "Allow insert for authenticated users"
    ON departments
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy to allow update access to authenticated users
CREATE POLICY "Allow update for authenticated users"
    ON departments
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy to allow delete access to authenticated users
CREATE POLICY "Allow delete for authenticated users"
    ON departments
    FOR DELETE
    TO authenticated
    USING (true);

-- Policy to allow public read access (needed for initial setup)
CREATE POLICY "Allow public read access"
    ON departments
    FOR SELECT
    TO anon
    USING (true);

-- Policy to allow public insert (needed for initial setup)
CREATE POLICY "Allow public insert"
    ON departments
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Insert default departments
INSERT INTO departments (name, created_at)
VALUES 
    ('Dutch Activity', NOW()),
    ('Kitchen', NOW()),
    ('Food & Beverage Department', NOW()),
    ('Butchery', NOW()),
    ('Operations', NOW()),
    ('Maintenance', NOW()),
    ('Reservations', NOW()),
    ('House Keeping', NOW()),
    ('Pastry Kitchen', NOW()),
    ('Stores', NOW()),
    ('Purchasing & Stores', NOW()),
    ('Accounts Department', NOW()),
    ('Administration', NOW()),
    ('Security Department', NOW()),
    ('Transport Section', NOW()),
    ('Human Resources', NOW())
ON CONFLICT (name) DO NOTHING;



-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
