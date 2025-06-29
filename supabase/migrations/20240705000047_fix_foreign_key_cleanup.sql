-- First, clean up any duplicate records for today while respecting foreign keys
DO $$
DECLARE
    v_duplicate RECORD;
    v_keep_id UUID;
    v_delete_id UUID;
BEGIN
    FOR v_duplicate IN 
        SELECT DISTINCT a1.employee_id, a1.date
        FROM attendance a1
        JOIN attendance a2 ON 
            a1.employee_id = a2.employee_id AND 
            a1.date = a2.date AND 
            a1.id != a2.id
        WHERE a1.date = CURRENT_DATE
    LOOP
        -- Find the record to keep (most recent)
        SELECT id INTO v_keep_id
        FROM attendance
        WHERE employee_id = v_duplicate.employee_id
        AND date = v_duplicate.date
        ORDER BY created_at DESC
        LIMIT 1;

        -- Update any records that reference the ones we'll delete
        UPDATE attendance
        SET previous_session_id = v_keep_id
        WHERE previous_session_id IN (
            SELECT id 
            FROM attendance
            WHERE employee_id = v_duplicate.employee_id
            AND date = v_duplicate.date
            AND id != v_keep_id
        );

        -- Now delete the duplicate records
        DELETE FROM attendance
        WHERE employee_id = v_duplicate.employee_id
        AND date = v_duplicate.date
        AND id != v_keep_id;
    END LOOP;
END $$;

-- Update the function to handle all states in a single record
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

    -- Get the existing attendance record for today
    SELECT * INTO v_existing_record 
    FROM attendance 
    WHERE employee_id = v_employee_uuid 
    AND date = v_today;

    -- Case 1: No record exists - First Check-in
    IF v_existing_record IS NULL THEN
        INSERT INTO attendance (
            employee_id,
            date,
            first_check_in_time,
            status
        ) VALUES (
            v_employee_uuid,
            v_today,
            p_current_time,
            'CHECKED_IN'
        );
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'First check-in successful',
            'action', 'FIRST_CHECK_IN'
        );
    
    -- Case 2: Record exists with first check-in but no check-out
    ELSIF v_existing_record.first_check_in_time IS NOT NULL AND 
          v_existing_record.first_check_out_time IS NULL THEN
        
        -- Update existing record with check-out time
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
          v_existing_record.second_check_in_time IS NULL THEN
        
        -- Update existing record with second check-in
        UPDATE attendance 
        SET second_check_in_time = p_current_time,
            status = 'CHECKED_IN'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-in successful',
            'action', 'SECOND_CHECK_IN'
        );
    
    -- Case 4: Record exists with second check-in but no second check-out
    ELSIF v_existing_record.second_check_in_time IS NOT NULL AND 
          v_existing_record.second_check_out_time IS NULL THEN
        
        -- Update existing record with second check-out
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
        -- All actions for today are completed
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'All attendance actions for today are completed'
        );
    END IF;

END;
$$ LANGUAGE plpgsql; 