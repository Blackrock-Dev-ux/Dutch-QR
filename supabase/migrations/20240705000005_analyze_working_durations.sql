-- Create a temporary table to store analysis results
CREATE TEMP TABLE duration_analysis AS
WITH attendance_analysis AS (
    SELECT 
        id,
        first_check_in_time,
        first_check_out_time,
        second_check_in_time,
        second_check_out_time,
        break_duration,
        working_duration,
        total_hours,
        -- Calculate expected duration for first session
        CASE 
            WHEN first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL THEN
                EXTRACT(EPOCH FROM (first_check_out_time - first_check_in_time))/3600
            ELSE 0
        END as first_session_hours,
        -- Calculate expected duration for second session
        CASE 
            WHEN second_check_in_time IS NOT NULL AND second_check_out_time IS NOT NULL THEN
                EXTRACT(EPOCH FROM (second_check_out_time - second_check_in_time))/3600
            ELSE 0
        END as second_session_hours,
        -- Parse break duration to hours
        CASE
            WHEN break_duration::TEXT ~ '^\d+$' THEN 
                (break_duration::TEXT::INTEGER)::FLOAT/60
            WHEN break_duration::TEXT ~ '^\d+m$' THEN 
                (REGEXP_REPLACE(break_duration::TEXT, 'm$', ''))::FLOAT/60
            WHEN break_duration::TEXT ~ '^\d+h \d+m$' THEN
                (REGEXP_REPLACE(break_duration::TEXT, 'h.*$', ''))::FLOAT + 
                (REGEXP_REPLACE(break_duration::TEXT, '^.*h ', ''))::FLOAT/60
            WHEN break_duration::TEXT ~ '^\d+:\d+:\d+$' THEN
                EXTRACT(EPOCH FROM break_duration::interval)/3600
            ELSE 0
        END as break_hours,
        -- Parse current working_duration to hours
        CASE
            WHEN working_duration ~ '^\d+h \d{2}m$' THEN
                (REGEXP_REPLACE(working_duration, 'h.*$', ''))::FLOAT + 
                (REGEXP_REPLACE(working_duration, '^.*h ', ''))::FLOAT/60
            ELSE 0
        END as current_working_hours
    FROM attendance
)
SELECT 
    id,
    first_check_in_time,
    first_check_out_time,
    second_check_in_time,
    second_check_out_time,
    break_duration,
    working_duration as current_working_duration,
    total_hours as current_total_hours,
    first_session_hours,
    second_session_hours,
    break_hours,
    current_working_hours,
    -- Calculate expected total hours
    GREATEST(0, first_session_hours + second_session_hours - break_hours) as expected_total_hours,
    -- Flag records with discrepancies
    CASE
        WHEN ABS(total_hours - GREATEST(0, first_session_hours + second_session_hours - break_hours)) > 0.016 THEN true
        ELSE false
    END as has_discrepancy,
    -- Identify specific issues
    CASE
        WHEN first_check_in_time IS NULL THEN 'Missing check-in time'
        WHEN first_check_out_time IS NULL AND second_check_in_time IS NOT NULL THEN 'Missing first check-out'
        WHEN second_check_in_time IS NULL AND second_check_out_time IS NOT NULL THEN 'Missing second check-in'
        WHEN ABS(total_hours - GREATEST(0, first_session_hours + second_session_hours - break_hours)) > 0.016 THEN 'Incorrect duration calculation'
        WHEN working_duration !~ '^\d+h \d{2}m$' THEN 'Invalid duration format'
        ELSE 'OK'
    END as issue_type
FROM attendance_analysis;

-- Output analysis results
SELECT 
    issue_type,
    COUNT(*) as count,
    ROUND(AVG(ABS(current_total_hours - expected_total_hours))::numeric, 2) as avg_hour_difference
FROM duration_analysis
GROUP BY issue_type
ORDER BY count DESC;

-- Show detailed information for records with issues
SELECT 
    id,
    first_check_in_time,
    first_check_out_time,
    second_check_in_time,
    second_check_out_time,
    break_duration,
    current_working_duration,
    current_total_hours,
    ROUND(expected_total_hours::numeric, 2) as expected_total_hours,
    issue_type
FROM duration_analysis
WHERE has_discrepancy = true
ORDER BY first_check_in_time DESC
LIMIT 20;

-- Create a function to fix incorrect durations
CREATE OR REPLACE FUNCTION fix_working_durations()
RETURNS void AS $$
DECLARE
    fixed_count INTEGER := 0;
BEGIN
    -- Update records with incorrect calculations
    WITH calculated_times AS (
        SELECT 
            id,
            GREATEST(0,
                CASE 
                    WHEN first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (first_check_out_time - first_check_in_time))/60
                    ELSE 0
                END +
                CASE 
                    WHEN second_check_in_time IS NOT NULL AND second_check_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (second_check_out_time - second_check_in_time))/60
                    ELSE 0
                END -
                CASE
                    WHEN break_duration::TEXT ~ '^\d+$' THEN 
                        break_duration::TEXT::INTEGER
                    WHEN break_duration::TEXT ~ '^\d+m$' THEN 
                        (REGEXP_REPLACE(break_duration::TEXT, 'm$', ''))::INTEGER
                    WHEN break_duration::TEXT ~ '^\d+h \d+m$' THEN
                        (REGEXP_REPLACE(break_duration::TEXT, 'h.*$', ''))::INTEGER * 60 +
                        (REGEXP_REPLACE(break_duration::TEXT, '^.*h ', ''))::INTEGER
                    WHEN break_duration::TEXT ~ '^\d+:\d+:\d+$' THEN
                        EXTRACT(EPOCH FROM break_duration::interval)/60
                    ELSE 0
                END
            ) as total_minutes
        FROM attendance
        WHERE id IN (SELECT id FROM duration_analysis WHERE has_discrepancy = true)
    )
    UPDATE attendance a
    SET
        working_duration = CONCAT(
            FLOOR(ct.total_minutes/60)::TEXT,
            'h ',
            LPAD(MOD(ct.total_minutes, 60)::TEXT, 2, '0'),
            'm'
        ),
        total_hours = ct.total_minutes::FLOAT / 60,
        overtime = CASE 
            WHEN ct.total_minutes > 480 THEN (ct.total_minutes - 480)::FLOAT / 60
            ELSE 0
        END
    FROM calculated_times ct
    WHERE a.id = ct.id;

    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE 'Fixed % records with incorrect working durations', fixed_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the fix function
SELECT fix_working_durations(); 