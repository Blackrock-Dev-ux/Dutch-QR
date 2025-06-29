-- First, check if the old shift column exists and drop it if it does
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'shift'
    ) THEN
        ALTER TABLE rosters DROP COLUMN shift;
    END IF;
END $$;

-- Add columns if they don't exist
DO $$ 
BEGIN
    -- Add shift_pattern if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'shift_pattern'
    ) THEN
        ALTER TABLE rosters ADD COLUMN shift_pattern JSONB NOT NULL DEFAULT '[]';
    END IF;

    -- Add department if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'department'
    ) THEN
        ALTER TABLE rosters ADD COLUMN department TEXT;
    END IF;

    -- Add position if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'position'
    ) THEN
        ALTER TABLE rosters ADD COLUMN position TEXT;
    END IF;

    -- Add created_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE rosters ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add updated_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE rosters ADD COLUMN updated_by UUID REFERENCES auth.users(id);
    END IF;

    -- Add early_departure_threshold if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'rosters' 
        AND column_name = 'early_departure_threshold'
    ) THEN
        ALTER TABLE rosters 
        ADD COLUMN early_departure_threshold INTEGER NOT NULL DEFAULT 30;
    END IF;

    -- Add grace_period if it doesn't exist
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

-- Update the status check constraint
ALTER TABLE rosters DROP CONSTRAINT IF EXISTS rosters_status_check;
ALTER TABLE rosters ADD CONSTRAINT rosters_status_check CHECK (status IN ('active', 'completed', 'upcoming'));

-- Add indexes for the new columns (these will fail silently if they already exist)
CREATE INDEX IF NOT EXISTS idx_rosters_department ON rosters(department);
CREATE INDEX IF NOT EXISTS idx_rosters_created_by ON rosters(created_by);
CREATE INDEX IF NOT EXISTS idx_rosters_updated_by ON rosters(updated_by);

-- Add comments
COMMENT ON COLUMN rosters.shift_pattern IS 'JSON array of daily shifts for the roster period';
COMMENT ON COLUMN rosters.department IS 'Department the roster is associated with';
COMMENT ON COLUMN rosters.position IS 'Position/role in the department'; 

-- Drop existing tables if they exist
DROP TABLE IF EXISTS employee_rosters CASCADE;
DROP TABLE IF EXISTS rosters CASCADE;

-- Create rosters table
CREATE TABLE rosters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    department_id TEXT,
    position TEXT NOT NULL DEFAULT 'Unassigned',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    shift_pattern JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'upcoming')),
    grace_period INTEGER NOT NULL DEFAULT 15,
    early_departure_threshold INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),
    assignment_time TIMESTAMPTZ DEFAULT NOW(),
    completion_time TIMESTAMPTZ,
    CONSTRAINT valid_dates CHECK (start_date <= end_date),
    CONSTRAINT rosters_grace_period_check CHECK (grace_period >= 0)
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

-- Create indexes for better performance
CREATE INDEX idx_employee_rosters_employee_id ON employee_rosters(employee_id);
CREATE INDEX idx_employee_rosters_roster_id ON employee_rosters(roster_id);
CREATE INDEX idx_employee_rosters_dates ON employee_rosters(effective_from, effective_until);
CREATE INDEX idx_rosters_is_active ON rosters(is_active);

-- Enable RLS
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_rosters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rosters
CREATE POLICY "Enable read access for all users" ON rosters
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON rosters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON rosters
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON rosters
    FOR DELETE USING (true);

-- Create RLS policies for employee_rosters
CREATE POLICY "Enable read access for all users" ON employee_rosters
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON employee_rosters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON employee_rosters
    FOR UPDATE USING (true) WITH CHECK (true);

