-- First drop the policies that depend on deleted_at column
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON attendance;
DROP POLICY IF EXISTS "Enable select access for authenticated users" ON attendance;

-- Drop the check_session_times constraint first
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS check_session_times;

-- Now we can safely drop the soft delete column
ALTER TABLE attendance DROP COLUMN IF EXISTS deleted_at;

-- Create new policies without deleted_at dependency
CREATE POLICY "Enable delete access for authenticated users"
ON attendance
FOR DELETE
TO authenticated
USING (true);

CREATE POLICY "Enable update access for authenticated users"
ON attendance
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON attendance
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable select access for authenticated users"
ON attendance
FOR SELECT
TO authenticated
USING (true);

-- Add a more flexible check_session_times constraint
ALTER TABLE attendance
ADD CONSTRAINT check_session_times
CHECK (
    (
        -- First session validation
        (is_second_session = false AND second_check_in_time IS NULL AND second_check_out_time IS NULL)
        OR
        -- Second session validation
        (is_second_session = true AND first_check_in_time IS NOT NULL)
    )
    AND
    -- Ensure check-out times are after check-in times
    (first_check_out_time IS NULL OR first_check_out_time > first_check_in_time)
    AND
    (second_check_out_time IS NULL OR second_check_out_time > second_check_in_time)
);

-- Drop the soft delete index if it exists
DROP INDEX IF EXISTS idx_attendance_deleted_at;

-- Update the handle_selective_deletion function to use hard delete
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
            -- Hard delete the complete record
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

-- Update the bulk_delete_attendance function to use hard delete
CREATE OR REPLACE FUNCTION bulk_delete_attendance(p_record_ids UUID[])
RETURNS JSONB AS $$
BEGIN
    DELETE FROM attendance
    WHERE id = ANY(p_record_ids);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Records deleted successfully',
        'count', array_length(p_record_ids, 1)
    );
END;
$$ LANGUAGE plpgsql; 