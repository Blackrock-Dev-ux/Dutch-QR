-- Add grace_period column to rosters table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'rosters'
        AND column_name = 'grace_period'
    ) THEN
        ALTER TABLE rosters
        ADD COLUMN grace_period INTEGER NOT NULL DEFAULT 15; -- Default 15 minutes grace period
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN rosters.grace_period IS 'Grace period in minutes before marking late';

-- Create index for potential queries
CREATE INDEX IF NOT EXISTS idx_rosters_grace_period ON rosters(grace_period); 