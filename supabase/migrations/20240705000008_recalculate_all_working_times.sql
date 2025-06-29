-- Create function to calculate working time
CREATE OR REPLACE FUNCTION calculate_working_time_v2(
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
        c.*
    FROM attendance a,
    LATERAL calculate_working_time_v2(
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

-- Drop the function
DROP FUNCTION calculate_working_time_v2;

-- Add some useful indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status); 