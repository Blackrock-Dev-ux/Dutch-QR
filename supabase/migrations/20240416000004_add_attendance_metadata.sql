-- Add new columns for enhanced attendance tracking
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS late_duration INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS device_info TEXT,
ADD COLUMN IF NOT EXISTS check_in_location TEXT DEFAULT 'office',
ADD COLUMN IF NOT EXISTS check_in_attempts INTEGER DEFAULT 1;

-- Add indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance(status);

-- Add check constraints
ALTER TABLE attendance
ADD CONSTRAINT check_late_duration CHECK (late_duration >= 0),
ADD CONSTRAINT check_check_in_attempts CHECK (check_in_attempts >= 1 AND check_in_attempts <= 3);

-- Add comments for documentation
COMMENT ON COLUMN attendance.late_duration IS 'Minutes late for check-in, 0 if on time';
COMMENT ON COLUMN attendance.device_info IS 'User agent or device information used for check-in';
COMMENT ON COLUMN attendance.check_in_location IS 'Location where check-in occurred';
COMMENT ON COLUMN attendance.check_in_attempts IS 'Number of attempts needed for successful check-in';

-- Update existing records
UPDATE attendance 
SET late_duration = 0,
    check_in_location = 'office',
    check_in_attempts = 1
WHERE late_duration IS NULL;
