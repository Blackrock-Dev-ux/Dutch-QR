-- Drop the functions that reference grace_period
DROP FUNCTION IF EXISTS get_employee_roster;
DROP FUNCTION IF EXISTS calculate_roster_attendance;

-- Add grace_period column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'grace_period'
    ) THEN
        ALTER TABLE rosters 
        ADD COLUMN grace_period INTEGER NOT NULL DEFAULT 15;

        -- Add check constraint to ensure grace_period is non-negative
        ALTER TABLE rosters 
        ADD CONSTRAINT rosters_grace_period_check 
        CHECK (grace_period >= 0);

        -- Add comment for documentation
        COMMENT ON COLUMN rosters.grace_period IS 'Grace period in minutes for late check-ins';

        -- Create index for potential queries
        CREATE INDEX IF NOT EXISTS idx_rosters_grace_period ON rosters(grace_period);
    END IF;
END $$;

-- Recreate the functions with proper grace_period handling
CREATE OR REPLACE FUNCTION get_employee_roster(
    p_employee_id UUID,
    p_date DATE
) RETURNS TABLE (
    id UUID,
    start_time TIME,
    end_time TIME,
    break_duration INTEGER,
    grace_period INTEGER,
    early_departure_threshold INTEGER,
    name VARCHAR(255),
    description TEXT,
    is_active BOOLEAN,
    break_start TIME,
    break_end TIME
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.start_time,
        r.end_time,
        r.break_duration,
        COALESCE(r.grace_period, 15) as grace_period, -- Use column value with fallback
        COALESCE(r.early_departure_threshold, 30) as early_departure_threshold,
        r.name,
        r.description,
        r.is_active,
        r.break_start,
        r.break_end
    FROM employee_rosters er
    JOIN rosters r ON r.id = er.roster_id
    WHERE er.employee_id = p_employee_id
    AND er.effective_from <= p_date
    AND (er.effective_until IS NULL OR er.effective_until >= p_date)
    AND r.is_active = true
    ORDER BY er.is_primary DESC, er.effective_from DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

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