-- Drop the old unique constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS unique_daily_attendance;

-- Add new columns for the enhanced attendance system
ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS first_check_in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_check_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS second_check_in_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS second_check_out_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS minutes_late INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_duration TEXT,
  ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS break_duration TEXT,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_second_session BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS overtime INTEGER DEFAULT 0;

-- Update existing records to use first_check_in_time
UPDATE attendance 
SET first_check_in_time = check_in_time 
WHERE first_check_in_time IS NULL AND check_in_time IS NOT NULL;

-- Add new unique constraint that allows multiple sessions per day
ALTER TABLE attendance 
  DROP CONSTRAINT IF EXISTS unique_daily_attendance_session,
  ADD CONSTRAINT unique_daily_attendance_session 
    UNIQUE (employee_id, date, sequence_number);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_check_times 
  ON attendance(first_check_in_time, first_check_out_time, second_check_in_time, second_check_out_time);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date_seq 
  ON attendance(employee_id, date, sequence_number); 