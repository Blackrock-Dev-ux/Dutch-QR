-- Drop the function with its exact signature
DROP FUNCTION IF EXISTS calculate_roster_attendance(
    timestamp with time zone,  -- p_check_in
    timestamp with time zone,  -- p_check_out
    time without time zone,    -- p_roster_start
    time without time zone,    -- p_roster_end
    integer,                   -- p_break_duration
    integer,                   -- p_grace_period
    integer                    -- p_early_threshold
);

-- Recreate the function with proper parameter defaults
CREATE OR REPLACE FUNCTION calculate_roster_attendance(
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_roster_start TIME,
    p_roster_end TIME,
    p_break_duration INTEGER,
    p_grace_period INTEGER DEFAULT 15,
    p_early_threshold INTEGER DEFAULT 30
) RETURNS TABLE (
    minutes_late INTEGER,
    early_departure_minutes INTEGER,
    actual_hours DECIMAL(5,2),
    expected_hours DECIMAL(5,2),
    compliance_rate DECIMAL(5,2)
) AS $$
DECLARE
    v_expected_start TIMESTAMPTZ;
    v_expected_end TIMESTAMPTZ;
    v_working_minutes INTEGER;
    v_expected_minutes INTEGER;
BEGIN
    -- Set the time component of check_in date to roster start time
    v_expected_start := date_trunc('day', p_check_in) + p_roster_start::time;
    v_expected_end := date_trunc('day', p_check_in) + p_roster_end::time;
    
    -- Calculate minutes late (considering grace period)
    minutes_late := GREATEST(0, 
        EXTRACT(EPOCH FROM (p_check_in - v_expected_start))/60 - COALESCE(p_grace_period, 15)
    );
    
    -- Calculate early departure
    early_departure_minutes := GREATEST(0,
        EXTRACT(EPOCH FROM (v_expected_end - p_check_out))/60 - COALESCE(p_early_threshold, 30)
    );
    
    -- Calculate actual working hours (excluding breaks)
    v_working_minutes := EXTRACT(EPOCH FROM (p_check_out - p_check_in))/60 - COALESCE(p_break_duration, 0);
    actual_hours := ROUND(v_working_minutes::DECIMAL / 60, 2);
    
    -- Calculate expected working hours
    v_expected_minutes := EXTRACT(EPOCH FROM (v_expected_end - v_expected_start))/60 - COALESCE(p_break_duration, 0);
    expected_hours := ROUND(v_expected_minutes::DECIMAL / 60, 2);
    
    -- Calculate compliance rate
    IF expected_hours > 0 THEN
        compliance_rate := ROUND((actual_hours / expected_hours * 100)::DECIMAL, 2);
    ELSE
        compliance_rate := 100;
    END IF;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql; 