-- Add helpful comments
COMMENT ON TABLE rosters IS 'Stores roster assignments with shift patterns and schedule details';
COMMENT ON TABLE employee_rosters IS 'Links employees to their assigned rosters with effective dates';
COMMENT ON COLUMN rosters.shift_pattern IS 'JSON array of daily shifts with time slots';
COMMENT ON COLUMN rosters.department_id IS 'Department identifier';
COMMENT ON COLUMN rosters.position IS 'Employee position/role';
COMMENT ON COLUMN rosters.status IS 'Current status of the roster (active/completed/upcoming)';
COMMENT ON COLUMN rosters.is_active IS 'Whether the roster is currently active';
COMMENT ON COLUMN rosters.assignment_time IS 'When the roster was assigned';
COMMENT ON COLUMN rosters.completion_time IS 'When the roster was marked as completed';

-- Add roster reference to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS roster_id UUID REFERENCES rosters(id),
ADD COLUMN IF NOT EXISTS minutes_late INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_departure_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS break_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expected_hours DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_hours DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS compliance_rate DECIMAL(5,2) DEFAULT 100;

-- Drop the function with its exact signature first
DROP FUNCTION IF EXISTS calculate_roster_attendance(
    timestamp with time zone,  -- p_check_in
    timestamp with time zone,  -- p_check_out
    time without time zone,    -- p_roster_start
    time without time zone,    -- p_roster_end
    integer,                   -- p_break_duration
    integer,                   -- p_grace_period
    integer                    -- p_early_threshold
);

