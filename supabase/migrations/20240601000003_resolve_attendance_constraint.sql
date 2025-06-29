-- Resolve check_valid_times constraint violations
DO $$
BEGIN
    -- Remove invalid check-out times that are before check-in times
    UPDATE attendance 
    SET check_out_time = NULL 
    WHERE check_out_time IS NOT NULL AND check_out_time < check_in_time;

    -- Ensure check_in_time is not null
    UPDATE attendance 
    SET check_in_time = NOW() 
    WHERE check_in_time IS NULL;

    -- Ensure date matches check_in_time
    UPDATE attendance 
    SET date = DATE(check_in_time) 
    WHERE date IS NULL OR date != DATE(check_in_time);
END $$;

-- Recreate the constraint with more flexible validation
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_valid_times;
ALTER TABLE attendance ADD CONSTRAINT check_valid_times CHECK (
    check_in_time IS NOT NULL AND 
    (check_out_time IS NULL OR check_out_time >= check_in_time)
); 