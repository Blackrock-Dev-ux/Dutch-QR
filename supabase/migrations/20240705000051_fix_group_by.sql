-- Fix the consolidation of duplicate records
DO $$
DECLARE
    v_duplicate RECORD;
    v_consolidated_record attendance;
BEGIN
    FOR v_duplicate IN 
        SELECT DISTINCT a1.employee_id, a1.date
        FROM attendance a1
        JOIN attendance a2 ON 
            a1.employee_id = a2.employee_id AND 
            a1.date = a2.date AND 
            a1.id != a2.id
    LOOP
        WITH ordered_records AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY employee_id, date ORDER BY created_at) as rn
            FROM attendance
            WHERE employee_id = v_duplicate.employee_id
            AND date = v_duplicate.date
        ),
        first_record AS (
            SELECT id
            FROM ordered_records
            ORDER BY created_at
            LIMIT 1
        ),
        consolidated AS (
            SELECT 
                fr.id,
                o.employee_id,
                o.date,
                MIN(CASE WHEN o.rn = 1 THEN o.first_check_in_time END) as first_check_in_time,
                MIN(CASE WHEN o.rn = 1 THEN o.first_check_out_time END) as first_check_out_time,
                MIN(CASE WHEN o.rn = 2 THEN o.first_check_in_time END) as second_check_in_time,
                MIN(CASE WHEN o.rn = 2 THEN o.first_check_out_time END) as second_check_out_time,
                CASE 
                    WHEN bool_or(o.rn = 2 AND o.first_check_out_time IS NOT NULL) THEN 'CHECKED_OUT'
                    WHEN bool_or(o.rn = 2 AND o.first_check_in_time IS NOT NULL) THEN 'CHECKED_IN'
                    WHEN bool_or(o.rn = 1 AND o.first_check_out_time IS NOT NULL) THEN 'ON_BREAK'
                    ELSE 'CHECKED_IN'
                END as status
            FROM ordered_records o
            CROSS JOIN first_record fr
            GROUP BY fr.id, o.employee_id, o.date
        )
        -- Update the first record with consolidated data
        UPDATE attendance a
        SET 
            first_check_in_time = c.first_check_in_time,
            first_check_out_time = c.first_check_out_time,
            second_check_in_time = c.second_check_in_time,
            second_check_out_time = c.second_check_out_time,
            status = c.status
        FROM consolidated c
        WHERE a.id = c.id
        RETURNING a.* INTO v_consolidated_record;

        -- Delete other records for this employee and date
        DELETE FROM attendance
        WHERE employee_id = v_duplicate.employee_id
        AND date = v_duplicate.date
        AND id != v_consolidated_record.id;
    END LOOP;
END $$;

-- Update the function to maintain single records
CREATE OR REPLACE FUNCTION process_double_attendance(
    p_employee_id TEXT,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_employee_uuid UUID;
    v_existing_record attendance;
    v_today DATE;
    v_break_duration INTERVAL;
    v_working_duration INTERVAL;
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
    
    -- Case 2: First check-in exists but no first check-out
    ELSIF v_existing_record.first_check_in_time IS NOT NULL AND 
          v_existing_record.first_check_out_time IS NULL THEN
        
        UPDATE attendance 
        SET first_check_out_time = p_current_time,
            status = 'ON_BREAK',
            break_duration = EXTRACT(EPOCH FROM (p_current_time - first_check_in_time))/3600
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
        
        -- Calculate total working duration
        v_working_duration := (v_existing_record.first_check_out_time - v_existing_record.first_check_in_time) +
                            (p_current_time - v_existing_record.second_check_in_time);
        
        UPDATE attendance 
        SET second_check_out_time = p_current_time,
            status = 'CHECKED_OUT',
            working_duration = EXTRACT(EPOCH FROM v_working_duration)/3600
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-out successful',
            'action', 'SECOND_CHECK_OUT'
        );
    
    ELSE
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'All attendance actions for today are completed'
        );
    END IF;

END;
$$ LANGUAGE plpgsql; 