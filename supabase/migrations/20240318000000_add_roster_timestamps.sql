-- Add assignment_time and completion_time columns to rosters table
ALTER TABLE rosters
ADD COLUMN IF NOT EXISTS assignment_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completion_time TIMESTAMP WITH TIME ZONE; 