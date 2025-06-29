-- Drop the existing unique constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance;

-- Add a new unique constraint that considers session information
ALTER TABLE attendance ADD CONSTRAINT unique_daily_session_attendance 
    UNIQUE (employee_id, date, is_second_session);

-- Add a check constraint to ensure proper session progression
ALTER TABLE attendance ADD CONSTRAINT valid_session_progression CHECK (
    (is_second_session = false AND second_check_in_time IS NULL AND second_check_out_time IS NULL) OR
    (is_second_session = true AND first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL)
); 