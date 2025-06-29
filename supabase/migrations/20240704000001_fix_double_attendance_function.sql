-- Drop any existing versions of the function
DROP FUNCTION IF EXISTS process_double_attendance(UUID, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS process_double_attendance(TEXT, TIMESTAMPTZ);

-- Create a function to handle UUID conversion
CREATE OR REPLACE FUNCTION get_employee_uuid(p_employee_id TEXT)
RETURNS UUID AS $$
DECLARE
    v_employee_uuid UUID;
BEGIN
    -- First try to find the employee by email
    SELECT id INTO v_employee_uuid
    FROM employees
    WHERE email = p_employee_id;

    IF FOUND THEN
        RETURN v_employee_uuid;
    END IF;

    -- If not found by email, try to parse as UUID
    BEGIN
        v_employee_uuid := p_employee_id::UUID;
        RETURN v_employee_uuid;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid employee ID format';
    END;
END;
$$ LANGUAGE plpgsql;

-- Create a function to validate and process double check-in/check-out
CREATE OR REPLACE FUNCTION process_double_attendance(
    p_employee_id TEXT, 
    p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_today DATE := DATE(p_current_time);
    v_existing_record RECORD;
    v_first_session_record RECORD;
    result JSONB;
    v_break_duration INTERVAL;
    v_worked_time INTERVAL;
    v_min_time_between_actions INTERVAL := INTERVAL '30 seconds';
    v_employee_uuid UUID;
BEGIN
    -- Try to get employee UUID
    BEGIN
        v_employee_uuid := get_employee_uuid(p_employee_id);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'Invalid employee ID format',
            'timestamp', p_current_time
        );
    END;

    -- Fetch the existing attendance record for today
    SELECT * INTO v_existing_record 
    FROM attendance 
    WHERE employee_id = v_employee_uuid 
    AND date = v_today 
    ORDER BY created_at DESC 
    LIMIT 1;

    -- Prevent rapid consecutive scans
    IF v_existing_record IS NOT NULL AND v_existing_record.last_action_time IS NOT NULL THEN
        IF p_current_time < v_existing_record.last_action_time + v_min_time_between_actions THEN
            RETURN jsonb_build_object(
                'status', 'Error',
                'message', 'Please wait at least 30 seconds between scans',
                'cooldown_remaining', EXTRACT(EPOCH FROM (v_existing_record.last_action_time + v_min_time_between_actions - p_current_time)),
                'timestamp', p_current_time
            );
        END IF;
    END IF;

    -- If no record exists, create first check-in
    IF v_existing_record IS NULL THEN
        INSERT INTO attendance (
            employee_id, 
            date, 
            check_in_time,
            first_check_in_time, 
            status,
            created_at,
            last_action_time,
            is_second_session
        ) VALUES (
            v_employee_uuid, 
            v_today, 
            p_current_time,
            p_current_time, 
            'PRESENT',
            p_current_time,
            p_current_time,
            false
        )
        RETURNING * INTO v_existing_record;

        result := jsonb_build_object(
            'status', 'Success',
            'action', 'first_check_in',
            'message', 'First check-in recorded',
            'timestamp', p_current_time,
            'check_in_time', p_current_time,
            'first_check_in_time', p_current_time
        );
    
    -- If first check-in exists but no first check-out
    ELSIF v_existing_record.first_check_in_time IS NOT NULL AND v_existing_record.first_check_out_time IS NULL AND NOT v_existing_record.is_second_session THEN
        -- Check if at least 5 minutes have passed since first check-in
        IF p_current_time < v_existing_record.first_check_in_time + INTERVAL '5 minutes' THEN
            RETURN jsonb_build_object(
                'status', 'Error',
                'message', 'Must wait 5 minutes before first check-out',
                'cooldown_remaining', EXTRACT(EPOCH FROM (v_existing_record.first_check_in_time + INTERVAL '5 minutes' - p_current_time)),
                'timestamp', p_current_time
            );
        END IF;

        -- Calculate worked time for first session
        v_worked_time := p_current_time - v_existing_record.first_check_in_time;

        -- Record first check-out
        UPDATE attendance 
        SET 
            check_out_time = p_current_time,
            first_check_out_time = p_current_time,
            status = 'ON_BREAK',
            total_worked_time = v_worked_time,
            last_action_time = p_current_time
        WHERE id = v_existing_record.id
        RETURNING * INTO v_existing_record;

        result := jsonb_build_object(
            'status', 'Success',
            'action', 'first_check_out',
            'message', 'First check-out recorded',
            'timestamp', p_current_time,
            'check_out_time', p_current_time,
            'first_check_out_time', p_current_time,
            'first_check_in_time', v_existing_record.first_check_in_time,
            'worked_time', EXTRACT(EPOCH FROM v_worked_time)
        );

    -- If first check-out exists but no second check-in
    ELSIF v_existing_record.first_check_out_time IS NOT NULL AND v_existing_record.second_check_in_time IS NULL THEN
        -- Validate sequence timing
        IF p_current_time <= v_existing_record.first_check_out_time THEN
            RETURN jsonb_build_object(
                'status', 'Error',
                'message', 'Invalid sequence: Second check-in cannot be at the same time or before first check-out',
                'timestamp', p_current_time
            );
        END IF;

        -- Store the first session record
        v_first_session_record := v_existing_record;

        -- Calculate break duration
        v_break_duration := p_current_time - v_existing_record.first_check_out_time;

        -- Create a new record for the second session
        INSERT INTO attendance (
            employee_id,
            date,
            check_in_time,
            first_check_in_time,
            first_check_out_time,
            second_check_in_time,
            status,
            break_duration,
            last_action_time,
            is_second_session,
            previous_session_id
        ) VALUES (
            v_employee_uuid,
            v_today,
            p_current_time,
            v_first_session_record.first_check_in_time,
            v_first_session_record.first_check_out_time,
            p_current_time,
            'PRESENT',
            v_break_duration,
            p_current_time,
            true,
            v_first_session_record.id
        )
        RETURNING * INTO v_existing_record;

        result := jsonb_build_object(
            'status', 'Success',
            'action', 'second_check_in',
            'message', 'Second check-in recorded',
            'timestamp', p_current_time,
            'check_in_time', p_current_time,
            'second_check_in_time', p_current_time,
            'first_check_in_time', v_first_session_record.first_check_in_time,
            'first_check_out_time', v_first_session_record.first_check_out_time,
            'break_duration', EXTRACT(EPOCH FROM v_break_duration)
        );

    -- If second check-in exists but no second check-out
    ELSIF v_existing_record.second_check_in_time IS NOT NULL AND v_existing_record.second_check_out_time IS NULL AND v_existing_record.is_second_session THEN
        -- Validate sequence timing
        IF p_current_time <= v_existing_record.second_check_in_time THEN
            RETURN jsonb_build_object(
                'status', 'Error',
                'message', 'Invalid sequence: Second check-out cannot be at the same time or before second check-in',
                'timestamp', p_current_time
            );
        END IF;

        -- Calculate total worked time (first session + second session)
        v_worked_time := (v_existing_record.first_check_out_time - v_existing_record.first_check_in_time) +
                        (p_current_time - v_existing_record.second_check_in_time);

        -- Record second check-out
        UPDATE attendance 
        SET 
            check_out_time = p_current_time,
            second_check_out_time = p_current_time,
            status = 'CHECKED_OUT',
            total_worked_time = v_worked_time,
            total_hours = EXTRACT(EPOCH FROM v_worked_time)/3600,
            last_action_time = p_current_time
        WHERE id = v_existing_record.id
        RETURNING * INTO v_existing_record;

        result := jsonb_build_object(
            'status', 'Success',
            'action', 'second_check_out',
            'message', 'Second check-out recorded',
            'timestamp', p_current_time,
            'check_out_time', p_current_time,
            'second_check_out_time', p_current_time,
            'first_check_in_time', v_existing_record.first_check_in_time,
            'first_check_out_time', v_existing_record.first_check_out_time,
            'second_check_in_time', v_existing_record.second_check_in_time,
            'total_hours', v_existing_record.total_hours,
            'break_duration', EXTRACT(EPOCH FROM v_existing_record.break_duration),
            'total_worked_time', EXTRACT(EPOCH FROM v_worked_time)
        );
    
    ELSE
        -- All scans for the day have been completed
        result := jsonb_build_object(
            'status', 'Error',
            'message', 'All attendance for today already marked',
            'timestamp', p_current_time
        );
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql;