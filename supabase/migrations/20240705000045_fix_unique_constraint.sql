-- Drop existing constraints that prevent multiple records
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_session_attendance;

-- Add a more specific unique constraint that allows both sessions
ALTER TABLE attendance ADD CONSTRAINT unique_attendance_session UNIQUE (employee_id, date, is_second_session);

-- Update the function to handle the session logic properly
CREATE OR REPLACE FUNCTION process_double_attendance(
    p_employee_id TEXT,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_employee_uuid UUID;
    v_existing_record attendance;
    v_today DATE;
    result JSONB;
BEGIN
    -- Get employee UUID
    v_employee_uuid := get_employee_uuid(p_employee_id);
    IF v_employee_uuid IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'Invalid employee ID'
        );
    END IF;

    v_today := DATE(p_current_time);

    -- Get the latest attendance record for today
    SELECT * INTO v_existing_record 
    FROM attendance 
    WHERE employee_id = v_employee_uuid 
    AND date = v_today
    ORDER BY created_at DESC 
    LIMIT 1;

    -- Case 1: No record exists - First Check-in
    IF v_existing_record IS NULL THEN
        INSERT INTO attendance (
            employee_id,
            date,
            first_check_in_time,
            status,
            is_second_session
        ) VALUES (
            v_employee_uuid,
            v_today,
            p_current_time,
            'CHECKED_IN',
            false
        );
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'First check-in successful',
            'action', 'FIRST_CHECK_IN'
        );
    
    -- Case 2: Record exists with first check-in but no check-out
    ELSIF v_existing_record.first_check_in_time IS NOT NULL AND 
          v_existing_record.first_check_out_time IS NULL AND 
          NOT v_existing_record.is_second_session THEN
        
        UPDATE attendance 
        SET first_check_out_time = p_current_time,
            status = 'ON_BREAK'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'First check-out successful',
            'action', 'FIRST_CHECK_OUT'
        );
    
    -- Case 3: Record exists with first check-out but no second check-in
    ELSIF v_existing_record.first_check_out_time IS NOT NULL AND 
          NOT v_existing_record.is_second_session THEN
        
        -- Create new record for second session
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
            'CHECKED_IN',
            true,
            v_existing_record.id
        );
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-in successful',
            'action', 'SECOND_CHECK_IN'
        );
    
    -- Case 4: Second check-in exists but no second check-out
    ELSIF v_existing_record.second_check_in_time IS NOT NULL AND 
          v_existing_record.second_check_out_time IS NULL AND
          v_existing_record.is_second_session THEN
        
        UPDATE attendance 
        SET second_check_out_time = p_current_time,
            status = 'CHECKED_OUT'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-out successful',
            'action', 'SECOND_CHECK_OUT'
        );
    
    ELSE
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'Invalid attendance state'
        );
    END IF;

END;
$$ LANGUAGE plpgsql; 