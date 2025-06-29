-- Add duration columns if they don't exist
ALTER TABLE attendance 
    ADD COLUMN IF NOT EXISTS working_duration_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS working_duration TEXT DEFAULT '0h 0m',
    ADD COLUMN IF NOT EXISTS total_working_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_working_duration TEXT DEFAULT '0h 0m',
    ADD COLUMN IF NOT EXISTS break_duration_minutes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS break_duration TEXT DEFAULT '0h 0m';

-- Update existing records to have valid duration values
UPDATE attendance
SET 
    working_duration_minutes = COALESCE(working_duration_minutes, 0),
    total_working_minutes = COALESCE(total_working_minutes, 0),
    break_duration_minutes = COALESCE(break_duration_minutes, 0);

-- Update text fields separately
UPDATE attendance
SET 
    working_duration = '0h 0m',
    total_working_duration = '0h 0m',
    break_duration = '0h 0m'
WHERE working_duration IS NULL 
   OR total_working_duration IS NULL 
   OR break_duration IS NULL;