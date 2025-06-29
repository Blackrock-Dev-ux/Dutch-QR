-- Create function to calculate working time
CREATE OR REPLACE FUNCTION calculate_current_working_time(
    p_first_check_in timestamp with time zone,
    p_first_check_out timestamp with time zone
)
RETURNS TABLE (
    working_minutes integer
) AS $$
BEGIN
    -- For ongoing sessions, calculate time between check-in and current time
    IF p_first_check_out IS NULL THEN
        RETURN QUERY SELECT 
            GREATEST(0, 
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p_first_check_in))/60
            )::integer;
        RETURN;
    END IF;

    -- For completed sessions, calculate time between check-in and check-out
    RETURN QUERY SELECT 
        GREATEST(0, 
            EXTRACT(EPOCH FROM (p_first_check_out - p_first_check_in))/60
        )::integer;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all attendance records
WITH calculations AS (
    SELECT 
        a.id,
        a.first_check_in_time,
        a.first_check_out_time,
        c.working_minutes
    FROM attendance a,
    LATERAL calculate_current_working_time(
        a.first_check_in_time,
        a.first_check_out_time
    ) c
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
    total_worked_time = (c.working_minutes || ' minutes')::interval,
    status = CASE
        WHEN a.first_check_out_time IS NULL THEN 'present'
        ELSE 'checked_out'
    END
FROM calculations c
WHERE a.id = c.id;

-- Add an analysis query to show the results
WITH analysis AS (
    SELECT 
        date,
        employee_id,
        first_check_in_time,
        first_check_out_time,
        working_duration,
        status
    FROM attendance
    WHERE first_check_in_time IS NOT NULL
    ORDER BY date DESC, employee_id
)
SELECT * FROM analysis;

-- Drop the function
DROP FUNCTION calculate_current_working_time; 