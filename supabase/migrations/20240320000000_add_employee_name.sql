-- Add employee_name column to gate_passes table
ALTER TABLE gate_passes ADD COLUMN IF NOT EXISTS employee_name VARCHAR NOT NULL DEFAULT '';

-- Update any existing rows to set employee_name from employees table
UPDATE gate_passes gp
SET employee_name = e.name
FROM employees e
WHERE gp.employee_id = e.id;

-- Add NOT NULL constraint after data migration
ALTER TABLE gate_passes ALTER COLUMN employee_name SET NOT NULL; 