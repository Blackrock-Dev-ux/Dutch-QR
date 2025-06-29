-- Add missing columns to rosters table
DO $$ 
BEGIN
    -- Add name if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE rosters ADD COLUMN name VARCHAR(255);
    END IF;

    -- Add description if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'description'
    ) THEN
        ALTER TABLE rosters ADD COLUMN description TEXT;
    END IF;

    -- Add start_time if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'start_time'
    ) THEN
        ALTER TABLE rosters ADD COLUMN start_time TIME NOT NULL DEFAULT '09:00:00';
    END IF;

    -- Add end_time if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'end_time'
    ) THEN
        ALTER TABLE rosters ADD COLUMN end_time TIME NOT NULL DEFAULT '17:00:00';
    END IF;

    -- Add break_start if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'break_start'
    ) THEN
        ALTER TABLE rosters ADD COLUMN break_start TIME DEFAULT '13:00:00';
    END IF;

    -- Add break_end if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'break_end'
    ) THEN
        ALTER TABLE rosters ADD COLUMN break_end TIME DEFAULT '14:00:00';
    END IF;

    -- Add break_duration if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'break_duration'
    ) THEN
        ALTER TABLE rosters ADD COLUMN break_duration INTEGER NOT NULL DEFAULT 60;
    END IF;

    -- Add helpful comments
    COMMENT ON COLUMN rosters.name IS 'Name of the roster (e.g. Morning Shift, Night Shift)';
    COMMENT ON COLUMN rosters.description IS 'Detailed description of the roster';
    COMMENT ON COLUMN rosters.start_time IS 'Daily start time for the roster';
    COMMENT ON COLUMN rosters.end_time IS 'Daily end time for the roster';
    COMMENT ON COLUMN rosters.break_start IS 'Start time of the break period';
    COMMENT ON COLUMN rosters.break_end IS 'End time of the break period';
    COMMENT ON COLUMN rosters.break_duration IS 'Duration of break in minutes';

    -- Add check constraints
    ALTER TABLE rosters
    ADD CONSTRAINT check_break_times 
    CHECK (
        (break_start IS NULL AND break_end IS NULL) OR
        (break_start IS NOT NULL AND break_end IS NOT NULL AND break_start < break_end)
    );

    ALTER TABLE rosters
    ADD CONSTRAINT check_work_times
    CHECK (start_time < end_time);

    -- Add indexes for commonly queried columns
    CREATE INDEX IF NOT EXISTS idx_rosters_start_time ON rosters(start_time);
    CREATE INDEX IF NOT EXISTS idx_rosters_end_time ON rosters(end_time);
END $$; 