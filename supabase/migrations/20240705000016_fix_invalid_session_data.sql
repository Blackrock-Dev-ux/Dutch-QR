-- First, drop the existing constraint, trigger, and unique index to allow data cleanup
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_session_times;
DROP TRIGGER IF EXISTS session_validation_trigger ON attendance;
DROP INDEX IF EXISTS unique_employee_date_session_checkin;

-- Clean up invalid session data
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- Fix first session records (is_second_session = false or NULL)
    UPDATE attendance
    SET 
        second_check_in_time = NULL,
        second_check_out_time = NULL
    WHERE (is_second_session = false OR is_second_session IS NULL);

    -- Delete ALL duplicate records, keeping only the earliest record for each employee/date/check-in combination
    WITH duplicates AS (
        SELECT DISTINCT ON (employee_id, date, check_in_time)
            id,
            employee_id,
            date,
            check_in_time,
            created_at
        FROM attendance
        ORDER BY 
            employee_id, 
            date, 
            check_in_time, 
            created_at ASC
    )
    DELETE FROM attendance a
    WHERE NOT EXISTS (
        SELECT 1 
        FROM duplicates d 
        WHERE d.id = a.id
    )
    AND EXISTS (
        SELECT 1 
        FROM attendance b 
        WHERE b.employee_id = a.employee_id 
        AND b.date = a.date 
        AND b.check_in_time = a.check_in_time 
        AND b.id != a.id
    );

    -- Reset all session flags and data
    UPDATE attendance
    SET 
        is_second_session = false,
        second_check_in_time = NULL,
        second_check_out_time = NULL,
        previous_session_id = NULL;

    -- Ensure first_check_in_time is set from check_in_time
    UPDATE attendance
    SET first_check_in_time = check_in_time
    WHERE first_check_in_time IS NULL AND check_in_time IS NOT NULL;

    -- Ensure first_check_out_time is set from check_out_time for first sessions
    UPDATE attendance
    SET first_check_out_time = check_out_time
    WHERE first_check_out_time IS NULL 
    AND check_out_time IS NOT NULL 
    AND is_second_session = false;

    -- Mark valid second sessions
    WITH valid_second_sessions AS (
        SELECT a2.id
        FROM attendance a2
        JOIN attendance a1 ON 
            a1.employee_id = a2.employee_id AND
            a1.date = a2.date AND
            a1.check_in_time < a2.check_in_time AND
            a1.first_check_out_time IS NOT NULL
        WHERE NOT EXISTS (
            SELECT 1
            FROM attendance a3
            WHERE a3.employee_id = a2.employee_id
            AND a3.date = a2.date
            AND a3.check_in_time > a1.check_in_time
            AND a3.check_in_time < a2.check_in_time
        )
    )
    UPDATE attendance a
    SET 
        is_second_session = true,
        second_check_in_time = check_in_time,
        second_check_out_time = check_out_time,
        first_check_out_time = NULL  -- Clear first session check-out for second sessions
    FROM valid_second_sessions v
    WHERE a.id = v.id;

    -- Verify no invalid records exist
    SELECT COUNT(*) INTO invalid_count
    FROM attendance
    WHERE (
        -- Check first session rules
        (is_second_session = false AND (
            second_check_in_time IS NOT NULL OR
            second_check_out_time IS NOT NULL OR
            first_check_in_time IS NULL
        )) OR
        -- Check second session rules
        (is_second_session = true AND (
            first_check_in_time IS NULL OR
            first_check_out_time IS NULL OR
            second_check_in_time IS NULL
        ))
    );

    -- If invalid records found, fix them
    IF invalid_count > 0 THEN
        -- Convert any remaining invalid records to first sessions
        UPDATE attendance
        SET 
            is_second_session = false,
            second_check_in_time = NULL,
            second_check_out_time = NULL,
            previous_session_id = NULL
        WHERE (
            (is_second_session = false AND (
                second_check_in_time IS NOT NULL OR
                second_check_out_time IS NOT NULL OR
                first_check_in_time IS NULL
            )) OR
            (is_second_session = true AND (
                first_check_in_time IS NULL OR
                first_check_out_time IS NULL OR
                second_check_in_time IS NULL
            ))
        );
    END IF;
END $$;

-- Recreate the unique index
CREATE UNIQUE INDEX unique_employee_date_session_checkin 
ON attendance (employee_id, date, is_second_session, check_in_time) 
WHERE check_in_time IS NOT NULL;

-- Recreate the session validation trigger
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

-- Now add back the constraint
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