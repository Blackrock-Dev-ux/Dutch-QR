-- Add second check-in/out time fields to attendance table
DO $$ 
BEGIN
    -- Add second_check_in_time if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'attendance' 
        AND column_name = 'second_check_in_time'
    ) THEN
        ALTER TABLE attendance 
        ADD COLUMN second_check_in_time TIMESTAMPTZ,
        ADD COLUMN second_check_out_time TIMESTAMPTZ,
        ADD COLUMN is_second_session BOOLEAN DEFAULT false,
        ADD COLUMN sequence_number INTEGER DEFAULT 1;
    END IF;

    -- Drop the unique constraint if it exists
    ALTER TABLE attendance 
    DROP CONSTRAINT IF EXISTS unique_daily_attendance;

    -- Add a new constraint that considers sequence number
    ALTER TABLE attendance 
    ADD CONSTRAINT unique_daily_attendance_sequence 
    UNIQUE (employee_id, date, sequence_number);

END $$; 