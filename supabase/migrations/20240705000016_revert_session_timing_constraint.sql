-- First, drop the new constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_session_times;

-- Clean up invalid data
DO $$
BEGIN
    -- Fix records where second session times exist in first sessions
    UPDATE attendance
    SET 
        second_check_in_time = NULL,
        second_check_out_time = NULL
    WHERE (is_second_session = false OR is_second_session IS NULL);

    -- Fix records with invalid first session times
    UPDATE attendance
    SET 
        first_check_out_time = NULL
    WHERE first_check_in_time IS NULL 
    OR (first_check_out_time IS NOT NULL AND first_check_out_time <= first_check_in_time);

    -- Fix records with invalid second session times
    UPDATE attendance
    SET 
        is_second_session = false,
        second_check_in_time = NULL,
        second_check_out_time = NULL
    WHERE is_second_session = true 
    AND (
        first_check_in_time IS NULL 
        OR first_check_out_time IS NULL 
        OR first_check_out_time <= first_check_in_time
        OR second_check_in_time IS NULL
        OR second_check_in_time <= first_check_out_time
        OR (second_check_out_time IS NOT NULL AND second_check_out_time <= second_check_in_time)
    );

    -- Set default for NULL is_second_session
    UPDATE attendance
    SET is_second_session = false
    WHERE is_second_session IS NULL;
END $$;

-- Restore the original session times constraint with improved logic
ALTER TABLE attendance
ADD CONSTRAINT check_session_times
CHECK (
    CASE
        -- First session rules
        WHEN is_second_session = false OR is_second_session IS NULL THEN
            (second_check_in_time IS NULL AND
             second_check_out_time IS NULL AND
             first_check_in_time IS NOT NULL AND
             (first_check_out_time IS NULL OR first_check_out_time > first_check_in_time))
        -- Second session rules
        WHEN is_second_session = true THEN
            (first_check_in_time IS NOT NULL AND
             first_check_out_time IS NOT NULL AND
             first_check_out_time > first_check_in_time AND
             second_check_in_time IS NOT NULL AND
             second_check_in_time > first_check_out_time AND
             (second_check_out_time IS NULL OR second_check_out_time > second_check_in_time))
    END
); 