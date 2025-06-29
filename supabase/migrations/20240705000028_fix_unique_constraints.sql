-- Drop existing unique constraints
DROP INDEX IF EXISTS unique_employee_date_session;

-- Create separate unique indexes for first and second sessions
CREATE UNIQUE INDEX unique_employee_date_first_session
ON attendance (employee_id, date)
WHERE is_second_session = false;

CREATE UNIQUE INDEX unique_employee_date_second_session
ON attendance (employee_id, date, previous_session_id)
WHERE is_second_session = true;

-- Add helpful comments
COMMENT ON INDEX unique_employee_date_first_session IS 
'Ensures only one first session per employee per day';

COMMENT ON INDEX unique_employee_date_second_session IS 
'Ensures only one second session per first session';

-- Update the create_second_session function to handle unique constraint violations
CREATE OR REPLACE FUNCTION create_second_session(
    p_employee_id UUID,
    p_first_session_id UUID
) RETURNS attendance AS $$
DECLARE
    v_first_session attendance;
    v_second_session attendance;
    v_now TIMESTAMPTZ := NOW();
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

    -- Check if a second session already exists
    IF EXISTS (
        SELECT 1 FROM attendance 
        WHERE employee_id = p_employee_id 
        AND date = v_first_session.date
        AND is_second_session = true
        AND previous_session_id = p_first_session_id
    ) THEN
        RAISE EXCEPTION 'Second session already exists for this first session';
    END IF;

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
        v_first_session.working_duration_minutes,
        v_first_session.working_duration,
        0,
        false,
        0,
        EXTRACT(EPOCH FROM (v_now - v_first_session.first_check_out_time))/60,
        (EXTRACT(EPOCH FROM (v_now - v_first_session.first_check_out_time))/60)::text || 'm'
    )
    RETURNING * INTO v_second_session;

    RETURN v_second_session;
END;
$$ LANGUAGE plpgsql;