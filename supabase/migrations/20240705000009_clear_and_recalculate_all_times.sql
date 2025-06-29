-- First, clear all working time fields
UPDATE attendance
SET
    working_duration = '0h 00m',
    total_hours = 0,
    total_worked_time = '0 minutes'::interval;

-- Create function to calculate working time
CREATE OR REPLACE FUNCTION recalculate_working_time_v3(
    p_first_check_in timestamp with time zone,
    p_first_check_out timestamp with time zone
)
RETURNS TABLE (
    working_minutes integer,
    is_checked_out boolean
) AS $$
BEGIN
    -- If not checked out yet, return 0 minutes
    IF p_first_check_out IS NULL THEN
        RETURN QUERY SELECT 0::integer, false::boolean;
        RETURN;
    END IF;

    -- Calculate working time only if checked out
    RETURN QUERY SELECT 
        GREATEST(0, 
            EXTRACT(EPOCH FROM (p_first_check_out - p_first_check_in))/60
        )::integer,
        true::boolean;
END;
$$ LANGUAGE plpgsql;

-- Recalculate all attendance records
WITH calculations AS (
    SELECT 
        a.id,
        a.first_check_in_time,
        a.first_check_out_time,
        c.*
    FROM attendance a,
    LATERAL recalculate_working_time_v3(
        a.first_check_in_time,
        a.first_check_out_time
    ) c
)
UPDATE attendance a
SET
    working_duration = CASE 
        WHEN c.is_checked_out THEN
            CONCAT(
                FLOOR(c.working_minutes/60)::text,
                'h ',
                LPAD(MOD(c.working_minutes, 60)::text, 2, '0'),
                'm'
            )
        ELSE '0h 00m'
    END,
    total_hours = CASE 
        WHEN c.is_checked_out THEN c.working_minutes::float / 60
        ELSE 0
    END,
    total_worked_time = CASE 
        WHEN c.is_checked_out THEN (c.working_minutes || ' minutes')::interval
        ELSE '0 minutes'::interval
    END,
    status = CASE
        WHEN NOT c.is_checked_out THEN 'present'
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
DROP FUNCTION recalculate_working_time_v3; 