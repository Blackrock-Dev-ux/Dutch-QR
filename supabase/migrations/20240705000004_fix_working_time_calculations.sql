-- Reset working time related fields to ensure clean recalculation
UPDATE attendance
SET 
    working_duration = '0h 00m',
    total_hours = 0,
    break_duration = NULL,
    overtime = 0
WHERE id IS NOT NULL;

-- Create improved working time calculation function
CREATE OR REPLACE FUNCTION calculate_working_time()
RETURNS TRIGGER AS $$
DECLARE
    total_minutes INTEGER := 0;
    first_session INTEGER := 0;
    second_session INTEGER := 0;
    break_mins INTEGER := 0;
    standard_work_minutes INTEGER := 480; -- 8 hours in minutes
    break_duration_text TEXT;
BEGIN
    -- Calculate first session if complete
    IF NEW.first_check_in_time IS NOT NULL AND NEW.first_check_out_time IS NOT NULL THEN
        first_session := GREATEST(0, 
            EXTRACT(EPOCH FROM (NEW.first_check_out_time - NEW.first_check_in_time))/60
        );
    END IF;

    -- Calculate second session if complete
    IF NEW.second_check_in_time IS NOT NULL AND NEW.second_check_out_time IS NOT NULL THEN
        second_session := GREATEST(0,
            EXTRACT(EPOCH FROM (NEW.second_check_out_time - NEW.second_check_in_time))/60
        );
    END IF;

    -- Calculate break duration if exists
    IF NEW.break_duration IS NOT NULL THEN
        break_duration_text := NEW.break_duration::TEXT;
        
        IF break_duration_text ~ '^\d+$' THEN
            -- Plain number (assumed to be minutes)
            break_mins := break_duration_text::INTEGER;
        ELSIF break_duration_text ~ '^\d+m$' THEN
            -- Format: "30m"
            break_mins := (REGEXP_REPLACE(break_duration_text, 'm$', ''))::INTEGER;
        ELSIF break_duration_text ~ '^\d+h \d+m$' THEN
            -- Format: "1h 30m"
            break_mins := (
                (REGEXP_REPLACE(break_duration_text, 'h.*$', ''))::INTEGER * 60 +
                (REGEXP_REPLACE(break_duration_text, '^.*h ', ''))::INTEGER
            );
        ELSIF break_duration_text ~ '^\d+:\d+:\d+$' THEN
            -- Format: "HH:MM:SS"
            break_mins := EXTRACT(EPOCH FROM break_duration_text::interval)/60;
        END IF;
    END IF;

    -- Calculate total working minutes
    total_minutes := GREATEST(0, first_session + second_session - break_mins);

    -- Format working duration
    NEW.working_duration := 
        CONCAT(
            FLOOR(total_minutes/60)::TEXT,
            'h ',
            LPAD(MOD(total_minutes, 60)::TEXT, 2, '0'),
            'm'
        );

    -- Update total hours
    NEW.total_hours := total_minutes::FLOAT / 60;

    -- Calculate overtime (if total time > 8 hours)
    IF total_minutes > standard_work_minutes THEN
        NEW.overtime := (total_minutes - standard_work_minutes)::FLOAT / 60;
    ELSE
        NEW.overtime := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_working_time ON attendance;

-- Create new trigger
CREATE TRIGGER update_working_time
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_working_time();

-- Recalculate working times for all existing records
WITH calculated_times AS (
    SELECT 
        id,
        GREATEST(0,
            CASE 
                WHEN first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL THEN
                    EXTRACT(EPOCH FROM (first_check_out_time - first_check_in_time))/60
                ELSE 0
            END +
            CASE 
                WHEN second_check_in_time IS NOT NULL AND second_check_out_time IS NOT NULL THEN
                    EXTRACT(EPOCH FROM (second_check_out_time - second_check_in_time))/60
                ELSE 0
            END -
            CASE
                WHEN break_duration::TEXT ~ '^\d+$' THEN 
                    break_duration::TEXT::INTEGER
                WHEN break_duration::TEXT ~ '^\d+m$' THEN 
                    (REGEXP_REPLACE(break_duration::TEXT, 'm$', ''))::INTEGER
                WHEN break_duration::TEXT ~ '^\d+h \d+m$' THEN
                    (REGEXP_REPLACE(break_duration::TEXT, 'h.*$', ''))::INTEGER * 60 +
                    (REGEXP_REPLACE(break_duration::TEXT, '^.*h ', ''))::INTEGER
                WHEN break_duration::TEXT ~ '^\d+:\d+:\d+$' THEN
                    EXTRACT(EPOCH FROM break_duration::interval)/60
                ELSE 0
            END
        ) as total_minutes
    FROM attendance
)
UPDATE attendance a
SET
    working_duration = CONCAT(
        FLOOR(ct.total_minutes/60)::TEXT,
        'h ',
        LPAD(MOD(ct.total_minutes, 60)::TEXT, 2, '0'),
        'm'
    ),
    total_hours = ct.total_minutes::FLOAT / 60,
    overtime = CASE 
        WHEN ct.total_minutes > 480 THEN (ct.total_minutes - 480)::FLOAT / 60
        ELSE 0
    END
FROM calculated_times ct
WHERE a.id = ct.id;

-- Add constraints to ensure data integrity
ALTER TABLE attendance
DROP CONSTRAINT IF EXISTS check_working_duration_format;

ALTER TABLE attendance
ADD CONSTRAINT check_working_duration_format
CHECK (working_duration ~ '^\d+h \d{2}m$');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_working_time
ON attendance(working_duration, total_hours, overtime);

-- Add comment for documentation
COMMENT ON FUNCTION calculate_working_time() IS 'Calculates and updates working time metrics including duration, total hours, and overtime'; 