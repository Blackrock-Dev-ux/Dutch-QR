-- Restore second session functionality
ALTER TABLE attendance
    ADD COLUMN IF NOT EXISTS is_second_session BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS previous_session_id UUID REFERENCES attendance(id),
    ADD COLUMN IF NOT EXISTS second_check_in_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS second_check_out_time TIMESTAMPTZ;

-- Drop existing constraints that might conflict
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS valid_session_progression;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_session_attendance;

-- Add new constraints for second session support
ALTER TABLE attendance ADD CONSTRAINT unique_daily_session_attendance 
    UNIQUE (employee_id, date, is_second_session);

ALTER TABLE attendance ADD CONSTRAINT valid_session_progression CHECK (
    -- For first session
    (is_second_session = false) OR
    -- For second session, require first session data
    (is_second_session = true AND 
     first_check_in_time IS NOT NULL AND 
     first_check_out_time IS NOT NULL)
);

-- Update the process_double_attendance function
CREATE OR REPLACE FUNCTION process_double_attendance(
    p_employee_id TEXT,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_employee_uuid UUID;
    v_existing_record attendance;
    v_first_session_record attendance;
    v_today DATE;
    v_worked_time INTERVAL;
    v_break_duration INTERVAL;
    v_min_time_between_actions INTERVAL := INTERVAL '30 seconds';
    result JSONB;
BEGIN
    -- Get employee UUID
    v_employee_uuid := get_employee_uuid(p_employee_id);
    IF v_employee_uuid IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'Invalid employee ID',
            'timestamp', p_current_time
        );
    END IF;

    v_today := DATE(p_current_time);

    -- Fetch the existing attendance record for today
    SELECT * INTO v_existing_record 
    FROM attendance 
    WHERE employee_id = v_employee_uuid 
    AND date = v_today 
    ORDER BY created_at DESC 
    LIMIT 1;

    -- If no record exists, create first check-in
    IF v_existing_record IS NULL THEN
        INSERT INTO attendance (
            employee_id, 
            date, 
            first_check_in_time,
            status,
            created_at,
            is_second_session
        ) VALUES (
            v_employee_uuid, 
            v_today, 
            p_current_time,
            'PRESENT',
            p_current_time,
            false
        )
        RETURNING * INTO v_existing_record;

        RETURN jsonb_build_object(
            'status', 'Success',
            'action', 'first_check_in',
            'message', 'First check-in recorded',
            'timestamp', p_current_time
        );
    
    -- If first check-in exists but no first check-out
    ELSIF v_existing_record.first_check_in_time IS NOT NULL AND 
          v_existing_record.first_check_out_time IS NULL AND 
          NOT v_existing_record.is_second_session THEN
        
        UPDATE attendance 
        SET 
            first_check_out_time = p_current_time,
            status = 'ON_BREAK'
        WHERE id = v_existing_record.id
        RETURNING * INTO v_existing_record;

        RETURN jsonb_build_object(
            'status', 'Success',
            'action', 'first_check_out',
            'message', 'First check-out recorded',
            'timestamp', p_current_time
        );

    -- If first check-out exists but no second session
    ELSIF v_existing_record.first_check_out_time IS NOT NULL AND 
          NOT v_existing_record.is_second_session THEN
        
        -- Create second session
        INSERT INTO attendance (
            employee_id,
            date,
            first_check_in_time,
            first_check_out_time,
            second_check_in_time,
            status,
            is_second_session,
            previous_session_id
        ) VALUES (
            v_employee_uuid,
            v_today,
            v_existing_record.first_check_in_time,
            v_existing_record.first_check_out_time,
            p_current_time,
            'PRESENT',
            true,
            v_existing_record.id
        )
        RETURNING * INTO v_existing_record;

        RETURN jsonb_build_object(
            'status', 'Success',
            'action', 'second_check_in',
            'message', 'Second check-in recorded',
            'timestamp', p_current_time
        );

    -- If second check-in exists but no second check-out
    ELSIF v_existing_record.second_check_in_time IS NOT NULL AND 
          v_existing_record.second_check_out_time IS NULL AND 
          v_existing_record.is_second_session THEN
        
        UPDATE attendance 
        SET 
            second_check_out_time = p_current_time,
            status = 'CHECKED_OUT'
        WHERE id = v_existing_record.id
        RETURNING * INTO v_existing_record;

        RETURN jsonb_build_object(
            'status', 'Success',
            'action', 'second_check_out',
            'message', 'Second check-out recorded',
            'timestamp', p_current_time
        );
    
    ELSE
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'Invalid attendance state',
            'timestamp', p_current_time
        );
    END IF;
END;
$$ LANGUAGE plpgsql; 