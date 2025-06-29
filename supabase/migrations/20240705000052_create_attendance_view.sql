-- Create a view for properly formatted attendance display
CREATE OR REPLACE VIEW attendance_display AS
SELECT 
    a.date,
    e.name as employee_name,
    a.first_check_in_time::time as first_check_in,
    a.first_check_out_time::time as first_check_out,
    a.second_check_in_time::time as second_check_in,
    a.second_check_out_time::time as second_check_out,
    CASE 
        WHEN a.first_check_out_time IS NOT NULL AND a.second_check_in_time IS NOT NULL THEN
            EXTRACT(EPOCH FROM (a.second_check_in_time - a.first_check_out_time))/3600
        ELSE 0
    END as break_duration_hours,
    CASE 
        WHEN a.second_check_out_time IS NOT NULL THEN
            EXTRACT(EPOCH FROM (
                (a.first_check_out_time - a.first_check_in_time) + 
                (a.second_check_out_time - a.second_check_in_time)
            ))/3600
        WHEN a.first_check_out_time IS NOT NULL THEN
            EXTRACT(EPOCH FROM (a.first_check_out_time - a.first_check_in_time))/3600
        ELSE 0
    END as working_duration_hours,
    a.status,
    CASE
        WHEN a.first_check_in_time IS NOT NULL THEN
            EXTRACT(EPOCH FROM (
                a.first_check_in_time - 
                (DATE_TRUNC('day', a.first_check_in_time) + INTERVAL '9 hours')
            ))/60
        ELSE 0
    END as late_duration_minutes
FROM attendance a
JOIN employees e ON a.employee_id = e.id; 