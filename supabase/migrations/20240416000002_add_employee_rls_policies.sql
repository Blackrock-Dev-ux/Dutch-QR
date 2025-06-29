-- Enable RLS on employees table
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy to allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users"
    ON employees
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy to allow insert access to authenticated users
CREATE POLICY "Allow insert for authenticated users"
    ON employees
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy to allow update access to authenticated users
CREATE POLICY "Allow update for authenticated users"
    ON employees
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy to allow delete access to authenticated users
CREATE POLICY "Allow delete for authenticated users"
    ON employees
    FOR DELETE
    TO authenticated
    USING (true);

-- Policy to allow public read access (needed for initial setup)
CREATE POLICY "Allow public read access"
    ON employees
    FOR SELECT
    TO anon
    USING (true);

-- Policy to allow public insert (needed for initial setup)
CREATE POLICY "Allow public insert"
    ON employees
    FOR INSERT
    TO anon
    WITH CHECK (true);
