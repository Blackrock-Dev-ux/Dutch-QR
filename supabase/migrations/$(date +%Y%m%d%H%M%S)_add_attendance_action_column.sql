-- Add action column to attendance table
ALTER TABLE attendance 
ADD COLUMN action TEXT CHECK (action IN ('check-in', 'check-out'));

-- Create a function to validate attendance records
CREATE OR REPLACE FUNCTION validate_attendance_record()
RETURNS TRIGGER AS $$
DECLARE
  last_record RECORD;
BEGIN
  -- Check for existing unchecked-out record when trying to check-in
  IF NEW.action = 'check-in' THEN
    SELECT * INTO last_record 
    FROM attendance 
    WHERE employee_id = NEW.employee_id 
      AND date = NEW.date 
      AND check_out_time IS NULL 
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Cannot check-in: Previous check-in without check-out exists';
    END IF;
  END IF;

  -- Validate check-out has a corresponding check-in
  IF NEW.action = 'check-out' THEN
    SELECT * INTO last_record 
    FROM attendance 
    WHERE employee_id = NEW.employee_id 
      AND date = NEW.date 
      AND check_in_time IS NOT NULL 
      AND check_out_time IS NULL 
    ORDER BY created_at DESC 
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cannot check-out: No check-in record exists';
    END IF;

    -- Enforce minimum work duration
    IF (EXTRACT(EPOCH FROM (NEW.check_out_time - last_record.check_in_time)) / 3600) < 0.5 THEN
      RAISE EXCEPTION 'Minimum work duration of 30 minutes required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce attendance rules
CREATE TRIGGER attendance_validation_trigger
BEFORE INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION validate_attendance_record();

-- Create Row Level Security policies
CREATE POLICY "Employees can manage their own attendance" 
ON attendance FOR ALL 
USING (auth.uid() = employee_id); 