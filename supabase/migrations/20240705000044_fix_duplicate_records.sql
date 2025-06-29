-- First, clean up any duplicate records
CREATE OR REPLACE FUNCTION clean_duplicate_attendance() RETURNS void AS $$
DECLARE
    v_duplicate RECORD;
BEGIN
    FOR v_duplicate IN 
        SELECT DISTINCT a1.employee_id, a1.date
        FROM attendance a1
        JOIN attendance a2 ON 
            a1.employee_id = a2.employee_id AND 
            a1.date = a2.date AND 
            a1.id != a2.id
    LOOP
        -- Keep the record with the most information
        WITH ranked_records AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       ORDER BY 
                           CASE WHEN first_check_out_time IS NOT NULL THEN 1 ELSE 0 END +
                           CASE WHEN second_check_in_time IS NOT NULL THEN 1 ELSE 0 END +
                           CASE WHEN second_check_out_time IS NOT NULL THEN 1 ELSE 0 END DESC
                   ) as rn
            FROM attendance
            WHERE employee_id = v_duplicate.employee_id
            AND date = v_duplicate.date
        )
        DELETE FROM attendance
        WHERE id IN (
            SELECT id FROM ranked_records WHERE rn > 1
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup
SELECT clean_duplicate_attendance();

-- Drop the cleanup function as it's no longer needed
DROP FUNCTION clean_duplicate_attendance();

-- Modify the attendance table to prevent duplicates
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance;
ALTER TABLE attendance ADD CONSTRAINT unique_daily_attendance UNIQUE (employee_id, date);

-- Update the process_double_attendance function to handle all cases in a single record
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

    -- Get existing record for today
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
    
    -- Case 2: First check-in exists but no check-out
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
    
    -- Case 3: First check-out exists but no second check-in
    ELSIF v_existing_record.first_check_out_time IS NOT NULL AND 
          v_existing_record.second_check_in_time IS NULL THEN
        
        UPDATE attendance 
        SET second_check_in_time = p_current_time,
            status = 'CHECKED_IN'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-in successful',
            'action', 'SECOND_CHECK_IN'
        );
    
    -- Case 4: Second check-in exists but no second check-out
    ELSIF v_existing_record.second_check_in_time IS NOT NULL AND 
          v_existing_record.second_check_out_time IS NULL THEN
        
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