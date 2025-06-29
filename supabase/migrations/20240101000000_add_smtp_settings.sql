-- Add SMTP settings columns to admin_settings table
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS smtp_host text,
ADD COLUMN IF NOT EXISTS smtp_port integer,
ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS smtp_user text,
ADD COLUMN IF NOT EXISTS smtp_pass text; 