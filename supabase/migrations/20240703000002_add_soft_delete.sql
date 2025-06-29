-- Add soft delete column to attendance table
ALTER TABLE attendance
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Update the handle_selective_deletion function to use soft delete
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
    WHERE id = p_record_id
    AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Record not found'
        );
    END IF;

    -- Handle different deletion types
    CASE p_deletion_type
        WHEN 'complete' THEN
            -- Soft delete the complete record
            UPDATE attendance 
            SET deleted_at = NOW()
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
            WHERE id = p_record_id
            AND deleted_at IS NULL;

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
            WHERE id = p_record_id
            AND deleted_at IS NULL;

        WHEN 'second_check_in' THEN
            -- If we delete second check-in, we need to clear second check-out
            UPDATE attendance 
            SET second_check_in_time = NULL,
                second_check_out_time = NULL,
                break_duration = NULL,
                total_hours = NULL,
                total_worked_time = v_record.first_check_out_time - v_record.first_check_in_time,
                status = 'on_break'
            WHERE id = p_record_id
            AND deleted_at IS NULL;

        WHEN 'second_check_out' THEN
            -- Only clear second check-out
            UPDATE attendance 
            SET second_check_out_time = NULL,
                check_out_time = NULL,
                total_hours = NULL,
                total_worked_time = v_record.first_check_out_time - v_record.first_check_in_time,
                status = 'present'
            WHERE id = p_record_id
            AND deleted_at IS NULL;

        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid deletion type'
            );
    END CASE;

    -- After any partial deletion, check if all time fields are NULL
    SELECT * INTO v_record 
    FROM attendance 
    WHERE id = p_record_id
    AND deleted_at IS NULL;

    -- If all time fields are NULL after update, soft delete the entire record
    IF v_record.first_check_in_time IS NULL AND 
       v_record.first_check_out_time IS NULL AND 
       v_record.second_check_in_time IS NULL AND 
       v_record.second_check_out_time IS NULL THEN
        
        UPDATE attendance 
        SET deleted_at = NOW()
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

-- Update the delete policy to use soft delete
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON attendance;
CREATE POLICY "Enable delete access for authenticated users"
ON attendance
FOR UPDATE
TO authenticated
USING (deleted_at IS NULL)
WITH CHECK (deleted_at IS NULL);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_deleted_at ON attendance(deleted_at);

-- Update existing functions to exclude deleted records
CREATE OR REPLACE FUNCTION bulk_delete_attendance(p_record_ids UUID[])
RETURNS JSONB AS $$
BEGIN
    UPDATE attendance
    SET deleted_at = NOW()
    WHERE id = ANY(p_record_ids)
    AND deleted_at IS NULL;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Records deleted successfully',
        'count', array_length(p_record_ids, 1)
    );
END;
$$ LANGUAGE plpgsql; 