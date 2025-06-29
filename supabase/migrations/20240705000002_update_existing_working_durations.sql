-- Update all existing records to recalculate working duration
UPDATE attendance
SET working_duration = (
    SELECT 
        CONCAT(
            FLOOR(total_minutes/60)::TEXT, 
            'h ',
            LPAD(MOD(total_minutes, 60)::TEXT, 2, '0'),
            'm'
        )
    FROM (
        SELECT 
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
                END
            ) as total_minutes
    ) subquery
)
WHERE id IS NOT NULL;

-- Update total_hours field for all records
UPDATE attendance
SET total_hours = (
    SELECT total_minutes::FLOAT / 60
    FROM (
        SELECT 
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
                END
            ) as total_minutes
    ) subquery
)
WHERE id IS NOT NULL; 