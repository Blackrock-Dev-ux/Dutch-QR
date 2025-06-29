-- First, ensure we have the correct table structure
DO $$ 
BEGIN
    -- Drop the existing rosters and employee_rosters tables to start fresh
    DROP TABLE IF EXISTS employee_rosters CASCADE;
    DROP TABLE IF EXISTS rosters CASCADE;

    -- Create rosters table with all required columns
    CREATE TABLE rosters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        employee_id UUID NOT NULL REFERENCES employees(id),
        department_id TEXT,
        position TEXT NOT NULL DEFAULT 'General',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_time TIME NOT NULL DEFAULT '09:00:00',
        end_time TIME NOT NULL DEFAULT '17:00:00',
        break_start TIME DEFAULT '13:00:00',
        break_end TIME DEFAULT '14:00:00',
        break_duration INTEGER NOT NULL DEFAULT 60,
        grace_period INTEGER NOT NULL DEFAULT 15,
        early_departure_threshold INTEGER NOT NULL DEFAULT 30,
        shift_pattern JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'upcoming')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID REFERENCES auth.users(id),
        updated_by UUID REFERENCES auth.users(id),
        assignment_time TIMESTAMPTZ DEFAULT NOW(),
        completion_time TIMESTAMPTZ,
        CONSTRAINT valid_dates CHECK (start_date <= end_date),
        CONSTRAINT valid_times CHECK (start_time < end_time),
        CONSTRAINT valid_break_times CHECK (
            (break_start IS NULL AND break_end IS NULL) OR 
            (break_start IS NOT NULL AND break_end IS NOT NULL AND break_start < break_end)
        )
    );

    -- Create employee_rosters table
    CREATE TABLE employee_rosters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_id UUID NOT NULL REFERENCES employees(id),
        roster_id UUID NOT NULL REFERENCES rosters(id),
        effective_from DATE NOT NULL,
        effective_until DATE,
        is_primary BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_date_range CHECK (
            effective_until IS NULL OR effective_from < effective_until
        ),
        CONSTRAINT unique_primary_roster UNIQUE (employee_id, effective_from, is_primary)
    );

    -- Create indexes
    CREATE INDEX idx_rosters_employee_id ON rosters(employee_id);
    CREATE INDEX idx_rosters_department_id ON rosters(department_id);
    CREATE INDEX idx_rosters_is_active ON rosters(is_active);
    CREATE INDEX idx_rosters_status ON rosters(status);
    CREATE INDEX idx_employee_rosters_employee_id ON employee_rosters(employee_id);
    CREATE INDEX idx_employee_rosters_roster_id ON employee_rosters(roster_id);
    CREATE INDEX idx_employee_rosters_dates ON employee_rosters(effective_from, effective_until);
END $$;

-- Insert default roster for each active employee
INSERT INTO rosters (
    name,
    description,
    employee_id,
    department_id,
    position,
    start_date,
    end_date,
    start_time,
    end_time,
    break_start,
    break_end,
    break_duration,
    grace_period,
    early_departure_threshold,
    shift_pattern,
    is_active,
    status
)
SELECT DISTINCT ON (e.id)
    'Default Day Shift',
    'Standard 9 AM to 5 PM shift with 1-hour lunch break',
    e.id,
    COALESCE(e.department_id, 'DEFAULT'),
    COALESCE(e.position, 'General'),
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 year',
    '09:00:00'::TIME,
    '17:00:00'::TIME,
    '13:00:00'::TIME,
    '14:00:00'::TIME,
    60,
    15,
    30,
    '[]'::jsonb,
    true,
    'active'
FROM employees e
WHERE e.status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM rosters r 
    WHERE r.employee_id = e.id 
    AND r.is_active = true
);

-- Assign rosters to employees
INSERT INTO employee_rosters (
    employee_id,
    roster_id,
    effective_from,
    effective_until,
    is_primary
)
SELECT
    r.employee_id,
    r.id,
    r.start_date,
    r.end_date,
    true
FROM rosters r
WHERE r.name = 'Default Day Shift'
AND NOT EXISTS (
    SELECT 1 
    FROM employee_rosters er 
    WHERE er.employee_id = r.employee_id 
    AND er.is_primary = true
);

-- Enable RLS
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rosters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON rosters
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON rosters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON rosters
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON rosters
    FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON employee_rosters
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON employee_rosters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON employee_rosters
    FOR UPDATE USING (true) WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE rosters IS 'Stores work schedule configurations';
COMMENT ON TABLE employee_rosters IS 'Maps employees to their assigned work schedules';
COMMENT ON COLUMN rosters.grace_period IS 'Grace period in minutes before marking late';
COMMENT ON COLUMN rosters.early_departure_threshold IS 'Threshold in minutes before marking early departure'; 