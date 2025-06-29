-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing types if they exist
DROP TYPE IF EXISTS pass_validity CASCADE;
DROP TYPE IF EXISTS pass_type CASCADE;
DROP TYPE IF EXISTS pass_status CASCADE;

-- Create enum types for better data consistency
CREATE TYPE pass_validity AS ENUM ('single', 'day', 'week', 'month');
CREATE TYPE pass_type AS ENUM ('entry', 'exit', 'both');
CREATE TYPE pass_status AS ENUM ('active', 'used', 'expired', 'revoked');

-- Drop dependent functions first
DROP FUNCTION IF EXISTS create_gate_pass CASCADE;
DROP FUNCTION IF EXISTS update_gate_pass_status CASCADE;
DROP FUNCTION IF EXISTS revoke_gate_pass CASCADE;
DROP FUNCTION IF EXISTS auto_expire_passes CASCADE;

-- Drop existing gate_passes table with CASCADE to handle any remaining dependencies
DROP TABLE IF EXISTS gate_passes CASCADE;
DROP TABLE IF EXISTS gate_pass_logs CASCADE;

-- Create gate pass logs table for audit trail
CREATE TABLE gate_pass_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gate_pass_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_status pass_status,
    new_status pass_status,
    performed_by UUID NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- Recreate gate_passes table with improved structure
CREATE TABLE gate_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pass_code TEXT NOT NULL UNIQUE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    employee_name TEXT NOT NULL,
    validity pass_validity NOT NULL,
    type pass_type NOT NULL,
    reason TEXT NOT NULL,
    status pass_status NOT NULL DEFAULT 'active',
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by UUID,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    revocation_reason TEXT,
    last_used_at TIMESTAMPTZ,
    use_count INTEGER DEFAULT 0,
    CONSTRAINT valid_dates CHECK (expires_at > created_at),
    CONSTRAINT valid_use_count CHECK (
        (validity = 'single' AND use_count <= 1) OR
        (validity != 'single' AND use_count >= 0)
    )
);

-- Enable Row Level Security
ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_pass_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role full access" ON gate_passes;
DROP POLICY IF EXISTS "View own passes" ON gate_passes;
DROP POLICY IF EXISTS "Create passes" ON gate_passes;
DROP POLICY IF EXISTS "Update own passes" ON gate_passes;
DROP POLICY IF EXISTS "Prevent deletions" ON gate_passes;
DROP POLICY IF EXISTS "View own logs" ON gate_pass_logs;
DROP POLICY IF EXISTS "Create log entries" ON gate_pass_logs;
DROP POLICY IF EXISTS "Service role full access to logs" ON gate_pass_logs;

-- Create simplified RLS policies

