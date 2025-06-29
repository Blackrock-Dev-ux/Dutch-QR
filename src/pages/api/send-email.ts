import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

// Validate SMTP config
const validateSMTPConfig = (config: any): { isValid: boolean; error?: string } => {
  if (!config.host || typeof config.host !== 'string') {
    return { isValid: false, error: 'Invalid SMTP host' };
  }

  if (!config.port || typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
    return { isValid: false, error: 'Invalid SMTP port' };
  }

  if (!config.auth || !config.auth.user || !config.auth.pass) {
    return { isValid: false, error: 'Invalid SMTP credentials' };
  }

  return { isValid: true };
};

// Validate email options
const validateEmailOptions = (options: any): { isValid: boolean; error?: string } => {
  if (!options.from || typeof options.from !== 'string') {
    return { isValid: false, error: 'Invalid sender email' };
  }

  if (!options.to || typeof options.to !== 'string') {
    return { isValid: false, error: 'Invalid recipient email' };
  }

  if (!options.subject || typeof options.subject !== 'string') {
    return { isValid: false, error: 'Subject is required' };
  }

  if (!options.html && !options.text) {
    return { isValid: false, error: 'Email content is required' };
  }

  return { isValid: true };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { transporter: transporterConfig, mailOptions } = req.body;

    // Validate request body
    if (!transporterConfig || !mailOptions) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Validate SMTP configuration
    const smtpValidation = validateSMTPConfig(transporterConfig);
    if (!smtpValidation.isValid) {
      return res.status(400).json({ error: smtpValidation.error });
    }

    // Validate email options
    const emailValidation = validateEmailOptions(mailOptions);
    if (!emailValidation.isValid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    // Create transporter with timeout
    const transporter = nodemailer.createTransport({
      ...transporterConfig,
      connectionTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
      greetingTimeout: 5000 // 5 seconds
    });

    // Verify SMTP connection
    try {
      await transporter.verify();
    } catch (error) {
      console.error('SMTP Connection Error:', error);
      return res.status(500).json({ 
        error: 'Failed to connect to SMTP server',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Send email with retry logic
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const info = await transporter.sendMail(mailOptions);
        return res.status(200).json({ 
          success: true, 
          messageId: info.messageId,
          attempts: attempt
        });
      } catch (error) {
        lastError = error;
        console.error(`Email sending attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // If we get here, all attempts failed
    return res.status(500).json({ 
      error: 'Failed to send email after multiple attempts',
      details: lastError instanceof Error ? lastError.message : 'Unknown error'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 