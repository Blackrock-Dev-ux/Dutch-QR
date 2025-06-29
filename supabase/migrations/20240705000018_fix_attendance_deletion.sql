-- Drop existing functions and policies
DROP FUNCTION IF EXISTS bulk_delete_attendance(UUID[]);
DROP FUNCTION IF EXISTS handle_selective_deletion(UUID, TEXT);
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON attendance;

-- Create a more robust bulk delete function
CREATE OR REPLACE FUNCTION bulk_delete_attendance(p_record_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM attendance
        WHERE id = ANY(p_record_ids)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    IF v_deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No records were deleted',
            'count', 0
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Records deleted successfully',
        'count', v_deleted_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'count', 0
    );
END;
$$ LANGUAGE plpgsql;

-- Create a more robust selective deletion function
CREATE OR REPLACE FUNCTION handle_selective_deletion(
    p_record_id UUID,
    p_deletion_type TEXT
) RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
    v_result JSONB;
BEGIN
    -- First, lock the record for update to prevent concurrent modifications
    SELECT * INTO v_record 
    FROM attendance 
    WHERE id = p_record_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Record not found'
        );
    END IF;

    -- Handle different deletion types
    CASE p_deletion_type
        WHEN 'complete' THEN
            DELETE FROM attendance 
            WHERE id = p_record_id;

            RETURN jsonb_build_object(
                'success', true,
                'message', 'Record deleted completely'
            );

        WHEN 'first_check_in' THEN
            UPDATE attendance 
            SET first_check_in_time = NULL,
                first_check_out_time = NULL,
                second_check_in_time = NULL,
                second_check_out_time = NULL,
                check_in_time = NULL,
                check_out_time = NULL,
                break_duration = NULL,
                total_hours = NULL,
                working_duration = '0h 00m',
                status = 'pending'
            WHERE id = p_record_id;

        WHEN 'first_check_out' THEN
            UPDATE attendance 
            SET first_check_out_time = NULL,
                second_check_in_time = NULL,
                second_check_out_time = NULL,
                check_out_time = NULL,
                break_duration = NULL,
                total_hours = NULL,
                working_duration = '0h 00m',
                status = 'present'
            WHERE id = p_record_id;

        WHEN 'second_check_in' THEN
            UPDATE attendance 
            SET second_check_in_time = NULL,
                second_check_out_time = NULL,
                break_duration = NULL,
                total_hours = NULL,
                working_duration = 
                    CASE 
                        WHEN first_check_out_time IS NOT NULL AND first_check_in_time IS NOT NULL
                        THEN format_interval(first_check_out_time - first_check_in_time)
                        ELSE '0h 00m'
                    END,
                status = 'on_break'
            WHERE id = p_record_id;

        WHEN 'second_check_out' THEN
            UPDATE attendance 
            SET second_check_out_time = NULL,
                check_out_time = NULL,
                total_hours = NULL,
                working_duration = 
                    CASE 
                        WHEN first_check_out_time IS NOT NULL AND first_check_in_time IS NOT NULL
                        THEN format_interval(first_check_out_time - first_check_in_time)
                        ELSE '0h 00m'
                    END,
                status = 'present'
            WHERE id = p_record_id;

        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid deletion type'
            );
    END CASE;

    -- Get the updated record
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

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Create a more permissive delete policy
CREATE POLICY "Enable delete access for authenticated users"
ON attendance
FOR DELETE
TO authenticated
USING (true); 