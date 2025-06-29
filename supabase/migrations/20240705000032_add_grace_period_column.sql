-- Add grace_period column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'grace_period'
    ) THEN
        -- Add grace_period column with a default of 15 minutes (in minutes)
        ALTER TABLE rosters 
        ADD COLUMN grace_period INTEGER NOT NULL DEFAULT 15;

        -- Add check constraint to ensure grace_period is non-negative
        ALTER TABLE rosters 
        ADD CONSTRAINT rosters_grace_period_check 
        CHECK (grace_period >= 0);

        -- Add comment for documentation
        COMMENT ON COLUMN rosters.grace_period IS 'Grace period in minutes for late check-ins';
    END IF;
END $$; 