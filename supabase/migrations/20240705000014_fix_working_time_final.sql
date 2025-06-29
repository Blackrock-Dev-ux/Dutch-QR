-- Drop any existing working time functions
DROP FUNCTION IF EXISTS calculate_working_time_v2;
DROP FUNCTION IF EXISTS calculate_current_working_time;
DROP FUNCTION IF EXISTS calculate_exact_working_time;
DROP FUNCTION IF EXISTS calculate_realtime_working_time;

-- Create a simple and reliable working time calculation function
CREATE OR REPLACE FUNCTION calculate_working_time(
    p_first_check_in timestamp with time zone,
    p_first_check_out timestamp with time zone,
    p_second_check_in timestamp with time zone DEFAULT NULL,
    p_second_check_out timestamp with time zone DEFAULT NULL,
    p_is_second_session boolean DEFAULT false
)
RETURNS TABLE (
    working_minutes integer,
    is_completed boolean
) AS $$
DECLARE
    v_total_minutes integer := 0;
BEGIN
    -- Calculate first session duration
    IF p_first_check_in IS NOT NULL AND p_first_check_out IS NOT NULL THEN
        v_total_minutes := v_total_minutes + 
            GREATEST(0, EXTRACT(EPOCH FROM (p_first_check_out - p_first_check_in))/60)::integer;
    END IF;

    -- Calculate second session duration if it exists and is marked as second session
    IF p_is_second_session AND p_second_check_in IS NOT NULL AND p_second_check_out IS NOT NULL THEN
        v_total_minutes := v_total_minutes + 
            GREATEST(0, EXTRACT(EPOCH FROM (p_second_check_out - p_second_check_in))/60)::integer;
    END IF;

    -- Return total working minutes and completion status
    RETURN QUERY SELECT 
        v_total_minutes,
        CASE 
            WHEN p_is_second_session THEN 
                p_first_check_out IS NOT NULL AND p_second_check_out IS NOT NULL
            ELSE 
                p_first_check_out IS NOT NULL
        END;
END;
$$ LANGUAGE plpgsql;

-- Update all attendance records with correct working time
WITH calculations AS (
    SELECT 
        a.id,
        c.*
    FROM attendance a,
    LATERAL calculate_working_time(
        a.first_check_in_time,
        a.first_check_out_time,
        a.second_check_in_time,
        a.second_check_out_time,
        a.is_second_session
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
        WHEN c.is_completed THEN 'checked_out'
        ELSE 'present'
    END
FROM calculations c
WHERE a.id = c.id;

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_attendance_check_times ON attendance(
    first_check_in_time,
    first_check_out_time,
    second_check_in_time,
    second_check_out_time
);

-- Add helpful comment
COMMENT ON FUNCTION calculate_working_time IS 
'Calculates working time between check-in and check-out timestamps for both first and second sessions.
Returns total working minutes and whether the session(s) are completed.';

-- Show the updated records for verification
SELECT 
    id,
    date,
    first_check_in_time,
    first_check_out_time,
    second_check_in_time,
    second_check_out_time,
    is_second_session,
    working_duration,
    total_hours,
    total_worked_time,
    status
FROM attendance
WHERE first_check_in_time IS NOT NULL
ORDER BY date DESC, first_check_in_time; 