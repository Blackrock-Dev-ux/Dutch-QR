-- Migration to support Double Check-In and Check-Out
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS first_check_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_check_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS second_check_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS second_check_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS break_duration INTERVAL DEFAULT '0 minutes',
ADD COLUMN IF NOT EXISTS total_worked_time INTERVAL DEFAULT '0 minutes',
ADD COLUMN IF NOT EXISTS last_action_time TIMESTAMPTZ;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_double_scan ON attendance(
    employee_id,
    date,
    first_check_in_time,
    first_check_out_time,
    second_check_in_time,
    second_check_out_time
);

-- Add comments to explain the new columns
COMMENT ON COLUMN attendance.first_check_in_time IS 'Timestamp of the first check-in for the day';
COMMENT ON COLUMN attendance.first_check_out_time IS 'Timestamp of the first check-out for the day';
COMMENT ON COLUMN attendance.second_check_in_time IS 'Timestamp of the second check-in for the day';
COMMENT ON COLUMN attendance.second_check_out_time IS 'Timestamp of the second check-out for the day';
COMMENT ON COLUMN attendance.break_duration IS 'Duration of break between first check-out and second check-in';
COMMENT ON COLUMN attendance.total_worked_time IS 'Total time worked (first session + second session)';
COMMENT ON COLUMN attendance.last_action_time IS 'Timestamp of the last attendance action to prevent rapid consecutive scans';