-- Add required columns if they don't exist
DO $$ 
BEGIN
    -- Add is_second_session column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'is_second_session'
    ) THEN
        ALTER TABLE attendance ADD COLUMN is_second_session BOOLEAN DEFAULT false;
    END IF;

    -- Add previous_session_id column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'previous_session_id'
    ) THEN
        ALTER TABLE attendance ADD COLUMN previous_session_id UUID REFERENCES attendance(id);
    END IF;

    -- Add second_check_in_time column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'second_check_in_time'
    ) THEN
        ALTER TABLE attendance ADD COLUMN second_check_in_time TIMESTAMPTZ;
    END IF;

    -- Add second_check_out_time column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'second_check_out_time'
    ) THEN
        ALTER TABLE attendance ADD COLUMN second_check_out_time TIMESTAMPTZ;
    END IF;

    -- Add break_duration_minutes column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'break_duration_minutes'
    ) THEN
        ALTER TABLE attendance ADD COLUMN break_duration_minutes INTEGER DEFAULT 0;
    END IF;

    -- Add break_duration column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'break_duration'
    ) THEN
        ALTER TABLE attendance ADD COLUMN break_duration TEXT DEFAULT '0h 0m';
    END IF;

    -- Add working_duration_minutes column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'working_duration_minutes'
    ) THEN
        ALTER TABLE attendance ADD COLUMN working_duration_minutes INTEGER DEFAULT 0;
    END IF;

    -- Add working_duration column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'working_duration'
    ) THEN
        ALTER TABLE attendance ADD COLUMN working_duration TEXT DEFAULT '0h 0m';
    END IF;

    -- Add total_working_minutes column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'total_working_minutes'
    ) THEN
        ALTER TABLE attendance ADD COLUMN total_working_minutes INTEGER DEFAULT 0;
    END IF;

    -- Add total_working_duration column
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'total_working_duration'
    ) THEN
        ALTER TABLE attendance ADD COLUMN total_working_duration TEXT DEFAULT '0h 0m';
    END IF;
END $$;

-- Drop existing constraints and triggers that might interfere
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_session_times;
DROP TRIGGER IF EXISTS session_validation_trigger ON attendance;
DROP INDEX IF EXISTS unique_employee_date_session_checkin;

-- Clean up any invalid second sessions
DO $$
BEGIN
    -- Delete invalid second sessions
    DELETE FROM attendance
    WHERE is_second_session = true
    AND (
        previous_session_id IS NULL
        OR NOT EXISTS (
            SELECT 1 FROM attendance a2
            WHERE a2.id = attendance.previous_session_id
            AND a2.is_second_session = false
            AND a2.first_check_out_time IS NOT NULL
        )
    );

    -- Temporarily disable triggers
    ALTER TABLE attendance DISABLE TRIGGER ALL;

    -- Reset timestamp and integer fields for first sessions
    UPDATE attendance
    SET 
        second_check_in_time = NULL,
        second_check_out_time = NULL,
        working_duration_minutes = 0,
        total_working_minutes = 0,
        break_duration_minutes = 0
    WHERE is_second_session = false;

    -- Reset text fields for first sessions
    UPDATE attendance
    SET 
        working_duration = '0h 0m',
        total_working_duration = '0h 0m',
        break_duration = '0h 0m'
    WHERE is_second_session = false;

    -- Re-enable triggers
    ALTER TABLE attendance ENABLE TRIGGER ALL;
END $$;

