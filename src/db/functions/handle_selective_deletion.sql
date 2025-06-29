CREATE OR REPLACE FUNCTION handle_selective_deletion(
  p_record_id UUID,
  p_deletion_type TEXT
)
RETURNS JSON AS $$
DECLARE
  v_record attendance;
  v_result JSON;
BEGIN
  -- First, get the record
  SELECT * INTO v_record
  FROM attendance
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Record not found'
    );
  END IF;

  -- Handle different deletion types
  CASE p_deletion_type
    WHEN 'first_check_in' THEN
      UPDATE attendance
      SET first_check_in_time = NULL,
          first_check_out_time = NULL, -- Reset dependent fields
          second_check_in_time = NULL,
          second_check_out_time = NULL,
          break_duration = NULL,
          total_hours = NULL,
          status = 'PENDING'
      WHERE id = p_record_id;

    WHEN 'first_check_out' THEN
      UPDATE attendance
      SET first_check_out_time = NULL,
          second_check_in_time = NULL, -- Reset dependent fields
          second_check_out_time = NULL,
          break_duration = NULL,
          total_hours = NULL,
          status = 'CHECKED_IN'
      WHERE id = p_record_id;

    WHEN 'second_check_in' THEN
      UPDATE attendance
      SET second_check_in_time = NULL,
          second_check_out_time = NULL, -- Reset dependent fields
          break_duration = NULL,
          total_hours = NULL,
          status = 'ON_BREAK'
      WHERE id = p_record_id;

    WHEN 'second_check_out' THEN
      UPDATE attendance
      SET second_check_out_time = NULL,
          total_hours = NULL,
          status = 'CHECKED_IN'
      WHERE id = p_record_id;

    WHEN 'complete' THEN
      DELETE FROM attendance
      WHERE id = p_record_id;

    ELSE
      RETURN json_build_object(
        'success', false,
        'error', 'Invalid deletion type'
      );
  END CASE;

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'message', 'Record updated successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql; 