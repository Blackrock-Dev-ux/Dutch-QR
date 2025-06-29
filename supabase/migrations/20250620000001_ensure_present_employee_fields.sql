-- Migration to ensure all fields needed for Present Employee feature exist
-- This migration is idempotent and safe to run multiple times

-- Add extended attendance fields if they don't exist
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS first_check_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_check_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS second_check_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS second_check_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS working_duration_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS late_minutes INTEGER DEFAULT 0;

-- Create index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Create or replace function to calculate working duration
CREATE OR REPLACE FUNCTION calculate_working_duration(
    p_first_check_in TIMESTAMPTZ,
    p_first_check_out TIMESTAMPTZ,
    p_second_check_in TIMESTAMPTZ,
    p_second_check_out TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    first_session_minutes INTEGER := 0;
    second_session_minutes INTEGER := 0;
    total_minutes INTEGER := 0;
BEGIN
    -- Calculate first session duration
    IF p_first_check_in IS NOT NULL THEN
        IF p_first_check_out IS NOT NULL THEN
            first_session_minutes := EXTRACT(EPOCH FROM (p_first_check_out - p_first_check_in))/60;
        ELSE
            -- Still in first session
            first_session_minutes := EXTRACT(EPOCH FROM (NOW() - p_first_check_in))/60;
        END IF;
    END IF;

    -- Calculate second session duration
    IF p_second_check_in IS NOT NULL THEN
        IF p_second_check_out IS NOT NULL THEN
            second_session_minutes := EXTRACT(EPOCH FROM (p_second_check_out - p_second_check_in))/60;
        ELSE
            -- Still in second session
            second_session_minutes := EXTRACT(EPOCH FROM (NOW() - p_second_check_in))/60;
        END IF;
    END IF;

    total_minutes := first_session_minutes + second_session_minutes;
    RETURN GREATEST(total_minutes, 0);
END;
$$;

-- Create or replace function to calculate break duration
CREATE OR REPLACE FUNCTION calculate_break_duration(
    p_first_check_out TIMESTAMPTZ,
    p_second_check_in TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    break_minutes INTEGER := 0;
BEGIN
    IF p_first_check_out IS NOT NULL AND p_second_check_in IS NOT NULL THEN
        break_minutes := EXTRACT(EPOCH FROM (p_second_check_in - p_first_check_out))/60;
    END IF;
    
    RETURN GREATEST(break_minutes, 0);
END;
$$;

-- Create or replace function to calculate late minutes
CREATE OR REPLACE FUNCTION calculate_late_minutes(
    p_date DATE,
    p_first_check_in TIMESTAMPTZ,
    p_expected_start_time TIME DEFAULT '09:00:00'
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    expected_start TIMESTAMPTZ;
    late_minutes INTEGER := 0;
BEGIN
    -- Create expected start timestamp for the date
    expected_start := p_date + p_expected_start_time;
    
    IF p_first_check_in IS NOT NULL AND p_first_check_in > expected_start THEN
        late_minutes := EXTRACT(EPOCH FROM (p_first_check_in - expected_start))/60;
    END IF;
    
    RETURN GREATEST(late_minutes, 0);
END;
$$;

-- Create trigger to automatically update calculated fields
CREATE OR REPLACE FUNCTION update_attendance_calculations()
RETURNS TRIGGER AS $$
BEGIN
    -- Update working duration
    NEW.working_duration_minutes := calculate_working_duration(
        NEW.first_check_in_time,
        NEW.first_check_out_time,
        NEW.second_check_in_time,
        NEW.second_check_out_time
    );
    
    -- Update break duration
    NEW.break_duration_minutes := calculate_break_duration(
        NEW.first_check_out_time,
        NEW.second_check_in_time
    );
    
    -- Update late minutes
    NEW.late_minutes := calculate_late_minutes(
        NEW.date,
        COALESCE(NEW.first_check_in_time, NEW.check_in_time)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS attendance_calculations_trigger ON attendance;
CREATE TRIGGER attendance_calculations_trigger
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_calculations();

-- Add comments to document the new fields
COMMENT ON COLUMN attendance.first_check_in_time IS 'First check-in time of the day';
COMMENT ON COLUMN attendance.first_check_out_time IS 'First check-out time of the day (for lunch/break)';
COMMENT ON COLUMN attendance.second_check_in_time IS 'Second check-in time of the day (after lunch/break)';
COMMENT ON COLUMN attendance.second_check_out_time IS 'Final check-out time of the day';
COMMENT ON COLUMN attendance.working_duration_minutes IS 'Total working duration in minutes (calculated)';
COMMENT ON COLUMN attendance.break_duration_minutes IS 'Break duration in minutes (calculated)';
COMMENT ON COLUMN attendance.late_minutes IS 'Late arrival minutes (calculated)';
