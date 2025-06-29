-- Fix department column in rosters table
DO $$
BEGIN
    -- First ensure department_id exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rosters'
        AND column_name = 'department_id'
    ) THEN
        ALTER TABLE rosters ADD COLUMN department_id UUID REFERENCES departments(id);
    END IF;

    -- Create index for department_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 'rosters'
        AND indexname = 'idx_rosters_department_id'
    ) THEN
        CREATE INDEX idx_rosters_department_id ON rosters(department_id);
    END IF;

    -- Add comment for documentation
    COMMENT ON COLUMN rosters.department_id IS 'Reference to the department this roster belongs to';
END $$; 