-- Comprehensive update to attendance table schema
DO $$
BEGIN
    -- Add early_departure column if not exists
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='attendance' AND column_name='early_departure'
    ) THEN
        ALTER TABLE attendance 
        ADD COLUMN early_departure BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add overtime column if not exists
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='attendance' AND column_name='overtime'
    ) THEN
        ALTER TABLE attendance 
        ADD COLUMN overtime NUMERIC(10,2) NOT NULL DEFAULT 0;
    END IF;

    -- Add total_hours column if not exists
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='attendance' AND column_name='total_hours'
    ) THEN
        ALTER TABLE attendance 
        ADD COLUMN total_hours NUMERIC(10,2);
    END IF;

    -- Ensure status column has correct type and constraints
    BEGIN
        ALTER TABLE attendance 
        ALTER COLUMN status TYPE VARCHAR(30) 
        USING status::VARCHAR(30);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not modify status column type';
    END;

    -- Update status constraint
    BEGIN
        ALTER TABLE attendance 
        DROP CONSTRAINT IF EXISTS check_status;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop check_status constraint';
    END;

    BEGIN
        ALTER TABLE attendance 
        ADD CONSTRAINT check_status CHECK (
            status IN (
                'present', 
                'late', 
                'half-day', 
                'checked-out', 
                'checked-out-overtime', 
                'early-departure'
            )
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add check_status constraint';
    END;
END $$;

-- Add comments to explain new columns
COMMENT ON COLUMN attendance.early_departure IS 
'Indicates whether the employee left work before the standard end of the workday';

COMMENT ON COLUMN attendance.overtime IS 
'Number of additional hours worked beyond standard work hours';

COMMENT ON COLUMN attendance.total_hours IS 
'Total hours worked in the day'; 