-- Create function to calculate attendance metrics based on roster
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
    -- Calculate expected start and end times
    v_expected_start := DATE_TRUNC('day', p_check_in) + p_roster_start;
    v_expected_end := DATE_TRUNC('day', p_check_in) + p_roster_end;
    
    -- Calculate minutes late (considering grace period)
    minutes_late := GREATEST(0,
        EXTRACT(EPOCH FROM (p_check_in - v_expected_start))/60 - p_grace_period
    )::INTEGER;
    
    -- Calculate early departure
    early_departure_minutes := CASE 
        WHEN p_check_out < v_expected_end THEN
            GREATEST(0, 
                EXTRACT(EPOCH FROM (v_expected_end - p_check_out))/60 - p_early_threshold
            )::INTEGER
        ELSE 0
    END;
    
    -- Calculate actual working hours (excluding break)
    v_working_minutes := GREATEST(0,
        EXTRACT(EPOCH FROM (p_check_out - p_check_in))/60 - p_break_duration
    )::INTEGER;
    actual_hours := (v_working_minutes::DECIMAL / 60);
    
    -- Calculate expected hours
    v_expected_minutes := EXTRACT(EPOCH FROM (v_expected_end - v_expected_start))/60 - p_break_duration;
    expected_hours := (v_expected_minutes::DECIMAL / 60);
    
    -- Calculate compliance rate
    compliance_rate := LEAST(100, (v_working_minutes::DECIMAL / v_expected_minutes * 100));
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_rosters_employee_id ON employee_rosters(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_rosters_roster_id ON employee_rosters(roster_id);
CREATE INDEX IF NOT EXISTS idx_employee_rosters_dates ON employee_rosters(effective_from, effective_until);
CREATE INDEX IF NOT EXISTS idx_attendance_roster_id ON attendance(roster_id);

-- Add helpful comments
COMMENT ON TABLE rosters IS 'Stores work schedule configurations';
COMMENT ON TABLE employee_rosters IS 'Maps employees to their assigned work schedules';
COMMENT ON COLUMN rosters.grace_period IS 'Grace period in minutes before marking late';
COMMENT ON COLUMN rosters.early_departure_threshold IS 'Threshold in minutes before marking early departure'; 

-- Check and create necessary tables
DO $$ 
BEGIN
    -- Create rosters table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rosters') THEN
        CREATE TABLE rosters (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            employee_id UUID NOT NULL REFERENCES employees(id),
            department_id TEXT,
            position TEXT NOT NULL DEFAULT 'Unassigned',
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            shift_pattern JSONB NOT NULL DEFAULT '[]'::jsonb,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT true,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'upcoming')),
            grace_period INTEGER NOT NULL DEFAULT 15,
            early_departure_threshold INTEGER NOT NULL DEFAULT 30,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_by UUID REFERENCES auth.users(id),
            updated_by UUID REFERENCES auth.users(id),
            assignment_time TIMESTAMPTZ DEFAULT NOW(),
            completion_time TIMESTAMPTZ,
            CONSTRAINT valid_dates CHECK (start_date <= end_date),
            CONSTRAINT rosters_grace_period_check CHECK (grace_period >= 0)
        );
    END IF;

    -- Create employee_rosters table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employee_rosters') THEN
        CREATE TABLE employee_rosters (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            employee_id UUID NOT NULL REFERENCES employees(id),
            roster_id UUID NOT NULL REFERENCES rosters(id),
            effective_from DATE NOT NULL,
            effective_until DATE,
            is_primary BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    END IF;

    -- Add foreign key constraints if they don't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'employee_rosters_employee_id_fkey'
    ) THEN
        ALTER TABLE employee_rosters
        ADD CONSTRAINT employee_rosters_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES employees(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'employee_rosters_roster_id_fkey'
    ) THEN
        ALTER TABLE employee_rosters
        ADD CONSTRAINT employee_rosters_roster_id_fkey
        FOREIGN KEY (roster_id) REFERENCES rosters(id);
    END IF;

    -- Add date range constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'valid_date_range'
    ) THEN
        ALTER TABLE employee_rosters
        ADD CONSTRAINT valid_date_range 
        CHECK (effective_until IS NULL OR effective_from < effective_until);
    END IF;

    -- Add unique constraint for primary roster if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'unique_primary_roster'
    ) THEN
        ALTER TABLE employee_rosters
        ADD CONSTRAINT unique_primary_roster 
        UNIQUE (employee_id, effective_from, is_primary);
    END IF;

    -- Add indexes if they don't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_employee_rosters_employee_id'
    ) THEN
        CREATE INDEX idx_employee_rosters_employee_id ON employee_rosters(employee_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_employee_rosters_roster_id'
    ) THEN
        CREATE INDEX idx_employee_rosters_roster_id ON employee_rosters(roster_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_employee_rosters_dates'
    ) THEN
        CREATE INDEX idx_employee_rosters_dates ON employee_rosters(effective_from, effective_until);
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_rosters_is_active'
    ) THEN
        CREATE INDEX idx_rosters_is_active ON rosters(is_active);
    END IF;

    -- Enable RLS on both tables
    ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;
    ALTER TABLE employee_rosters ENABLE ROW LEVEL SECURITY;

    -- Create policies for rosters
    DROP POLICY IF EXISTS "Enable read access for all users" ON rosters;
    CREATE POLICY "Enable read access for all users"
        ON rosters FOR SELECT
        USING (true);

    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON rosters;
    CREATE POLICY "Enable insert for authenticated users"
        ON rosters FOR INSERT
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Enable update for authenticated users" ON rosters;
    CREATE POLICY "Enable update for authenticated users"
        ON rosters FOR UPDATE
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON rosters;
    CREATE POLICY "Enable delete for authenticated users"
        ON rosters FOR DELETE
        USING (true);

    -- Create policies for employee_rosters
    DROP POLICY IF EXISTS "Enable read access for all users" ON employee_rosters;
    CREATE POLICY "Enable read access for all users"
        ON employee_rosters FOR SELECT
        USING (true);

    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON employee_rosters;
    CREATE POLICY "Enable insert for authenticated users"
        ON employee_rosters FOR INSERT
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Enable update for authenticated users" ON employee_rosters;
    CREATE POLICY "Enable update for authenticated users"
        ON employee_rosters FOR UPDATE
        USING (true)
        WITH CHECK (true);

END $$; 