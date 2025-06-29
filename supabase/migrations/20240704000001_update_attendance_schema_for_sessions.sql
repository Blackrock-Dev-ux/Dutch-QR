-- Migration to update attendance schema for session-based approach

-- First, drop the constraints that are causing issues
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_employee_date_checkin;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance_sequence;

-- Add new columns
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS is_second_session BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS previous_session_id UUID REFERENCES attendance(id);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(is_second_session);
CREATE INDEX IF NOT EXISTS idx_attendance_previous_session ON attendance(previous_session_id);

-- Add comments for documentation
COMMENT ON COLUMN attendance.is_second_session IS 'Flag indicating if this is a second session record';
COMMENT ON COLUMN attendance.previous_session_id IS 'Reference to the previous session record for the same day';

-- Clean up existing data
DO $$
DECLARE
    r RECORD;
BEGIN
    -- First, update sequence numbers for existing records to avoid conflicts
    UPDATE attendance
    SET sequence_number = 1
    WHERE sequence_number = 2;

    -- Then handle records with second check-in/out times
    FOR r IN 
        SELECT id, employee_id, date, 
               first_check_in_time, first_check_out_time,
               second_check_in_time, second_check_out_time,
               check_in_time, check_out_time, status,
               sequence_number, late_duration, device_info,
               check_in_location, check_in_attempts
        FROM attendance 
        WHERE second_check_in_time IS NOT NULL 
        OR second_check_out_time IS NOT NULL
    LOOP
        -- Create a new second session record
        INSERT INTO attendance (
            employee_id,
            date,
            check_in_time,
            check_out_time,
            first_check_in_time,
            first_check_out_time,
            is_second_session,
            previous_session_id,
            status,
            sequence_number,
            late_duration,
            device_info,
            check_in_location,
            check_in_attempts
        )
        VALUES (
            r.employee_id,
            r.date,
            r.second_check_in_time,  -- Use second_check_in_time as check_in_time
            r.second_check_out_time, -- Use second_check_out_time as check_out_time
            r.second_check_in_time,  -- Use second_check_in_time as first_check_in_time
            r.second_check_out_time, -- Use second_check_out_time as first_check_out_time
            true,
            r.id,
            CASE 
                WHEN r.second_check_out_time IS NOT NULL THEN 'CHECKED_OUT'
                ELSE 'CHECKED_IN'
            END,
            2,  -- This is always the second sequence
            0,  -- Reset late duration for second session
            r.device_info,
            r.check_in_location,
            1   -- Reset check-in attempts for second session
        );

        -- Update the original record to remove second session data
        UPDATE attendance
        SET second_check_in_time = NULL,
            second_check_out_time = NULL,
            is_second_session = false,
            sequence_number = 1
        WHERE id = r.id;
    END LOOP;

    -- Set is_second_session to false for all remaining records
    UPDATE attendance
    SET is_second_session = false
    WHERE is_second_session IS NULL;
END $$;

-- Create a function to validate session records
CREATE OR REPLACE FUNCTION validate_session_record()
RETURNS TRIGGER AS $$
BEGIN
    -- For second sessions, ensure previous_session_id is set
    IF NEW.is_second_session = true AND NEW.previous_session_id IS NULL THEN
        RAISE EXCEPTION 'Second session records must reference a previous session';
    END IF;

    -- Ensure first sessions don't have previous_session_id
    IF NEW.is_second_session = false AND NEW.previous_session_id IS NOT NULL THEN
        RAISE EXCEPTION 'First session records cannot have a previous session reference';
    END IF;

    -- For second sessions, validate the previous session exists and is completed
    IF NEW.is_second_session = true AND NEW.previous_session_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM attendance 
            WHERE id = NEW.previous_session_id 
            AND is_second_session = false
            AND first_check_out_time IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Previous session must exist and be completed';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session validation
CREATE TRIGGER session_validation_trigger
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION validate_session_record();

-- Add constraints to ensure proper session handling
ALTER TABLE attendance
ADD CONSTRAINT check_session_times
CHECK (
    (is_second_session = false AND second_check_in_time IS NULL AND second_check_out_time IS NULL) OR
    (is_second_session = true AND first_check_in_time IS NOT NULL)
);

-- Create new unique constraints that take into account sessions
CREATE UNIQUE INDEX unique_employee_date_session_checkin 
ON attendance (employee_id, date, is_second_session, check_in_time) 
WHERE check_in_time IS NOT NULL;

CREATE UNIQUE INDEX unique_daily_attendance_sequence
ON attendance (employee_id, date, sequence_number)
WHERE sequence_number IS NOT NULL; 