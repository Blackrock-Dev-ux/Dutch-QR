-- Update working duration calculation function
CREATE OR REPLACE FUNCTION calculate_working_duration()
RETURNS TRIGGER AS $$
DECLARE
    total_minutes INTEGER := 0;
    first_session INTEGER := 0;
    second_session INTEGER := 0;
BEGIN
    -- Calculate first session
    IF NEW.first_check_in_time IS NOT NULL AND NEW.first_check_out_time IS NOT NULL THEN
        first_session := EXTRACT(EPOCH FROM (NEW.first_check_out_time - NEW.first_check_in_time))/60;
    END IF;

    -- Calculate second session
    IF NEW.second_check_in_time IS NOT NULL AND NEW.second_check_out_time IS NOT NULL THEN
        second_session := EXTRACT(EPOCH FROM (NEW.second_check_out_time - NEW.second_check_in_time))/60;
    END IF;

    -- Calculate total minutes
    total_minutes := GREATEST(0, first_session + second_session);

    -- Format the working duration
    NEW.working_duration := 
        CONCAT(
            FLOOR(total_minutes/60)::TEXT, 
            'h ',
            LPAD(MOD(total_minutes, 60)::TEXT, 2, '0'),
            'm'
        );

    -- Update total_hours field
    NEW.total_hours := total_minutes::FLOAT / 60;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_working_duration ON attendance;

-- Create new trigger
CREATE TRIGGER update_working_duration
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION calculate_working_duration(); 