-- Add overtime column to attendance table
DO $$
BEGIN
    -- Check if column already exists to prevent errors
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='attendance' AND column_name='overtime'
    ) THEN
        -- Add the column with a default value of 0
        ALTER TABLE attendance 
        ADD COLUMN overtime NUMERIC(10,2) NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add a comment to explain the column
COMMENT ON COLUMN attendance.overtime IS 
'Number of additional hours worked beyond standard work hours';

-- Optional: Add a constraint to ensure overtime is non-negative
DO $$
BEGIN
    -- Drop existing constraint if it exists
    BEGIN
        ALTER TABLE attendance 
        DROP CONSTRAINT IF EXISTS check_overtime;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop check_overtime constraint';
    END;

    -- Add constraint to ensure non-negative overtime
    ALTER TABLE attendance 
    ADD CONSTRAINT check_overtime CHECK (overtime >= 0);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not add check_overtime constraint';
END $$; 