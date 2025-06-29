-- Add total_hours column to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS total_hours DECIMAL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_total_hours ON attendance(total_hours);

-- Add comment for documentation
COMMENT ON COLUMN attendance.total_hours IS 'Total hours worked in decimal format'; 