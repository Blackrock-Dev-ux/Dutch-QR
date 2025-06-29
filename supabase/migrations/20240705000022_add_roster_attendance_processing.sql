-- Create function to process roster-based attendance
CREATE OR REPLACE FUNCTION process_roster_attendance(
    p_employee_id UUID,
    p_current_time TIMESTAMPTZ,
    p_roster_id UUID
) RETURNS TABLE (
    action TEXT,
    attendance_id UUID,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    minutes_late INTEGER,
    early_departure_minutes INTEGER,
    actual_hours DECIMAL(5,2),
    expected_hours DECIMAL(5,2),
    compliance_rate DECIMAL(5,2)
) AS $$
DECLARE
    v_roster RECORD;
    v_last_attendance RECORD;
    v_attendance_id UUID;
    v_metrics RECORD;
    v_early_threshold INTEGER;
BEGIN
    -- Get roster details
    SELECT 
        r.*,
        COALESCE(r.early_departure_threshold, 30) as early_departure_threshold
    INTO v_roster 
    FROM rosters r
    WHERE r.id = p_roster_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid roster ID';
    END IF;

    -- Store early threshold
    v_early_threshold := v_roster.early_departure_threshold;

    -- Get last attendance record for today
    SELECT * INTO v_last_attendance
    FROM attendance
    WHERE employee_id = p_employee_id
    AND DATE(created_at) = DATE(p_current_time)
    ORDER BY created_at DESC
    LIMIT 1;

    -- Determine if this is a check-in or check-out
    IF v_last_attendance IS NULL OR v_last_attendance.check_out_time IS NOT NULL THEN
        -- This is a new check-in
        INSERT INTO attendance (
            employee_id,
            roster_id,
            check_in_time,
            date,
            created_at
        ) VALUES (
            p_employee_id,
            p_roster_id,
            p_current_time,
            DATE(p_current_time),
            p_current_time
        )
        RETURNING id INTO v_attendance_id;

        -- Calculate initial metrics
        SELECT * INTO v_metrics
        FROM calculate_roster_attendance(
            p_current_time,
            p_current_time, -- Same as check-in for initial calculation
            v_roster.start_time,
            v_roster.end_time,
            v_roster.break_duration,
            v_roster.grace_period,
            v_early_threshold
        );

        -- Update attendance with initial metrics
        UPDATE attendance
        SET 
            minutes_late = v_metrics.minutes_late,
            expected_hours = v_metrics.expected_hours
        WHERE id = v_attendance_id;

        action := 'check_in';
        attendance_id := v_attendance_id;
        check_in_time := p_current_time;
        check_out_time := NULL;
        minutes_late := v_metrics.minutes_late;
        early_departure_minutes := 0;
        actual_hours := 0;
        expected_hours := v_metrics.expected_hours;
        compliance_rate := 0;

    ELSE
        -- This is a check-out
        SELECT * INTO v_metrics
        FROM calculate_roster_attendance(
            v_last_attendance.check_in_time,
            p_current_time,
            v_roster.start_time,
            v_roster.end_time,
            v_roster.break_duration,
            v_roster.grace_period,
            v_early_threshold
        );

        -- Update attendance with final metrics
        UPDATE attendance
        SET 
            check_out_time = p_current_time,
            early_departure_minutes = v_metrics.early_departure_minutes,
            actual_hours = v_metrics.actual_hours,
            compliance_rate = v_metrics.compliance_rate,
            updated_at = p_current_time
        WHERE id = v_last_attendance.id
        RETURNING id INTO v_attendance_id;

        action := 'check_out';
        attendance_id := v_attendance_id;
        check_in_time := v_last_attendance.check_in_time;
        check_out_time := p_current_time;
        minutes_late := v_metrics.minutes_late;
        early_departure_minutes := v_metrics.early_departure_minutes;
        actual_hours := v_metrics.actual_hours;
        expected_hours := v_metrics.expected_hours;
        compliance_rate := v_metrics.compliance_rate;
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;