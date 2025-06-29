-- First, clear existing working time calculations
UPDATE attendance
SET
    working_duration = NULL,
    total_hours = NULL,
    total_worked_time = NULL
WHERE first_check_in_time IS NOT NULL;

-- Create function to calculate working time
CREATE OR REPLACE FUNCTION calculate_exact_working_time(
    p_first_check_in timestamp with time zone,
    p_first_check_out timestamp with time zone DEFAULT CURRENT_TIMESTAMP
)
RETURNS TABLE (
    working_minutes integer,
    is_ongoing boolean
) AS $$
BEGIN
    -- For any session (ongoing or completed), calculate exact time difference
    RETURN QUERY 
    SELECT 
        GREATEST(0, 
            EXTRACT(EPOCH FROM (
                COALESCE(p_first_check_out, CURRENT_TIMESTAMP) - 
                p_first_check_in
            ))/60
        )::integer,
        p_first_check_out IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Update all attendance records with correct working time
WITH calculations AS (
    SELECT 
        a.id,
        a.first_check_in_time,
        a.first_check_out_time,
        c.working_minutes,
        c.is_ongoing
    FROM attendance a,
    LATERAL calculate_exact_working_time(
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
        WHEN c.is_ongoing THEN 'present'
        ELSE 'checked_out'
    END
FROM calculations c
WHERE a.id = c.id;

-- Show the updated records for verification
SELECT 
    date,
    employee_id,
    first_check_in_time AT TIME ZONE 'UTC' as check_in,
    first_check_out_time AT TIME ZONE 'UTC' as check_out,
    working_duration,
    status
FROM attendance
WHERE first_check_in_time IS NOT NULL
ORDER BY date DESC, employee_id;

-- Drop the function
DROP FUNCTION calculate_exact_working_time; 