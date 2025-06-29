-- Drop the problematic constraint
ALTER TABLE attendance DROP CONSTRAINT valid_session_progression;

-- Add the fixed constraint
ALTER TABLE attendance ADD CONSTRAINT valid_session_progression CHECK (
    -- For first session records
    (is_second_session = false) OR
    -- For second session records, only require first session data
    (is_second_session = true AND first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL)
); 