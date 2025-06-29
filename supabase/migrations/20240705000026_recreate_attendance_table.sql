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
    status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN (
        'PRESENT', 'ABSENT', 'COMPLETED', 'ON_BREAK',
        'CHECKED_IN', 'CHECKED_OUT',
        'FIRST_SESSION_ACTIVE', 'FIRST_CHECK_OUT',
        'SECOND_SESSION_ACTIVE', 'SECOND_CHECK_OUT'
    )),
    minutes_late INTEGER DEFAULT 0,
    early_departure_minutes INTEGER DEFAULT 0,
    break_duration INTEGER DEFAULT 60,
    expected_hours NUMERIC(4,2) DEFAULT 8.00,
    actual_hours NUMERIC(4,2) DEFAULT 0.00,
    is_second_session BOOLEAN DEFAULT false,
    previous_session_id UUID REFERENCES attendance(id),
    working_duration_minutes INTEGER DEFAULT 0,
    working_duration TEXT DEFAULT '0h 0m',
    total_working_minutes INTEGER DEFAULT 0,
    total_working_duration TEXT DEFAULT '0h 0m',
    break_duration_minutes INTEGER DEFAULT 0,
    break_duration_text TEXT DEFAULT '0h 0m',
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
    CONSTRAINT unique_daily_session_attendance UNIQUE (employee_id, date, is_second_session),
    CONSTRAINT valid_session_progression CHECK (
        (is_second_session = false AND (second_check_in_time IS NULL OR second_check_out_time IS NULL)) OR
        (is_second_session = true AND first_check_in_time IS NOT NULL AND first_check_out_time IS NOT NULL AND second_check_in_time IS NOT NULL)
    )
);

-- Create indexes for better performance
CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_roster_id ON attendance(roster_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_is_second_session ON attendance(is_second_session);
CREATE INDEX idx_attendance_previous_session ON attendance(previous_session_id);

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
COMMENT ON COLUMN attendance.is_second_session IS 'Whether this is a second session for the day';
COMMENT ON COLUMN attendance.previous_session_id IS 'Reference to the first session if this is a second session';
COMMENT ON COLUMN attendance.working_duration_minutes IS 'Working duration in minutes';
COMMENT ON COLUMN attendance.working_duration IS 'Formatted working duration';
COMMENT ON COLUMN attendance.total_working_minutes IS 'Total working duration in minutes';
COMMENT ON COLUMN attendance.total_working_duration IS 'Formatted total working duration';
COMMENT ON COLUMN attendance.break_duration_minutes IS 'Break duration in minutes';
COMMENT ON COLUMN attendance.break_duration_text IS 'Formatted break duration';