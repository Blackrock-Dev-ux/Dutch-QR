-- First, let's make sure we have all the required columns
DO $$ 
BEGIN
    -- Add any missing columns first
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE rosters ADD COLUMN name VARCHAR(255);
        ALTER TABLE rosters ADD COLUMN description TEXT;
        ALTER TABLE rosters ADD COLUMN start_time TIME NOT NULL DEFAULT '09:00:00';
        ALTER TABLE rosters ADD COLUMN end_time TIME NOT NULL DEFAULT '17:00:00';
        ALTER TABLE rosters ADD COLUMN break_start TIME DEFAULT '13:00:00';
        ALTER TABLE rosters ADD COLUMN break_end TIME DEFAULT '14:00:00';
        ALTER TABLE rosters ADD COLUMN break_duration INTEGER NOT NULL DEFAULT 60;
        ALTER TABLE rosters ADD COLUMN grace_period INTEGER NOT NULL DEFAULT 15;
        ALTER TABLE rosters ADD COLUMN early_departure_threshold INTEGER NOT NULL DEFAULT 30;
    END IF;
END $$;

-- Now insert a default roster if none exists
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
SELECT
    'Default Day Shift',
    'Standard 9 AM to 5 PM shift with 1-hour lunch break',
    (SELECT id FROM employees LIMIT 1), -- Get the first employee's ID
    'DEFAULT',
    'General',
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
WHERE NOT EXISTS (
    SELECT 1 FROM rosters WHERE is_active = true
);

-- Insert into employee_rosters if we inserted a roster
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

-- Add helpful comments
COMMENT ON TABLE rosters IS 'Stores work schedule configurations';
COMMENT ON TABLE employee_rosters IS 'Maps employees to their assigned work schedules';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rosters_employee_id ON rosters(employee_id);
CREATE INDEX IF NOT EXISTS idx_rosters_department_id ON rosters(department_id);
CREATE INDEX IF NOT EXISTS idx_employee_rosters_dates ON employee_rosters(effective_from, effective_until); 