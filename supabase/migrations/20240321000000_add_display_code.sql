-- Add display_code column to gate_passes table
ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS display_code VARCHAR;

-- Update the stored procedure to include display_code
CREATE OR REPLACE FUNCTION create_gate_pass(
    p_id UUID,
    p_display_code VARCHAR,
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
        display_code,
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
        p_display_code,
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