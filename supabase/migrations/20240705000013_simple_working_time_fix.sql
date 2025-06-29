-- First, clear all working time fields to ensure clean state
UPDATE attendance
SET
    working_duration = NULL,
    total_hours = NULL,
    total_worked_time = NULL
WHERE first_check_in_time IS NOT NULL;

-- Direct update of working time for all records
WITH time_calculations AS (
    SELECT 
        id,
        -- Calculate total minutes between check-in and check-out (or current time)
        EXTRACT(EPOCH FROM (
            COALESCE(first_check_out_time, CURRENT_TIMESTAMP) - 
            first_check_in_time
        ))/60::integer as minutes_worked
    FROM attendance
    WHERE first_check_in_time IS NOT NULL
)
UPDATE attendance a
SET
    working_duration = CONCAT(
        FLOOR(t.minutes_worked/60)::text, 
        'h ',
        LPAD(MOD(t.minutes_worked, 60)::text, 2, '0'),
        'm'
    ),
    total_hours = t.minutes_worked::float / 60,
    total_worked_time = (t.minutes_worked || ' minutes')::interval
FROM time_calculations t
WHERE a.id = t.id;

-- Show the updated records for verification
SELECT 
    id,
    date,
    first_check_in_time,
    first_check_out_time,
    working_duration,
    total_hours,
    total_worked_time
FROM attendance
WHERE first_check_in_time IS NOT NULL
ORDER BY date DESC, first_check_in_time; 