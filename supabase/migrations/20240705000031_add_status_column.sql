-- Add status column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE rosters 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

        -- Add check constraint
        ALTER TABLE rosters 
        ADD CONSTRAINT rosters_status_check 
        CHECK (status IN ('active', 'completed', 'upcoming'));

        -- Add index for status column
        CREATE INDEX IF NOT EXISTS idx_rosters_status ON rosters(status);
    END IF;
END $$; 