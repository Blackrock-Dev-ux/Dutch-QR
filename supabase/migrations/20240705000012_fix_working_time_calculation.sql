-- Create function to calculate working time
CREATE OR REPLACE FUNCTION calculate_realtime_working_time(
    p_first_check_in timestamp with time zone,
    p_first_check_out timestamp with time zone DEFAULT NULL,
    p_second_check_in timestamp with time zone DEFAULT NULL,
    p_second_check_out timestamp with time zone DEFAULT NULL,
    p_break_duration text DEFAULT NULL
)
RETURNS TABLE (
    working_minutes integer
) AS $$
DECLARE
    v_total_minutes integer := 0;
    v_break_minutes integer := 0;
BEGIN
    -- Calculate first session duration
    IF p_first_check_in IS NOT NULL THEN
        v_total_minutes := v_total_minutes + 
            EXTRACT(EPOCH FROM (
                COALESCE(p_first_check_out, CURRENT_TIMESTAMP) - 
                p_first_check_in
            ))/60;
    END IF;

    -- Calculate second session duration
    IF p_second_check_in IS NOT NULL THEN
        v_total_minutes := v_total_minutes + 
            EXTRACT(EPOCH FROM (
                COALESCE(p_second_check_out, CURRENT_TIMESTAMP) - 
                p_second_check_in
            ))/60;
    END IF;

    -- Calculate break duration if exists
    IF p_break_duration IS NOT NULL THEN
        IF p_break_duration ~ '^\d+$' THEN
            v_break_minutes := p_break_duration::INTEGER;
        ELSIF p_break_duration ~ '^\d+m$' THEN
            v_break_minutes := (REGEXP_REPLACE(p_break_duration, 'm$', ''))::INTEGER;
        ELSIF p_break_duration ~ '^\d+h \d+m$' THEN
            v_break_minutes := 
                (REGEXP_REPLACE(p_break_duration, 'h.*$', ''))::INTEGER * 60 +
                (REGEXP_REPLACE(p_break_duration, '^.*h ', ''))::INTEGER;
        END IF;
    END IF;

    -- Return total working minutes (minus break)
    RETURN QUERY SELECT GREATEST(0, v_total_minutes - v_break_minutes)::integer;
END;
$$ LANGUAGE plpgsql;

-- Update all attendance records
WITH calculations AS (
    SELECT 
        a.id,
        calculate_realtime_working_time(
            a.first_check_in_time,
            a.first_check_out_time,
            a.second_check_in_time,
            a.second_check_out_time,
            a.break_duration::text
        ) as working_minutes
    FROM attendance a
    WHERE a.first_check_in_time IS NOT NULL
)
UPDATE attendance a
SET
    working_duration = CONCAT(
        FLOOR(c.working_minutes/60)::text,
        'h ',
        LPAD(MOD(c.working_minutes, 60)::text, 2, '0'),
        'm'
    ),
    total_hours = c.working_minutes::float / 60,
    total_worked_time = (c.working_minutes || ' minutes')::interval
FROM calculations c
WHERE a.id = c.id;

-- Drop the function
DROP FUNCTION calculate_realtime_working_time; 