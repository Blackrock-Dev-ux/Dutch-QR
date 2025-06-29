-- Drop existing functions by querying system catalog
DO $$ 
DECLARE
    func_record RECORD;
BEGIN
    -- Find and drop all calculate_working_duration functions
    FOR func_record IN 
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc 
        WHERE proname = 'calculate_working_duration'
        AND pg_function_is_visible(oid)
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS calculate_working_duration(' || func_record.args || ') CASCADE';
    END LOOP;

    -- Drop trigger function
    DROP FUNCTION IF EXISTS update_attendance_durations() CASCADE;
END $$;

-- Create a function to calculate working duration with a unique name
CREATE OR REPLACE FUNCTION calculate_working_duration_v2(
    p_check_in_time TIMESTAMPTZ,
    p_check_out_time TIMESTAMPTZ
) RETURNS TABLE (
    duration_minutes INTEGER,
    duration_text TEXT
) AS $$
BEGIN
    IF p_check_out_time IS NULL THEN
        -- If no check-out time, calculate duration until now
        RETURN QUERY
        SELECT 
            GREATEST(EXTRACT(EPOCH FROM (NOW() - p_check_in_time))/60, 0)::INTEGER,
            (GREATEST(EXTRACT(EPOCH FROM (NOW() - p_check_in_time))/3600, 0)::INTEGER)::TEXT || 'h ' ||
            (MOD(GREATEST(EXTRACT(EPOCH FROM (NOW() - p_check_in_time))/60, 0)::INTEGER, 60))::TEXT || 'm';
    ELSE
        -- If check-out time exists, calculate duration between check-in and check-out
        RETURN QUERY
        SELECT 
            GREATEST(EXTRACT(EPOCH FROM (p_check_out_time - p_check_in_time))/60, 0)::INTEGER,
            (GREATEST(EXTRACT(EPOCH FROM (p_check_out_time - p_check_in_time))/3600, 0)::INTEGER)::TEXT || 'h ' ||
            (MOD(GREATEST(EXTRACT(EPOCH FROM (p_check_out_time - p_check_in_time))/60, 0)::INTEGER, 60))::TEXT || 'm';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to format duration
CREATE OR REPLACE FUNCTION format_duration(p_minutes INTEGER)
RETURNS TEXT AS $$
BEGIN
    RETURN (p_minutes / 60)::TEXT || 'h ' || (MOD(p_minutes, 60))::TEXT || 'm';
END;
$$ LANGUAGE plpgsql;

-- Create a function to update attendance durations
CREATE OR REPLACE FUNCTION update_attendance_durations()
RETURNS TRIGGER AS $$
DECLARE
    v_first_duration RECORD;
    v_second_duration RECORD;
    v_total_minutes INTEGER;
    v_break_minutes INTEGER;
BEGIN
    -- Calculate first session duration
    SELECT * INTO v_first_duration 
    FROM calculate_working_duration_v2(NEW.first_check_in_time, NEW.first_check_out_time);
    
    -- Set working duration for first session
    NEW.working_duration_minutes := v_first_duration.duration_minutes;
    NEW.working_duration := format_duration(v_first_duration.duration_minutes);

    -- For second sessions, add both durations
    IF NEW.is_second_session THEN
        -- Calculate second session duration
        SELECT * INTO v_second_duration 
        FROM calculate_working_duration_v2(NEW.second_check_in_time, NEW.second_check_out_time);
        
        -- Add second session duration
        NEW.working_duration_minutes := NEW.working_duration_minutes + v_second_duration.duration_minutes;
        NEW.working_duration := format_duration(NEW.working_duration_minutes);
            
        -- Calculate break duration only for second sessions
        IF NEW.second_check_in_time IS NOT NULL AND NEW.first_check_out_time IS NOT NULL THEN
            v_break_minutes := GREATEST(EXTRACT(EPOCH FROM (NEW.second_check_in_time - NEW.first_check_out_time))/60, 0)::INTEGER;
            NEW.break_duration_minutes := v_break_minutes;
            NEW.break_duration := format_duration(v_break_minutes);
        END IF;
    ELSE
        -- For first sessions, clear break duration
        NEW.break_duration_minutes := 0;
        NEW.break_duration := format_duration(0);
    END IF;

    -- Set total working duration (same as working duration for now)
    NEW.total_working_minutes := NEW.working_duration_minutes;
    NEW.total_working_duration := format_duration(NEW.total_working_minutes);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS update_durations_trigger ON attendance;
CREATE TRIGGER update_durations_trigger
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_durations();

-- Add helpful comments
COMMENT ON FUNCTION calculate_working_duration_v2 IS 
'Calculates working duration in minutes and formatted text between two timestamps';

COMMENT ON FUNCTION format_duration IS 
'Formats minutes into a human-readable duration string (e.g., "2h 30m")';

COMMENT ON FUNCTION update_attendance_durations IS 
'Updates all duration fields in attendance records based on check-in/out times';