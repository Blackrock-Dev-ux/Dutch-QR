-- Drop all constraints that might interfere with second check-in
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS valid_session_progression;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS valid_check_times;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_session_attendance;

-- Add simplified constraints that won't block second check-in
ALTER TABLE attendance ADD CONSTRAINT unique_daily_session_attendance 
    UNIQUE (employee_id, date, is_second_session);

-- Update the function to properly handle second check-in
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

    -- Get current attendance record
    SELECT * INTO v_existing_record 
    FROM attendance 
    WHERE employee_id = v_employee_uuid 
    AND date = v_today
    AND is_second_session = false
    ORDER BY created_at DESC 
    LIMIT 1;

    -- CASE 1: No attendance record exists - First Check-in
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
            'PRESENT',
            false
        );
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'First check-in successful',
            'action', 'FIRST_CHECK_IN'
        );
    
    -- CASE 2: First check-in exists but no check-out - First Check-out
    ELSIF v_existing_record.first_check_in_time IS NOT NULL AND 
          v_existing_record.first_check_out_time IS NULL THEN
        
        UPDATE attendance 
        SET first_check_out_time = p_current_time,
            status = 'ON_BREAK'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'First check-out successful',
            'action', 'FIRST_CHECK_OUT'
        );
    
    -- CASE 3: First session complete - Second Check-in
    ELSIF v_existing_record.first_check_out_time IS NOT NULL AND 
          NOT EXISTS (
              SELECT 1 FROM attendance 
              WHERE employee_id = v_employee_uuid 
              AND date = v_today 
              AND is_second_session = true
          ) THEN
        
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
        );
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-in successful',
            'action', 'SECOND_CHECK_IN'
        );
    
    -- CASE 4: Second check-in exists - Second Check-out
    ELSE
        UPDATE attendance 
        SET second_check_out_time = p_current_time,
            status = 'CHECKED_OUT'
        WHERE employee_id = v_employee_uuid 
        AND date = v_today
        AND is_second_session = true
        AND second_check_out_time IS NULL;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-out successful',
            'action', 'SECOND_CHECK_OUT'
        );
    END IF;

END;
$$ LANGUAGE plpgsql; 