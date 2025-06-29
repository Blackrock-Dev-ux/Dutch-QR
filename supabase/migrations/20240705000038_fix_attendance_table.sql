-- Drop and recreate attendance table with proper structure
DROP TABLE IF EXISTS attendance CASCADE;

CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    roster_id UUID NOT NULL REFERENCES rosters(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    first_check_in_time TIMESTAMPTZ,
    first_check_out_time TIMESTAMPTZ,
    second_check_in_time TIMESTAMPTZ,
    second_check_out_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'completed', 'on_break')),
    minutes_late INTEGER DEFAULT 0,
    early_departure_minutes INTEGER DEFAULT 0,
    break_duration INTEGER DEFAULT 60,
    expected_hours NUMERIC(4,2) DEFAULT 8.00,
    actual_hours NUMERIC(4,2) DEFAULT 0.00,
    last_action TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_check_times CHECK (
        (first_check_in_time IS NULL) OR
        (first_check_in_time IS NOT NULL AND first_check_out_time IS NULL) OR
        (first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL AND first_check_out_time > first_check_in_time) OR
        (first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL AND second_check_in_time IS NOT NULL AND second_check_in_time > first_check_out_time) OR
        (first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL AND second_check_in_time IS NOT NULL AND second_check_out_time IS NOT NULL AND second_check_out_time > second_check_in_time)
    ),
    CONSTRAINT unique_daily_attendance UNIQUE (employee_id, date)
);

-- Create indexes for better performance
CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_roster_id ON attendance(roster_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);

-- Enable RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON attendance
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON attendance
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON attendance
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON attendance
    FOR DELETE USING (true);

-- Add helpful comments
COMMENT ON TABLE attendance IS 'Stores employee attendance records';
COMMENT ON COLUMN attendance.minutes_late IS 'Minutes late beyond grace period';
COMMENT ON COLUMN attendance.early_departure_minutes IS 'Minutes left early beyond threshold';
COMMENT ON COLUMN attendance.break_duration IS 'Break duration in minutes';
COMMENT ON COLUMN attendance.expected_hours IS 'Expected working hours for the day';
COMMENT ON COLUMN attendance.actual_hours IS 'Actual hours worked';

-- Create or replace function to calculate working hours
CREATE OR REPLACE FUNCTION calculate_working_hours(
    p_first_check_in TIMESTAMPTZ,
    p_first_check_out TIMESTAMPTZ,
    p_second_check_in TIMESTAMPTZ,
    p_second_check_out TIMESTAMPTZ,
    p_break_duration INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    total_minutes INTEGER := 0;
BEGIN
    -- Calculate first session
    IF p_first_check_in IS NOT NULL AND p_first_check_out IS NOT NULL THEN
        total_minutes := total_minutes + 
            EXTRACT(EPOCH FROM (p_first_check_out - p_first_check_in))::INTEGER / 60;
    END IF;

    -- Calculate second session
    IF p_second_check_in IS NOT NULL AND p_second_check_out IS NOT NULL THEN
        total_minutes := total_minutes + 
            EXTRACT(EPOCH FROM (p_second_check_out - p_second_check_in))::INTEGER / 60;
    END IF;

    -- Subtract break duration if both sessions are complete
    IF p_first_check_out IS NOT NULL AND p_second_check_in IS NOT NULL THEN
        total_minutes := total_minutes - COALESCE(p_break_duration, 60);
    END IF;

    -- Convert to hours with 2 decimal places
    RETURN ROUND((total_minutes::NUMERIC / 60), 2);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update actual_hours automatically
CREATE OR REPLACE FUNCTION update_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actual_hours := calculate_working_hours(
        NEW.first_check_in_time,
        NEW.first_check_out_time,
        NEW.second_check_in_time,
        NEW.second_check_out_time,
        NEW.break_duration
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_actual_hours
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_actual_hours(); 