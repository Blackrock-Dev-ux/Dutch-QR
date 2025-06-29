-- Create gate_passes table
CREATE TABLE IF NOT EXISTS gate_passes (
    id VARCHAR PRIMARY KEY,
    employee_id VARCHAR REFERENCES employees(id),
    employee_name VARCHAR NOT NULL,
    validity VARCHAR CHECK (validity IN ('single', 'day', 'week', 'month')) NOT NULL,
    type VARCHAR CHECK (type IN ('entry', 'exit', 'both')) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR CHECK (status IN ('active', 'used', 'expired')) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_gate_passes_employee_id ON gate_passes(employee_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_status ON gate_passes(status);
CREATE INDEX IF NOT EXISTS idx_gate_passes_created_at ON gate_passes(created_at);

-- Add RLS policies
ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON gate_passes;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON gate_passes;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON gate_passes;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
ON gate_passes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON gate_passes FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON gate_passes FOR UPDATE
TO authenticated
USING (true);

-- Create function for inserting gate passes
CREATE OR REPLACE FUNCTION create_gate_pass(
    p_id VARCHAR,
    p_employee_id VARCHAR,
    p_employee_name VARCHAR,
    p_validity VARCHAR,
    p_type VARCHAR,
    p_reason TEXT,
    p_status VARCHAR,
    p_created_at TIMESTAMPTZ,
    p_expires_at TIMESTAMPTZ
)
RETURNS gate_passes AS $$
DECLARE
    v_result gate_passes;
BEGIN
    INSERT INTO gate_passes (
        id,
        employee_id,
        employee_name,
        validity,
        type,
        reason,
        status,
        created_at,
        expires_at
    ) VALUES (
        p_id,
        p_employee_id,
        p_employee_name,
        p_validity,
        p_type,
        p_reason,
        p_status,
        p_created_at,
        p_expires_at
    )
    RETURNING * INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 