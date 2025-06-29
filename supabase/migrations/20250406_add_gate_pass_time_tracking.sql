
-- Add time tracking columns to gate_passes table
ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS expected_exit_time TEXT;
ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS expected_return_time TEXT;
ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS exit_time TEXT;
ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS return_time TEXT;

-- Create a new function to create gate passes with time information
CREATE OR REPLACE FUNCTION create_gate_pass_with_times(
  p_employee_id UUID,
  p_pass_code TEXT,
  p_employee_name TEXT,
  p_validity TEXT,
  p_type TEXT,
  p_reason TEXT,
  p_expected_exit_time TEXT,
  p_expected_return_time TEXT,
  p_created_by UUID,
  p_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS gate_passes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pass gate_passes;
BEGIN
  INSERT INTO gate_passes (
    employee_id,
    pass_code,
    employee_name,
    validity,
    type, 
    reason,
    expected_exit_time,
    expected_return_time,
    created_by,
    expires_at,
    status
  ) VALUES (
    p_employee_id,
    p_pass_code,
    p_employee_name,
    p_validity,
    p_type,
    p_reason,
    p_expected_exit_time,
    p_expected_return_time,
    p_created_by,
    p_expires_at,
    'active'
  )
  RETURNING * INTO v_pass;
  
  RETURN v_pass;
END;
$$;
