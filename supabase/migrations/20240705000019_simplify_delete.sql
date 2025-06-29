-- Drop existing functions
DROP FUNCTION IF EXISTS bulk_delete_attendance(UUID[]);
DROP FUNCTION IF EXISTS handle_selective_deletion(UUID, TEXT);

-- Create a simpler bulk delete function
CREATE OR REPLACE FUNCTION bulk_delete_attendance(p_record_ids UUID[])
RETURNS JSONB AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Perform the delete operation
    DELETE FROM attendance
    WHERE id = ANY(p_record_ids);
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Successfully deleted %s record(s)', v_deleted_count),
        'count', v_deleted_count
    );
END;
$$ LANGUAGE plpgsql;

-- Create a simpler selective deletion function
CREATE OR REPLACE FUNCTION handle_selective_deletion(
    p_record_id UUID,
    p_deletion_type TEXT
)
RETURNS JSONB AS $$
BEGIN
    -- Just delete the record completely
    DELETE FROM attendance 
    WHERE id = p_record_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Record deleted successfully'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql; 