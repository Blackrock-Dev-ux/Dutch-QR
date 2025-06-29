-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing types if they exist
DROP TYPE IF EXISTS pass_validity CASCADE;
DROP TYPE IF EXISTS pass_type CASCADE;
DROP TYPE IF EXISTS pass_status CASCADE;

-- Create enum types
CREATE TYPE pass_validity AS ENUM ('single', 'day', 'week', 'month');
CREATE TYPE pass_type AS ENUM ('entry', 'exit', 'both');
CREATE TYPE pass_status AS ENUM ('active', 'used', 'expired', 'revoked');

-- Create departments table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT departments_name_key UNIQUE (name)
);

-- Create employees table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    department_id UUID REFERENCES departments(id),
    position TEXT,
    status TEXT DEFAULT 'active',
    join_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT employees_email_key UNIQUE (email)
);

-- Create attendance table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    date DATE NOT NULL,
    check_in_time TIMESTAMPTZ NOT NULL,
    check_out_time TIMESTAMPTZ,
    status TEXT DEFAULT 'present',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_daily_attendance UNIQUE (employee_id, date)
);

-- Create admin_settings table
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    setting_type TEXT NOT NULL,
    whatsapp_number TEXT,
    is_whatsapp_share_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create gate_passes table
CREATE TABLE gate_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    employee_name TEXT NOT NULL,
    pass_code TEXT NOT NULL UNIQUE,
    validity pass_validity NOT NULL,
    type pass_type NOT NULL,
    reason TEXT NOT NULL,
    status pass_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by UUID,
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,
    exit_time TIMESTAMPTZ,
    return_time TIMESTAMPTZ,
    expected_exit_time TIMESTAMPTZ,
    expected_return_time TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    revocation_reason TEXT
);

-- Create gate_pass_logs table
CREATE TABLE gate_pass_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gate_pass_id UUID NOT NULL REFERENCES gate_passes(id),
    action TEXT NOT NULL,
    old_status pass_status,
    new_status pass_status,
    performed_by UUID NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- Create rosters table
CREATE TABLE rosters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    shift TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create employees view
CREATE OR REPLACE VIEW employees_view AS
SELECT 
    e.id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone,
    e.position,
    e.status,
    e.department_id,
    d.name as department,
    e.join_date,
    e.created_at,
    e.updated_at
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_employees_timestamp
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_settings_timestamp
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rosters_timestamp
    BEFORE UPDATE ON rosters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create gate pass functions
CREATE OR REPLACE FUNCTION create_gate_pass(
    p_employee_id UUID,
    p_pass_code TEXT,
    p_employee_name TEXT,
    p_validity pass_validity,
    p_type pass_type,
    p_reason TEXT,
    p_created_by UUID,
    p_expires_at TIMESTAMPTZ
)
RETURNS gate_passes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result gate_passes;
BEGIN
    INSERT INTO gate_passes (
        employee_id,
        pass_code,
        employee_name,
        validity,
        type,
        reason,
        created_by,
        expires_at
    ) VALUES (
        p_employee_id,
        p_pass_code,
        p_employee_name,
        p_validity,
        p_type,
        p_reason,
        p_created_by,
        p_expires_at
    )
    RETURNING * INTO v_result;
    
    -- Log the creation
    INSERT INTO gate_pass_logs (
        gate_pass_id,
        action,
        new_status,
        performed_by
    ) VALUES (
        v_result.id,
        'create',
        'active',
        p_created_by
    );
    
    RETURN v_result;
END;
$$;

-- Function to revoke gate pass
CREATE OR REPLACE FUNCTION revoke_gate_pass(
    p_pass_id UUID,
    p_revoked_by UUID,
    p_reason TEXT
)
RETURNS gate_passes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result gate_passes;
BEGIN
    UPDATE gate_passes
    SET 
        status = 'revoked',
        revoked_at = NOW(),
        revoked_by = p_revoked_by,
        revocation_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_pass_id
    RETURNING * INTO v_result;
    
    -- Log the revocation
    INSERT INTO gate_pass_logs (
        gate_pass_id,
        action,
        old_status,
        new_status,
        performed_by,
        notes
    ) VALUES (
        p_pass_id,
        'revoke',
        'active',
        'revoked',
        p_revoked_by,
        p_reason
    );
    
    RETURN v_result;
END;
$$;

-- Function to use gate pass
CREATE OR REPLACE FUNCTION use_gate_pass(
    p_pass_id UUID,
    p_used_by UUID
)
RETURNS gate_passes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result gate_passes;
BEGIN
    UPDATE gate_passes
    SET 
        status = CASE 
            WHEN validity = 'single' THEN 'used'
            ELSE status
        END,
        used_at = CASE 
            WHEN used_at IS NULL THEN NOW()
            ELSE used_at
        END,
        last_used_at = NOW(),
        used_by = COALESCE(used_by, p_used_by),
        use_count = COALESCE(use_count, 0) + 1,
        updated_at = NOW()
    WHERE id = p_pass_id
    RETURNING * INTO v_result;
    
    -- Log the usage
    INSERT INTO gate_pass_logs (
        gate_pass_id,
        action,
        old_status,
        new_status,
        performed_by
    ) VALUES (
        p_pass_id,
        'use',
        v_result.status,
        CASE 
            WHEN v_result.validity = 'single' THEN 'used'::pass_status
            ELSE v_result.status
        END,
        p_used_by
    );
    
    RETURN v_result;
END;
$$;

-- Function to auto expire passes
CREATE OR REPLACE FUNCTION auto_expire_passes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE gate_passes
    SET 
        status = 'expired',
        updated_at = NOW()
    WHERE 
        status = 'active' 
        AND expires_at < NOW();
        
    -- Log expirations
    INSERT INTO gate_pass_logs (
        gate_pass_id,
        action,
        old_status,
        new_status,
        performed_by,
        notes
    )
    SELECT 
        id,
        'expire',
        'active',
        'expired',
        created_by,
        'Auto expired by system'
    FROM gate_passes
    WHERE 
        status = 'expired' 
        AND updated_at >= NOW() - INTERVAL '1 minute';
END;
$$;

-- Create indexes
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_gate_passes_employee ON gate_passes(employee_id);
CREATE INDEX idx_gate_passes_status ON gate_passes(status);
CREATE INDEX idx_gate_passes_pass_code ON gate_passes(pass_code);
CREATE INDEX idx_rosters_employee ON rosters(employee_id);
CREATE INDEX idx_rosters_dates ON rosters(start_date, end_date);
CREATE INDEX idx_admin_settings_type ON admin_settings(setting_type);

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_pass_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rosters ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Enable read access for authenticated users"
ON departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users"
ON employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users"
ON attendance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users"
ON admin_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users"
ON gate_passes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users"
ON gate_pass_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable read access for authenticated users"
ON rosters FOR SELECT TO authenticated USING (true);

-- Add comments
COMMENT ON TABLE departments IS 'Company departments';
COMMENT ON TABLE employees IS 'Employee records';
COMMENT ON TABLE attendance IS 'Daily attendance records';
COMMENT ON TABLE admin_settings IS 'Admin configuration settings';
COMMENT ON TABLE gate_passes IS 'Gate passes for employee entry/exit';
COMMENT ON TABLE gate_pass_logs IS 'Audit trail for gate pass actions';
COMMENT ON TABLE rosters IS 'Employee shift schedules'; 