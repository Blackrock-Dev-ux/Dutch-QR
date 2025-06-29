-- First, create a function to safely convert break duration to minutes
CREATE OR REPLACE FUNCTION convert_break_to_minutes(break_text TEXT)
RETURNS INTEGER AS $$
BEGIN
    -- Handle NULL case
    IF break_text IS NULL THEN
        RETURN 0;
    END IF;

    -- Handle different formats
    IF break_text ~ '^\d+$' THEN
        -- Plain number (assumed to be minutes)
        RETURN break_text::INTEGER;
    ELSIF break_text ~ '^\d+m$' THEN
        -- Format: "30m"
        RETURN SUBSTRING(break_text FROM '(\d+)m')::INTEGER;
    ELSIF break_text ~ '^\d+h \d+m$' THEN
        -- Format: "1h 30m"
        RETURN 
            (SUBSTRING(break_text FROM '(\d+)h')::INTEGER * 60) +
            (SUBSTRING(break_text FROM 'h (\d+)m')::INTEGER);
    ELSIF break_text ~ '^\d+:\d+:\d+$' THEN
        -- Format: "HH:MM:SS"
        RETURN EXTRACT(EPOCH FROM break_text::interval)::INTEGER / 60;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Update all records with incorrect working durations
WITH time_calculations AS (
    SELECT 
        id,
        -- Calculate total minutes worked
        GREATEST(0,
            -- First session
            CASE 
                WHEN first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (first_check_out_time - first_check_in_time))/60 
                ELSE 0 
            END::INTEGER +
            -- Second session
            CASE 
                WHEN second_check_in_time IS NOT NULL AND second_check_out_time IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (second_check_out_time - second_check_in_time))/60 
                ELSE 0 
            END::INTEGER -
            -- Break duration
            convert_break_to_minutes(break_duration::TEXT)
        ) as total_minutes
    FROM attendance
)
UPDATE attendance a
SET
    working_duration = CONCAT(
        FLOOR(tc.total_minutes/60)::TEXT, 
        'h ',
        LPAD(MOD(tc.total_minutes, 60)::TEXT, 2, '0'),
        'm'
    ),
    total_hours = tc.total_minutes::FLOAT / 60,
    overtime = CASE 
        WHEN tc.total_minutes > 480 THEN (tc.total_minutes - 480)::FLOAT / 60
        ELSE 0
    END
FROM time_calculations tc
WHERE a.id = tc.id;

-- Add comment for documentation
COMMENT ON FUNCTION convert_break_to_minutes(TEXT) IS 'Converts various break duration formats to minutes'; 