-- Add early_departure column to attendance table
DO $$
BEGIN
    -- Check if column already exists to prevent errors
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='attendance' AND column_name='early_departure'
    ) THEN
        -- Add the column with a default value of false
        ALTER TABLE attendance 
        ADD COLUMN early_departure BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Optional: Add a comment to explain the column
COMMENT ON COLUMN attendance.early_departure IS 
'Indicates whether the employee left work before the standard end of the workday'; 