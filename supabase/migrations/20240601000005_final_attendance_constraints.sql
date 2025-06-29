-- Comprehensive attendance record constraints
DO $$
DECLARE
    v_current_timestamp TIMESTAMPTZ := NOW();
    v_today DATE := CURRENT_DATE;
BEGIN
    -- Normalize existing records
    UPDATE attendance SET
        -- Ensure check_in_time is not null and is valid
        check_in_time = COALESCE(check_in_time, v_current_timestamp),
        
        -- Ensure date is set correctly
        date = COALESCE(date, v_today),
        
        -- Normalize check_out_time
        check_out_time = CASE 
            WHEN check_out_time IS NOT NULL AND check_out_time < check_in_time THEN NULL
            WHEN check_out_time > v_current_timestamp THEN NULL
            ELSE check_out_time
        END,
        
        -- Set default status if not set
        status = COALESCE(status, 'present'),
        
        -- Ensure sequence number is valid
        sequence_number = COALESCE(sequence_number, 1),
        
        -- Ensure late_duration is non-negative
        late_duration = GREATEST(COALESCE(late_duration, 0), 0);
END $$;

-- Drop existing constraints if they exist
DO $$
BEGIN
    -- Safely drop constraints
    BEGIN
        ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_valid_times;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'check_valid_times constraint not found';
    END;

    BEGIN
        ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_sequence_number;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'check_sequence_number constraint not found';
    END;

    BEGIN
        ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_late_duration;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'check_late_duration constraint not found';
    END;

    BEGIN
        ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_status;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'check_status constraint not found';
    END;
END $$;

-- Create robust constraints with more flexibility
ALTER TABLE attendance ADD CONSTRAINT check_valid_times CHECK (
    check_in_time IS NOT NULL AND 
    date IS NOT NULL AND 
    (check_out_time IS NULL OR 
     (check_out_time >= check_in_time AND check_out_time <= NOW())
    )
);

-- Ensure sequence number is within reasonable bounds
ALTER TABLE attendance ADD CONSTRAINT check_sequence_number CHECK (
    sequence_number >= 1 AND sequence_number <= 2
);

-- Validate late duration
ALTER TABLE attendance ADD CONSTRAINT check_late_duration CHECK (
    late_duration >= 0
);

-- Validate status
ALTER TABLE attendance ADD CONSTRAINT check_status CHECK (
    status IN ('present', 'late', 'half-day', 'checked-out', 'checked-out-overtime', 'early-departure')
); 