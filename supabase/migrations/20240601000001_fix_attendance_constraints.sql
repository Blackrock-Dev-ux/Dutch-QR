-- Remove existing constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_valid_times;

-- Add a more robust and flexible constraint
ALTER TABLE attendance ADD CONSTRAINT check_valid_times CHECK (
    check_in_time IS NOT NULL AND 
    check_in_time <= NOW() AND 
    (check_out_time IS NULL OR 
     (check_out_time >= check_in_time AND 
      check_out_time <= NOW() + INTERVAL '1 day'))
);

-- Optional: Update existing records to comply with the constraint
DO $$
BEGIN
    -- Remove invalid check-out times
    UPDATE attendance 
    SET check_out_time = NULL 
    WHERE check_out_time IS NOT NULL AND 
          (check_out_time < check_in_time OR check_out_time > NOW() + INTERVAL '1 day');

    -- Ensure check_in_time is not null and is valid
    UPDATE attendance 
    SET check_in_time = COALESCE(check_in_time, NOW())
    WHERE check_in_time IS NULL OR check_in_time > NOW();

    -- Ensure date matches check_in_time
    UPDATE attendance 
    SET date = DATE(check_in_time)
    WHERE date IS NULL OR date != DATE(check_in_time);
END $$;