-- Allow all operations for service_role
CREATE POLICY "admin_all"
ON gate_passes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to do everything except delete
CREATE POLICY "authenticated_select"
ON gate_passes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_insert"
ON gate_passes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_update"
ON gate_passes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Simple policies for logs
CREATE POLICY "logs_all"
ON gate_pass_logs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to log gate pass changes
CREATE OR REPLACE FUNCTION log_gate_pass_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO gate_pass_logs (
        gate_pass_id,
        action,
        old_status,
        new_status,
        performed_by,
        notes
    ) VALUES (
        NEW.id,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'CREATE'
            WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
            ELSE TG_OP
        END,
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
        NEW.status,
        COALESCE(NEW.created_by, NEW.used_by, NEW.revoked_by),
        CASE
            WHEN NEW.status = 'revoked' THEN NEW.revocation_reason
            WHEN NEW.status = 'used' THEN 'Pass used'
            WHEN NEW.status = 'expired' THEN 'Pass expired'
            ELSE NULL
        END
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_gate_passes_updated_at
    BEFORE UPDATE ON gate_passes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER log_gate_pass_changes
    AFTER INSERT OR UPDATE ON gate_passes
    FOR EACH ROW
    EXECUTE FUNCTION log_gate_pass_change();

-- Function to create a gate pass
CREATE OR REPLACE FUNCTION create_gate_pass(
    p_employee_id UUID,
    p_pass_code TEXT,
    p_employee_name TEXT,
    p_validity pass_validity,
    p_type pass_type,
    p_reason TEXT,
    p_created_by UUID,
    p_expires_at TIMESTAMPTZ
) RETURNS gate_passes 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    new_pass gate_passes;
BEGIN
    INSERT INTO gate_passes (
        employee_id,
        pass_code,
        employee_name,
        validity,
        type,
        reason,
        status,
        created_by,
        expires_at
    ) VALUES (
        p_employee_id,
        p_pass_code,
        p_employee_name,
        p_validity,
        p_type,
        p_reason,
        'active',
        p_created_by,
        p_expires_at
    ) RETURNING * INTO new_pass;

    RETURN new_pass;
END;
$$;

-- Function to use a gate pass
CREATE OR REPLACE FUNCTION use_gate_pass(
    p_pass_id UUID,
    p_used_by UUID
) RETURNS gate_passes
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    pass gate_passes;
BEGIN
    -- Get the current pass status
    SELECT * INTO pass
    FROM gate_passes
    WHERE id = p_pass_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gate pass not found';
    END IF;

    IF pass.status != 'active' THEN
        RAISE EXCEPTION 'Gate pass is not active (current status: %)', pass.status;
    END IF;

    IF pass.expires_at < NOW() THEN
        UPDATE gate_passes
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = p_pass_id
        RETURNING * INTO pass;
        
        RAISE EXCEPTION 'Gate pass has expired';
    END IF;

    -- For single-use passes
    IF pass.validity = 'single' THEN
        UPDATE gate_passes
        SET status = 'used',
            used_at = NOW(),
            used_by = p_used_by,
            last_used_at = NOW(),
            use_count = 1
        WHERE id = p_pass_id
        RETURNING * INTO pass;
    ELSE
        -- For multi-use passes, just update the use count and last used time
        UPDATE gate_passes
        SET last_used_at = NOW(),
            use_count = use_count + 1
        WHERE id = p_pass_id
        RETURNING * INTO pass;
    END IF;

    RETURN pass;
END;
$$;

-- Function to revoke a gate pass
CREATE OR REPLACE FUNCTION revoke_gate_pass(
    p_pass_id UUID,
    p_revoked_by UUID,
    p_reason TEXT
) RETURNS gate_passes
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    pass gate_passes;
BEGIN
    UPDATE gate_passes
    SET status = 'revoked',
        revoked_at = NOW(),
        revoked_by = p_revoked_by,
        revocation_reason = p_reason
    WHERE id = p_pass_id
      AND status = 'active'
    RETURNING * INTO pass;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot revoke pass: either not found or not active';
    END IF;

    RETURN pass;
END;
$$;

-- Function to automatically expire passes
CREATE OR REPLACE FUNCTION auto_expire_passes() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE gate_passes
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'active'
      AND expires_at < NOW();
END;
$$;

-- Create a scheduled job to auto-expire passes (needs to be run manually in Supabase dashboard)
COMMENT ON FUNCTION auto_expire_passes() IS 'Automatically expires gate passes that have passed their expiration date';

-- Grant necessary permissions
GRANT ALL ON TABLE gate_passes TO postgres;
GRANT ALL ON TABLE gate_passes TO authenticated;
GRANT ALL ON TABLE gate_pass_logs TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_gate_pass(UUID, TEXT, TEXT, pass_validity, pass_type, TEXT, UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION use_gate_pass(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_gate_pass(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_expire_passes() TO authenticated;

-- Ensure the service role has access
GRANT ALL ON TABLE gate_passes TO service_role;
GRANT ALL ON TABLE gate_pass_logs TO service_role;

-- Ensure functions can be executed by service role
GRANT EXECUTE ON FUNCTION create_gate_pass(UUID, TEXT, TEXT, pass_validity, pass_type, TEXT, UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION use_gate_pass(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION revoke_gate_pass(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION auto_expire_passes() TO service_role; 