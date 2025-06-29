-- Add minutes_late column to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS minutes_late INTEGER DEFAULT 0;

-- Add a check constraint to ensure non-negative value
ALTER TABLE attendance
ADD CONSTRAINT check_minutes_late CHECK (minutes_late >= 0);

-- Add an index for performance optimization
CREATE INDEX IF NOT EXISTS idx_attendance_minutes_late ON attendance(minutes_late);

-- Update existing records with a default value
UPDATE attendance 
SET minutes_late = 0 
WHERE minutes_late IS NULL;

-- Add a comment for documentation
COMMENT ON COLUMN attendance.minutes_late IS 'Number of minutes an employee was late for check-in, 0 if on time'; 