-- Add WhatsApp settings columns
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS is_whatsapp_share_enabled BOOLEAN DEFAULT false;

-- Update existing rows to have default values
UPDATE admin_settings
SET whatsapp_number = '',
    is_whatsapp_share_enabled = false
WHERE whatsapp_number IS NULL;

-- Add comment to columns
COMMENT ON COLUMN admin_settings.whatsapp_number IS 'The WhatsApp number for sharing attendance reports';
COMMENT ON COLUMN admin_settings.is_whatsapp_share_enabled IS 'Whether WhatsApp sharing is enabled';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_settings_whatsapp ON admin_settings(whatsapp_number); 