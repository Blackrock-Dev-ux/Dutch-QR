-- Add index for pass_code lookups
CREATE INDEX IF NOT EXISTS idx_gate_passes_pass_code ON gate_passes(pass_code);

-- Add a trigger to ensure pass_code is always uppercase and clean
CREATE OR REPLACE FUNCTION clean_pass_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.pass_code = UPPER(REGEXP_REPLACE(NEW.pass_code, '[^A-Z0-9]', '', 'g'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_clean_pass_code
    BEFORE INSERT OR UPDATE ON gate_passes
    FOR EACH ROW
    EXECUTE FUNCTION clean_pass_code(); 