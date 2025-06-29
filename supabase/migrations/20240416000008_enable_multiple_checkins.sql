-- Drop the unique constraint to allow multiple check-ins
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS unique_daily_attendance;

-- Add sequence number column to track multiple check-ins
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS sequence_number INTEGER DEFAULT 1;

-- Add check constraint to ensure sequence number is valid
ALTER TABLE attendance
ADD CONSTRAINT check_sequence_number CHECK (sequence_number >= 1 AND sequence_number <= 2);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_sequence ON attendance(employee_id, date, sequence_number);

-- Add comment for documentation
COMMENT ON COLUMN attendance.sequence_number IS 'Sequence number for multiple check-ins (1 or 2) per day'; 