-- Create admin_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_type TEXT NOT NULL,
  send_method TEXT,
  phone_number TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  auto_share_enabled BOOLEAN DEFAULT false,
  email_share_enabled BOOLEAN DEFAULT false
);

-- Add SMTP settings columns
ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS smtp_host TEXT,
ADD COLUMN IF NOT EXISTS smtp_port INTEGER,
ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS smtp_user TEXT,
ADD COLUMN IF NOT EXISTS smtp_pass TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_settings_type ON admin_settings(setting_type);

-- Enable Row Level Security
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
ON admin_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert access for authenticated users"
ON admin_settings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
ON admin_settings FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_settings_timestamp
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_settings_updated_at(); 