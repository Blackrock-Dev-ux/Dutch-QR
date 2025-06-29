-- Ensure date column is correctly populated
DO $$
DECLARE
    v_current_timestamp TIMESTAMPTZ := NOW();
BEGIN
    -- Add date column if not exists
    ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS date DATE;

    -- Populate date column with the date of check_in_time
    UPDATE attendance 
    SET date = DATE(check_in_time)
    WHERE date IS NULL;

    -- Remove any existing default constraint
    ALTER TABLE attendance 
    ALTER COLUMN date DROP DEFAULT;

    -- Add a not-null constraint
    ALTER TABLE attendance 
    ALTER COLUMN date SET NOT NULL;

    -- Add an index for performance
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

    -- Add a comment for documentation
    COMMENT ON COLUMN attendance.date IS 'Date of the attendance record, derived from check_in_time';
END $$;

-- Create a function to automatically set the date from check_in_time
CREATE OR REPLACE FUNCTION set_attendance_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the date to the date of check_in_time
    NEW.date = DATE(NEW.check_in_time);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically set the date before insert or update
CREATE TRIGGER attendance_date_trigger
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION set_attendance_date();

-- Validate date column
ALTER TABLE attendance 
ADD CONSTRAINT check_valid_date 
CHECK (
    date IS NOT NULL AND 
    date = DATE(check_in_time)
); 