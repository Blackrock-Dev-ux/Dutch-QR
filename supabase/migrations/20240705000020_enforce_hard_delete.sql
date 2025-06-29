-- Drop any existing soft delete related columns and constraints
ALTER TABLE attendance DROP COLUMN IF EXISTS deleted_at;
DROP INDEX IF EXISTS idx_attendance_deleted_at;

-- Update the bulk_delete_attendance function to ensure hard delete
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

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Successfully deleted %s record(s)', v_deleted_count),
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

-- Update the handle_selective_deletion function to ensure hard delete
CREATE OR REPLACE FUNCTION handle_selective_deletion(
    p_record_id UUID,
    p_deletion_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_record RECORD;
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

    -- For complete deletion, just delete the record
    IF p_deletion_type = 'complete' THEN
        DELETE FROM attendance 
        WHERE id = p_record_id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Record deleted successfully'
        );
    END IF;

    -- For partial deletions, update the record
    UPDATE attendance 
    SET 
        first_check_in_time = CASE WHEN p_deletion_type = 'first_check_in' THEN NULL ELSE first_check_in_time END,
        first_check_out_time = CASE WHEN p_deletion_type IN ('first_check_in', 'first_check_out') THEN NULL ELSE first_check_out_time END,
        second_check_in_time = CASE WHEN p_deletion_type IN ('first_check_in', 'first_check_out', 'second_check_in') THEN NULL ELSE second_check_in_time END,
        second_check_out_time = CASE WHEN p_deletion_type IN ('first_check_in', 'first_check_out', 'second_check_in', 'second_check_out') THEN NULL ELSE second_check_out_time END,
        check_in_time = CASE WHEN p_deletion_type = 'first_check_in' THEN NULL ELSE check_in_time END,
        check_out_time = CASE WHEN p_deletion_type IN ('first_check_in', 'first_check_out', 'second_check_out') THEN NULL ELSE check_out_time END,
        break_duration = CASE WHEN p_deletion_type IN ('first_check_in', 'first_check_out', 'second_check_in') THEN NULL ELSE break_duration END,
        total_hours = CASE WHEN p_deletion_type IN ('first_check_in', 'first_check_out', 'second_check_in', 'second_check_out') THEN NULL ELSE total_hours END,
        status = CASE 
            WHEN p_deletion_type = 'first_check_in' THEN 'pending'
            WHEN p_deletion_type = 'first_check_out' THEN 'present'
            WHEN p_deletion_type = 'second_check_in' THEN 'on_break'
            WHEN p_deletion_type = 'second_check_out' THEN 'present'
            ELSE status
        END
    WHERE id = p_record_id;

    -- Check if all time fields are NULL after update
    SELECT * INTO v_record 
    FROM attendance 
    WHERE id = p_record_id;

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