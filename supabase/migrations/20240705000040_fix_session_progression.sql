-- Fix the valid_session_progression constraint to properly handle second sessions
ALTER TABLE attendance DROP CONSTRAINT valid_session_progression;

ALTER TABLE attendance ADD CONSTRAINT valid_session_progression CHECK (
    -- First session validation
    (is_second_session = false AND second_check_out_time IS NULL) OR
    -- Second session validation - requires first session data
    (is_second_session = true AND 
     first_check_in_time IS NOT NULL AND 
     first_check_out_time IS NOT NULL AND 
     second_check_in_time IS NOT NULL)
); 