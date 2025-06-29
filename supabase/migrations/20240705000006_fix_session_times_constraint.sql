-- First drop the existing constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_session_times;

-- Clean up any invalid session data
UPDATE attendance
SET 
    second_check_in_time = NULL,
    second_check_out_time = NULL
WHERE is_second_session = false;

UPDATE attendance
SET 
    first_check_out_time = NULL
WHERE is_second_session = true AND first_check_in_time IS NULL;

-- Add a more flexible check_session_times constraint
ALTER TABLE attendance
ADD CONSTRAINT check_session_times
CHECK (
    -- For first sessions (is_second_session = false):
    -- - No second session times should be present
    (is_second_session = false AND 
     second_check_in_time IS NULL AND 
     second_check_out_time IS NULL)
    OR
    -- For second sessions (is_second_session = true):
    -- - Must have first_check_in_time
    -- - If first_check_out_time exists, it must be after first_check_in_time
    -- - If second_check_in_time exists, it must be after first_check_out_time
    -- - If second_check_out_time exists, it must be after second_check_in_time
    (is_second_session = true AND 
     first_check_in_time IS NOT NULL AND
     (first_check_out_time IS NULL OR first_check_out_time > first_check_in_time) AND
     (second_check_in_time IS NULL OR 
      (first_check_out_time IS NOT NULL AND second_check_in_time > first_check_out_time)) AND
     (second_check_out_time IS NULL OR 
      (second_check_in_time IS NOT NULL AND second_check_out_time > second_check_in_time))
    )
);

-- Add helpful comment
COMMENT ON CONSTRAINT check_session_times ON attendance IS 
'Ensures proper sequencing of check-in/out times for both first and second sessions'; 