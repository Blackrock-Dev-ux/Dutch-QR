import { createTransport } from 'nodemailer';

export interface SMTPSettings {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Default SMTP configuration
const defaultSMTPConfig: SMTPSettings = {
  host: '',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: '',
    pass: ''
  }
};

// Create SMTP transporter
export const createSMTPTransporter = (settings: SMTPSettings = defaultSMTPConfig) => {
  return createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.auth.user,
      pass: settings.auth.pass,
    },
  });
};

// Validate SMTP settings
export const validateSMTPSettings = (settings: SMTPSettings): boolean => {
  if (!settings.host || !settings.auth.user || !settings.auth.pass) {
    return false;
  }
  return true;
}; 