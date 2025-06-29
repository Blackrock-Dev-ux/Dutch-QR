-- Add working_duration column to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS working_duration VARCHAR(50) DEFAULT '0h 00m';

-- Create function to calculate working duration
CREATE OR REPLACE FUNCTION calculate_working_duration()
RETURNS TRIGGER AS $$
DECLARE
    total_minutes INTEGER := 0;
    first_session INTEGER := 0;
    second_session INTEGER := 0;
    break_mins INTEGER := 0;
BEGIN
    -- Calculate first session
    IF NEW.first_check_in_time IS NOT NULL THEN
        IF NEW.first_check_out_time IS NOT NULL THEN
            first_session := EXTRACT(EPOCH FROM (NEW.first_check_out_time - NEW.first_check_in_time))/60;
        ELSIF NEW.status != 'CHECKED_OUT' THEN
            first_session := EXTRACT(EPOCH FROM (NOW() - NEW.first_check_in_time))/60;
        END IF;
    END IF;

    -- Calculate second session
    IF NEW.second_check_in_time IS NOT NULL THEN
        IF NEW.second_check_out_time IS NOT NULL THEN
            second_session := EXTRACT(EPOCH FROM (NEW.second_check_out_time - NEW.second_check_in_time))/60;
        ELSIF NEW.status != 'CHECKED_OUT' THEN
            second_session := EXTRACT(EPOCH FROM (NOW() - NEW.second_check_in_time))/60;
        END IF;
    END IF;

    -- Calculate total minutes
    total_minutes := GREATEST(0, first_session + second_session);

    -- Format the working duration
    NEW.working_duration := 
        CONCAT(
            FLOOR(total_minutes/60)::TEXT, 
            'h ',
            LPAD(MOD(total_minutes, 60)::TEXT, 2, '0'),
            'm'
        );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update working_duration
DROP TRIGGER IF EXISTS update_working_duration ON attendance;
CREATE TRIGGER update_working_duration
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_working_duration();

-- Add a comment for documentation
COMMENT ON COLUMN attendance.working_duration IS 'Total working time in hours and minutes format (e.g., "8h 30m")';

-- Update existing records
UPDATE attendance 
SET working_duration = working_duration 
WHERE id IS NOT NULL;

-- First, drop the existing constraint if it exists
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS check_working_duration;

-- Update any NULL values to the default format
UPDATE attendance 
SET working_duration = '0h 0m' 
WHERE working_duration IS NULL;

-- Update any numeric-only values to the new format
UPDATE attendance 
SET working_duration = working_duration || 'h 0m'
WHERE working_duration ~ '^[0-9]+(\.[0-9]+)?$';

-- Update any other invalid formats to default
UPDATE attendance 
SET working_duration = '0h 0m'
WHERE working_duration !~ '^[0-9]+h [0-9]+m$';

-- Now add the check constraint after data is cleaned
ALTER TABLE attendance
ADD CONSTRAINT check_working_duration 
CHECK (
    working_duration ~ '^[0-9]+h [0-9]+m$' OR 
    working_duration = '0h 0m'
);

-- Add an index for performance optimization
DROP INDEX IF EXISTS idx_attendance_working_duration;
CREATE INDEX idx_attendance_working_duration ON attendance(working_duration); 