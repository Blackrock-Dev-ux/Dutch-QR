-- Drop existing session times constraint and triggers
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_session_times;
DROP TRIGGER IF EXISTS session_validation_trigger ON attendance;
DROP FUNCTION IF EXISTS validate_session_record();

-- Comprehensive data cleanup
DO $$
BEGIN
    -- Step 1: Fix records with NULL is_second_session
    UPDATE attendance
    SET 
        is_second_session = false,
        previous_session_id = NULL
    WHERE is_second_session IS NULL;

    -- Step 2: Clean up first session records
    UPDATE attendance
    SET 
        second_check_in_time = NULL,
        second_check_out_time = NULL,
        previous_session_id = NULL
    WHERE is_second_session = false;

    -- Step 3: Ensure first_check_in_time is set
    UPDATE attendance
    SET first_check_in_time = check_in_time
    WHERE first_check_in_time IS NULL AND check_in_time IS NOT NULL;

    -- Step 4: Fix second session records that are invalid
    WITH invalid_seconds AS (
        SELECT id 
        FROM attendance 
        WHERE is_second_session = true 
        AND (first_check_in_time IS NULL OR first_check_out_time IS NULL)
    )
    UPDATE attendance a
    SET 
        is_second_session = false,
        previous_session_id = NULL,
        second_check_in_time = NULL,
        second_check_out_time = NULL
    FROM invalid_seconds i
    WHERE a.id = i.id;

    -- Step 5: Clean up invalid second sessions
    WITH invalid_seconds AS (
        SELECT id 
        FROM attendance 
        WHERE is_second_session = true 
        AND second_check_in_time IS NULL
    )
    UPDATE attendance a
    SET 
        is_second_session = false,
        previous_session_id = NULL,
        second_check_in_time = NULL,
        second_check_out_time = NULL
    FROM invalid_seconds i
    WHERE a.id = i.id;

    -- Step 6: Ensure proper check-in/check-out times
    UPDATE attendance
    SET 
        check_in_time = first_check_in_time
    WHERE check_in_time IS NULL AND first_check_in_time IS NOT NULL;

    UPDATE attendance
    SET 
        check_out_time = CASE
            WHEN second_check_out_time IS NOT NULL THEN second_check_out_time
            ELSE first_check_out_time
        END
    WHERE check_out_time IS NULL 
    AND (first_check_out_time IS NOT NULL OR second_check_out_time IS NOT NULL);
END $$;

-- Create new session validation function
CREATE OR REPLACE FUNCTION validate_session_record()
RETURNS TRIGGER AS $$
BEGIN
    -- For second sessions, ensure previous_session_id is set
    IF NEW.is_second_session = true AND NEW.previous_session_id IS NULL THEN
        RAISE EXCEPTION 'Second session records must reference a previous session';
    END IF;

    -- For first sessions, ensure no previous_session_id
    IF NEW.is_second_session = false AND NEW.previous_session_id IS NOT NULL THEN
        -- Instead of raising an exception, just clear the previous_session_id
        NEW.previous_session_id := NULL;
    END IF;

    -- For second sessions, validate the previous session exists and is completed
    IF NEW.is_second_session = true AND NEW.previous_session_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM attendance 
            WHERE id = NEW.previous_session_id 
            AND is_second_session = false
            AND first_check_out_time IS NOT NULL
        ) THEN
            RAISE EXCEPTION 'Previous session must exist and be completed';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session validation
CREATE TRIGGER session_validation_trigger
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION validate_session_record();

-- Add new check_session_times constraint with proper NULL handling
ALTER TABLE attendance
ADD CONSTRAINT check_session_times
CHECK (
    CASE
        -- First session rules
        WHEN is_second_session = false OR is_second_session IS NULL THEN
            (second_check_in_time IS NULL AND
             second_check_out_time IS NULL AND
             first_check_in_time IS NOT NULL)
        -- Second session rules
        WHEN is_second_session = true THEN
            (first_check_in_time IS NOT NULL AND
             first_check_out_time IS NOT NULL AND
             second_check_in_time IS NOT NULL)
    END
);

-- Create function to handle session initialization
CREATE OR REPLACE FUNCTION initialize_session_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- For new records
    IF TG_OP = 'INSERT' THEN
        -- Set default values for first session
        IF NEW.is_second_session IS NULL THEN
            NEW.is_second_session := false;
        END IF;

        IF NEW.is_second_session = false THEN
            NEW.second_check_in_time := NULL;
            NEW.second_check_out_time := NULL;
            NEW.previous_session_id := NULL;
        END IF;
        
        -- Ensure first_check_in_time is set
        IF NEW.first_check_in_time IS NULL AND NEW.check_in_time IS NOT NULL THEN
            NEW.first_check_in_time := NEW.check_in_time;
        END IF;

        -- Ensure check_in_time is set
        IF NEW.check_in_time IS NULL AND NEW.first_check_in_time IS NOT NULL THEN
            NEW.check_in_time := NEW.first_check_in_time;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for session initialization
DROP TRIGGER IF EXISTS session_initialization_trigger ON attendance;
CREATE TRIGGER session_initialization_trigger
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION initialize_session_fields();

-- Add helpful comment
COMMENT ON CONSTRAINT check_session_times ON attendance IS 
'Ensures proper session state and field values for both first and second sessions'; 