-- Create a new function to handle second session validation
CREATE OR REPLACE FUNCTION validate_second_session()
RETURNS TRIGGER AS $$
BEGIN
    -- For second sessions
    IF NEW.is_second_session = true THEN
        -- Ensure previous_session_id is set
        IF NEW.previous_session_id IS NULL THEN
            RAISE EXCEPTION 'Second session must reference a previous session';
        END IF;

        -- Ensure the previous session exists and is valid
        IF NOT EXISTS (
            SELECT 1 FROM attendance
            WHERE id = NEW.previous_session_id
            AND is_second_session = false
            AND first_check_out_time IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Previous session must exist and be completed';
        END IF;

        -- Ensure check-in time is after previous session check-out
        IF EXISTS (
            SELECT 1 FROM attendance
            WHERE id = NEW.previous_session_id
            AND NEW.check_in_time <= first_check_out_time
        ) THEN
            RAISE EXCEPTION 'Second session check-in must be after first session check-out';
        END IF;

        -- Copy first session check-out time
        SELECT first_check_out_time INTO NEW.first_check_out_time
        FROM attendance
        WHERE id = NEW.previous_session_id;

        -- Validate time sequence
        IF NEW.first_check_in_time IS NULL OR NEW.first_check_out_time IS NULL THEN
            RAISE EXCEPTION 'Second session requires both first check-in and check-out times';
        END IF;

        IF NEW.first_check_out_time <= NEW.first_check_in_time THEN
            RAISE EXCEPTION 'First check-out time must be after first check-in time';
        END IF;

        IF NEW.second_check_in_time IS NOT NULL AND NEW.second_check_in_time <= NEW.first_check_out_time THEN
            RAISE EXCEPTION 'Second check-in time must be after first check-out time';
        END IF;

        IF NEW.second_check_out_time IS NOT NULL AND NEW.second_check_out_time <= NEW.second_check_in_time THEN
            RAISE EXCEPTION 'Second check-out time must be after second check-in time';
        END IF;
    END IF;

    -- For first sessions
    IF NEW.is_second_session = false THEN
        NEW.second_check_in_time = NULL;
        NEW.second_check_out_time = NULL;
        NEW.previous_session_id = NULL;

        -- Validate first session time sequence
        IF NEW.first_check_in_time IS NULL THEN
            RAISE EXCEPTION 'First check-in time is required';
        END IF;

        IF NEW.first_check_out_time IS NOT NULL AND NEW.first_check_out_time <= NEW.first_check_in_time THEN
            RAISE EXCEPTION 'First check-out time must be after first check-in time';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER second_session_validation_trigger
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION validate_second_session();

-- Create a simpler check_session_times constraint
ALTER TABLE attendance
ADD CONSTRAINT check_session_times
CHECK (
    CASE
        WHEN is_second_session = false THEN
            -- First session rules
            second_check_in_time IS NULL AND
            second_check_out_time IS NULL AND
            previous_session_id IS NULL AND
            first_check_in_time IS NOT NULL AND
            (first_check_out_time IS NULL OR first_check_out_time > first_check_in_time)
        WHEN is_second_session = true THEN
            -- Second session rules
            previous_session_id IS NOT NULL AND
            first_check_in_time IS NOT NULL AND
            first_check_out_time IS NOT NULL AND
            first_check_out_time > first_check_in_time AND
            second_check_in_time IS NOT NULL AND
            second_check_in_time > first_check_out_time AND
            (second_check_out_time IS NULL OR second_check_out_time > second_check_in_time)
    END
);

-- Create a unique index that prevents duplicate sessions
CREATE UNIQUE INDEX unique_employee_date_session
ON attendance (employee_id, date, is_second_session, first_check_in_time)
WHERE is_second_session = true;

-- Create a function to automatically handle second session creation
CREATE OR REPLACE FUNCTION create_second_session(
    p_employee_id UUID,
    p_first_session_id UUID
) RETURNS attendance AS $$
DECLARE
    v_first_session attendance;
    v_second_session attendance;
    v_now TIMESTAMPTZ := NOW();
    v_break_minutes INTEGER;
BEGIN
    -- Get the first session
    SELECT * INTO v_first_session
    FROM attendance
    WHERE id = p_first_session_id
    AND employee_id = p_employee_id
    AND is_second_session = false;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'First session not found';
    END IF;

    IF v_first_session.first_check_out_time IS NULL THEN
        RAISE EXCEPTION 'First session must be checked out';
    END IF;

    -- Calculate break duration in minutes
    v_break_minutes := GREATEST(EXTRACT(EPOCH FROM (v_now - v_first_session.first_check_out_time))/60, 0)::INTEGER;

    -- Calculate break duration
    INSERT INTO attendance (
        employee_id,
        date,
        check_in_time,
        first_check_in_time,
        first_check_out_time,
        is_second_session,
        previous_session_id,
        status,
        sequence_number,
        late_duration,
        device_info,
        check_in_location,
        check_in_attempts,
        working_duration_minutes,
        working_duration,
        total_working_minutes,
        total_working_duration,
        minutes_late,
        early_departure,
        overtime,
        break_duration_minutes,
        break_duration
    ) VALUES (
        p_employee_id,
        v_first_session.date,
        v_now,
        v_now,
        v_first_session.first_check_out_time,
        true,
        p_first_session_id,
        'CHECKED_IN',
        2,
        0,
        'System',
        'Office',
        1,
        0,
        '0h 0m',
        0,
        '0h 0m',
        0,
        false,
        0,
        v_break_minutes,
        (v_break_minutes / 60)::TEXT || 'h ' || (MOD(v_break_minutes, 60))::TEXT || 'm'
    )
    RETURNING * INTO v_second_session;

    RETURN v_second_session;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON CONSTRAINT check_session_times ON attendance IS 
'Ensures proper session state for both first and second sessions';

COMMENT ON FUNCTION create_second_session IS 
'Creates a second session record with proper validation and data copying from first session';

COMMENT ON FUNCTION validate_second_session IS 
'Validates second session records and ensures proper relationships with first sessions'; 