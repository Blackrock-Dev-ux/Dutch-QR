-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.process_double_attendance(text, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.process_double_attendance(UUID, TIMESTAMPTZ);

-- Create a single function that handles both text and UUID inputs
CREATE OR REPLACE FUNCTION public.process_double_attendance(
    p_employee_id text,
    p_current_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
) RETURNS TABLE (
    recorded_time TIMESTAMPTZ,
    action TEXT,
    first_check_in_time TIMESTAMPTZ,
    first_check_out_time TIMESTAMPTZ,
    second_check_in_time TIMESTAMPTZ,
    second_check_out_time TIMESTAMPTZ
) AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_record attendance;
    v_employee_uuid UUID;
BEGIN
    -- Convert text to UUID if needed
    BEGIN
        v_employee_uuid := p_employee_id::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid employee ID format: %', p_employee_id;
    END;

    -- Get existing record for today
    SELECT * INTO v_record
    FROM attendance
    WHERE employee_id = v_employee_uuid
    AND date = v_today;

    -- Determine the next action based on current state
    IF v_record.id IS NULL THEN
        -- No record exists, this is a first check-in
        RETURN QUERY SELECT 
            p_current_time,
            'check_in'::TEXT,
            p_current_time,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ;
    ELSIF v_record.check_in_time IS NOT NULL AND v_record.check_out_time IS NULL AND v_record.break_start_time IS NULL THEN
        -- Checked in but not on break or checked out, this is start break
        RETURN QUERY SELECT 
            p_current_time,
            'start_break'::TEXT,
            v_record.check_in_time,
            p_current_time,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ;
    ELSIF v_record.check_in_time IS NOT NULL AND v_record.check_out_time IS NOT NULL AND v_record.break_start_time IS NULL THEN
        -- Already checked out for the day
        RETURN QUERY SELECT 
            p_current_time,
            'completed'::TEXT,
            v_record.check_in_time,
            v_record.check_out_time,
            NULL::TIMESTAMPTZ,
            NULL::TIMESTAMPTZ;
    ELSIF v_record.check_in_time IS NOT NULL AND v_record.check_out_time IS NULL AND v_record.break_start_time IS NOT NULL AND v_record.break_end_time IS NULL THEN
        -- On break, this is end break
        RETURN QUERY SELECT 
            p_current_time,
            'end_break'::TEXT,
            v_record.check_in_time,
            v_record.break_start_time,
            p_current_time,
            NULL::TIMESTAMPTZ;
    ELSE
        -- Must be check out
        RETURN QUERY SELECT 
            p_current_time,
            'check_out'::TEXT,
            v_record.check_in_time,
            v_record.check_out_time,
            v_record.break_end_time,
            p_current_time;
    END IF;
END;
$$ LANGUAGE plpgsql; 