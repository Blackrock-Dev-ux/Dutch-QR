-- Drop existing view if it exists
DROP VIEW IF EXISTS attendance_display;

-- Create a view for properly formatted attendance display
CREATE OR REPLACE VIEW attendance_display AS
WITH processed_attendance AS (
  SELECT 
    a.id,
    a.date,
    e.name as employee_name,
    a.first_check_in_time,
    a.first_check_out_time,
    a.second_check_in_time,
    a.second_check_out_time,
    -- Calculate break duration in minutes
    CASE 
      WHEN a.first_check_out_time IS NOT NULL AND a.second_check_in_time IS NOT NULL THEN
        EXTRACT(EPOCH FROM (a.second_check_in_time - a.first_check_out_time))/60
      ELSE 0
    END as break_duration_minutes,
    -- Calculate working duration in minutes
    CASE 
      WHEN a.second_check_out_time IS NOT NULL THEN
        EXTRACT(EPOCH FROM (
          (a.first_check_out_time - a.first_check_in_time) + 
          (a.second_check_out_time - a.second_check_in_time)
        ))/60
      WHEN a.first_check_out_time IS NOT NULL THEN
        EXTRACT(EPOCH FROM (a.first_check_out_time - a.first_check_in_time))/60
      ELSE
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - a.first_check_in_time))/60
    END as working_duration_minutes,
    -- Calculate late duration in minutes
    CASE
      WHEN a.first_check_in_time IS NOT NULL THEN
        GREATEST(
          EXTRACT(EPOCH FROM (
            a.first_check_in_time - 
            (DATE_TRUNC('day', a.first_check_in_time) + INTERVAL '9 hours')
          ))/60,
          0
        )
      ELSE 0
    END as late_duration_minutes,
    -- Determine status
    CASE
      WHEN a.second_check_out_time IS NOT NULL THEN 'CHECKED_OUT'
      WHEN a.second_check_in_time IS NOT NULL THEN 'CHECKED_IN'
      WHEN a.first_check_out_time IS NOT NULL THEN 'ON_BREAK'
      WHEN a.first_check_in_time IS NOT NULL THEN 'CHECKED_IN'
      ELSE 'ABSENT'
    END as status
  FROM attendance a
  JOIN employees e ON a.employee_id = e.id
)
SELECT 
  id,
  date,
  employee_name,
  first_check_in_time::time as first_check_in,
  first_check_out_time::time as first_check_out,
  second_check_in_time::time as second_check_in,
  second_check_out_time::time as second_check_out,
  CASE 
    WHEN break_duration_minutes >= 60 THEN 
      FLOOR(break_duration_minutes/60) || 'h ' || MOD(FLOOR(break_duration_minutes), 60) || 'm'
    ELSE 
      FLOOR(break_duration_minutes) || 'm'
  END as break_duration,
  CASE 
    WHEN working_duration_minutes >= 60 THEN 
      FLOOR(working_duration_minutes/60) || 'h ' || MOD(FLOOR(working_duration_minutes), 60) || 'm'
    ELSE 
      FLOOR(working_duration_minutes) || 'm'
  END as working_duration,
  status,
  CASE 
    WHEN late_duration_minutes > 0 THEN 
      FLOOR(late_duration_minutes) || 'm'
    ELSE 
      '0m'
  END as late_duration
FROM processed_attendance;

-- Update the process_double_attendance function to maintain correct timestamps
CREATE OR REPLACE FUNCTION process_double_attendance(
    p_employee_id TEXT,
    p_current_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_employee_uuid UUID;
    v_existing_record attendance;
    v_today DATE;
    result JSONB;
BEGIN
    -- Convert employee ID to UUID
    v_employee_uuid := get_employee_uuid(p_employee_id);
    IF v_employee_uuid IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'Invalid employee ID'
        );
    END IF;

    v_today := DATE(p_current_time);

    -- Get existing attendance record for today
    SELECT * INTO v_existing_record 
    FROM attendance 
    WHERE employee_id = v_employee_uuid 
    AND date = v_today;

    -- Handle different check-in/out scenarios
    IF v_existing_record IS NULL THEN
        -- First check-in of the day
        INSERT INTO attendance (
            employee_id,
            date,
            first_check_in_time,
            status
        ) VALUES (
            v_employee_uuid,
            v_today,
            p_current_time,
            'CHECKED_IN'
        );
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'First check-in recorded',
            'action', 'FIRST_CHECK_IN'
        );
    
    ELSIF v_existing_record.first_check_in_time IS NOT NULL AND 
          v_existing_record.first_check_out_time IS NULL THEN
        -- First check-out
        UPDATE attendance 
        SET first_check_out_time = p_current_time,
            status = 'ON_BREAK'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'First check-out recorded',
            'action', 'FIRST_CHECK_OUT'
        );
    
    ELSIF v_existing_record.first_check_out_time IS NOT NULL AND 
          v_existing_record.second_check_in_time IS NULL THEN
        -- Second check-in
        UPDATE attendance 
        SET second_check_in_time = p_current_time,
            status = 'CHECKED_IN'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-in recorded',
            'action', 'SECOND_CHECK_IN'
        );
    
    ELSIF v_existing_record.second_check_in_time IS NOT NULL AND 
          v_existing_record.second_check_out_time IS NULL THEN
        -- Final check-out
        UPDATE attendance 
        SET second_check_out_time = p_current_time,
            status = 'CHECKED_OUT'
        WHERE id = v_existing_record.id;
        
        RETURN jsonb_build_object(
            'status', 'Success',
            'message', 'Second check-out recorded',
            'action', 'SECOND_CHECK_OUT'
        );
    
    ELSE
        RETURN jsonb_build_object(
            'status', 'Error',
            'message', 'All attendance actions for today are completed'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;