-- Comprehensive fix for attendance record constraints
DO $$
DECLARE
    v_current_timestamp TIMESTAMPTZ := NOW();
BEGIN
    -- Step 1: Normalize existing records
    UPDATE attendance SET
        -- Ensure check_in_time is not null and is not in the future
        check_in_time = COALESCE(check_in_time, v_current_timestamp),
        
        -- Ensure date matches check_in_time
        date = DATE(COALESCE(check_in_time, v_current_timestamp)),
        
        -- Normalize check_out_time
        check_out_time = CASE 
            WHEN check_out_time IS NOT NULL AND check_out_time < check_in_time THEN NULL
            WHEN check_out_time > v_current_timestamp THEN NULL
            ELSE check_out_time
        END,
        
        -- Reset status if check_out_time is invalid
        status = CASE 
            WHEN check_out_time IS NULL THEN 'present'
            ELSE status
        END,
        
        -- Ensure sequence number is valid
        sequence_number = COALESCE(sequence_number, 1),
        
        -- Ensure late_duration is non-negative
        late_duration = GREATEST(COALESCE(late_duration, 0), 0);
END $$;

-- Drop existing constraints
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_valid_times;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_sequence_number;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_late_duration;

-- Create robust constraints
ALTER TABLE attendance ADD CONSTRAINT check_valid_times CHECK (
    check_in_time IS NOT NULL AND 
    check_in_time <= NOW() AND 
    (check_out_time IS NULL OR 
     (check_out_time >= check_in_time AND check_out_time <= NOW())
    )
);

ALTER TABLE attendance ADD CONSTRAINT check_sequence_number CHECK (
    sequence_number >= 1 AND sequence_number <= 2
);

ALTER TABLE attendance ADD CONSTRAINT check_late_duration CHECK (
    late_duration >= 0
); 