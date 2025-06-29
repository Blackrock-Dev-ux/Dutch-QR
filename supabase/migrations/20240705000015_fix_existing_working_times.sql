-- First, create a temporary table to store the original values for verification
CREATE TEMP TABLE original_working_times AS
SELECT 
    id,
    working_duration,
    total_hours,
    overtime
FROM attendance;

-- Update all attendance records with correct working time calculations
WITH time_calculations AS (
    SELECT 
        id,
        -- Calculate total minutes between check-in and check-out (or current time)
        GREATEST(0,
            -- First session
            CASE 
                WHEN first_check_in_time IS NOT NULL THEN
                    EXTRACT(EPOCH FROM (
                        COALESCE(first_check_out_time, CURRENT_TIMESTAMP) - 
                        first_check_in_time
                    ))/60 
                ELSE 0 
            END::INTEGER +
            -- Second session
            CASE 
                WHEN second_check_in_time IS NOT NULL THEN
                    EXTRACT(EPOCH FROM (
                        COALESCE(second_check_out_time, CURRENT_TIMESTAMP) - 
                        second_check_in_time
                    ))/60 
                ELSE 0 
            END::INTEGER -
            -- Break duration
            CASE
                WHEN break_duration::TEXT ~ '^\d+$' THEN 
                    break_duration::TEXT::INTEGER
                WHEN break_duration::TEXT ~ '^\d+m$' THEN 
                    (REGEXP_REPLACE(break_duration::TEXT, 'm$', ''))::INTEGER
                WHEN break_duration::TEXT ~ '^\d+h \d+m$' THEN
                    (REGEXP_REPLACE(break_duration::TEXT, 'h.*$', ''))::INTEGER * 60 +
                    (REGEXP_REPLACE(break_duration::TEXT, '^.*h ', ''))::INTEGER
                ELSE 0
            END
        ) as total_minutes,
        first_check_in_time,
        first_check_out_time,
        second_check_in_time,
        second_check_out_time,
        break_duration
    FROM attendance
    WHERE first_check_in_time IS NOT NULL
)
UPDATE attendance a
SET
    working_duration = CONCAT(
        FLOOR(t.total_minutes/60)::text,
        'h ',
        LPAD(MOD(t.total_minutes, 60)::text, 2, '0'),
        'm'
    ),
    total_hours = t.total_minutes::float / 60,
    overtime = CASE 
        WHEN t.total_minutes > 480 THEN (t.total_minutes - 480)::float / 60
        ELSE 0
    END
FROM time_calculations t
WHERE a.id = t.id;

-- Create a summary of changes
CREATE TEMP TABLE working_time_changes AS
SELECT 
    a.id,
    a.date,
    a.employee_id,
    o.working_duration as old_duration,
    a.working_duration as new_duration,
    o.total_hours as old_total_hours,
    a.total_hours as new_total_hours,
    o.overtime as old_overtime,
    a.overtime as new_overtime
FROM attendance a
JOIN original_working_times o ON a.id = o.id
WHERE 
    a.working_duration != o.working_duration OR
    a.total_hours != o.total_hours OR
    a.overtime != o.overtime;

-- Output summary of changes
SELECT 
    date,
    employee_id,
    old_duration,
    new_duration,
    ROUND((new_total_hours - old_total_hours)::numeric, 2) as hours_difference,
    ROUND((new_overtime - old_overtime)::numeric, 2) as overtime_difference
FROM working_time_changes
ORDER BY date DESC, employee_id;

-- Drop temporary tables
DROP TABLE original_working_times;
DROP TABLE working_time_changes; 