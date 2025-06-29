-- Add deletion_type column to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS deletion_type TEXT CHECK (deletion_type IN ('check_in', 'check_out', NULL));

-- Drop existing function first
DROP FUNCTION IF EXISTS handle_selective_deletion(UUID, TEXT);

-- Create function to handle selective deletion
CREATE OR REPLACE FUNCTION handle_selective_deletion(
    p_record_id UUID,
    p_deletion_type TEXT
) RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
    result JSONB;
BEGIN
    -- Get the record
    SELECT * INTO v_record 
    FROM attendance 
    WHERE id = p_record_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Record not found'
        );
    END IF;

    -- Handle different deletion types
    CASE p_deletion_type
        WHEN 'complete' THEN
            -- Delete the complete record
            DELETE FROM attendance 
            WHERE id = p_record_id;

            RETURN jsonb_build_object(
                'success', true,
                'message', 'Record deleted completely'
            );

        WHEN 'first_check_in' THEN
            -- If we delete first check-in, we need to clear all subsequent records
            UPDATE attendance 
            SET first_check_in_time = NULL,
                first_check_out_time = NULL,
                second_check_in_time = NULL,
                second_check_out_time = NULL,
                check_in_time = NULL,
                check_out_time = NULL,
                break_duration = NULL,
                total_hours = NULL,
                total_worked_time = NULL,
                status = 'pending'
            WHERE id = p_record_id;

        WHEN 'first_check_out' THEN
            -- If we delete first check-out, we need to clear second check-in/out
            UPDATE attendance 
            SET first_check_out_time = NULL,
                second_check_in_time = NULL,
                second_check_out_time = NULL,
                check_out_time = NULL,
                break_duration = NULL,
                total_hours = NULL,
                total_worked_time = NULL,
                status = 'present'
            WHERE id = p_record_id;

        WHEN 'second_check_in' THEN
            -- If we delete second check-in, we need to clear second check-out
            UPDATE attendance 
            SET second_check_in_time = NULL,
                second_check_out_time = NULL,
                break_duration = NULL,
                total_hours = NULL,
                total_worked_time = v_record.first_check_out_time - v_record.first_check_in_time,
                status = 'on_break'
            WHERE id = p_record_id;

        WHEN 'second_check_out' THEN
            -- Only clear second check-out
            UPDATE attendance 
            SET second_check_out_time = NULL,
                check_out_time = NULL,
                total_hours = NULL,
                total_worked_time = v_record.first_check_out_time - v_record.first_check_in_time,
                status = 'present'
            WHERE id = p_record_id;

        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid deletion type'
            );
    END CASE;

    -- After any partial deletion, check if all time fields are NULL
    SELECT * INTO v_record 
    FROM attendance 
    WHERE id = p_record_id;

    -- If all time fields are NULL after update, delete the entire record
    IF v_record.first_check_in_time IS NULL AND 
       v_record.first_check_out_time IS NULL AND 
       v_record.second_check_in_time IS NULL AND 
       v_record.second_check_out_time IS NULL THEN
        
        DELETE FROM attendance 
        WHERE id = p_record_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Record deleted completely'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Record updated successfully',
        'record', row_to_json(v_record)
    );
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON COLUMN attendance.deletion_type IS 'Type of deletion: check_in, check_out, or NULL for complete deletion'; 