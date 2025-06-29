import JSZip from 'jszip';
import { Employee, GatePass } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// Helper function to generate QR code SVG data with improved error handling
const generateQRSVG = async (data: string | Record<string, any>): Promise<string> => {
  // We need to dynamically import QRCode library here
  const QRCode = await import('qrcode');
  
  // Convert object to JSON string if needed
  const qrCodeData = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Generate SVG string directly using QRCode library with better settings
  try {
    // Use QRCode.toString to generate SVG string with optimized settings
    const svgString = await QRCode.toString(qrCodeData, {
      type: 'svg',
      width: 400, // Larger size for better scanning
      margin: 2,  // Slightly larger margin
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H' // Highest error correction
    });
    
    return svgString;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

// Generate QR code for employee with improved data format
export const generateEmployeeQRSVG = async (employee: Employee): Promise<string> => {
  // Always use the legacy format for better compatibility and reliability
  const qrCodeData = generateLegacyQR(employee);
  console.log('Generated employee QR data:', qrCodeData);
  
  return generateQRSVG(qrCodeData);
};

// Generate QR code for gate pass with improved data format
export const generateGatePassQRSVG = async (pass: GatePass): Promise<string> => {
  // Create QR code data that includes pass ID and code with clear type identification
  const qrCodeData = JSON.stringify({
    type: 'gatepass',
    id: pass.id,
    passCode: pass.passCode,
    employeeId: pass.employeeId
  });
  console.log('Generated gate pass QR data:', qrCodeData);
  
  return generateQRSVG(qrCodeData);
};

interface EmployeeQRData {
  id: string;
  name: string;
  email: string;
  department: string;
}

// Legacy format for backward compatibility
const generateLegacyQR = (employee: { id: string; name: string }): string => {
  return `EMP:${employee.id}:${employee.name.replace(/[^a-zA-Z0-9 ]/g, '')}`;
};

export const generateEmployeeQR = (employee: { id: string; name: string; email: string; department: string }): string => {
  // Always use the legacy format
  return generateLegacyQR(employee);
};

export const validateEmployeeQR = async (qrData: string): Promise<boolean> => {
  try {
    // Always try legacy format first as it's the standard format
    const legacyMatch = qrData.match(/^EMP:([^:]+):(.+)$/);
    if (legacyMatch) {
      const [, employeeId] = legacyMatch;
      
      // Verify the employee exists in the database
      const { data: employee, error } = await supabase
        .from('employees')
        .select('id, status')
        .eq('id', employeeId)
        .eq('status', 'active')
        .single();

      if (error || !employee) {
        console.error('Employee not found or inactive:', employeeId);
        return false;
      }
      return true;
    }

    console.error('Invalid QR code format. Expected format: EMP:ID:NAME');
    return false;
  } catch (error) {
    console.error('Error validating QR code:', error);
    return false;
  }
};

export const parseQRCodeData = (qrData: string): { type: 'employee' | 'unknown', id: string } => {
  try {
    // Always try legacy format first as it's the standard format
    const legacyMatch = qrData.match(/^EMP:([^:]+):(.+)$/);
    if (legacyMatch) {
      return { type: 'employee', id: legacyMatch[1] };
    }

    console.error('Invalid QR code format. Expected format: EMP:ID:NAME');
    return { type: 'unknown', id: '' };
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return { type: 'unknown', id: '' };
  }
};

// Generate a PNG from SVG string with improved quality
const svgToPng = async (svgString: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    // When the image is loaded, draw it on the canvas
    img.onload = () => {
      // Set higher resolution for better quality
      const scale = 2;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      
      // Convert the canvas to a blob and resolve
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Could not convert canvas to blob'));
        }
      }, 'image/png', 1.0); // Use highest quality
    };
    
    // Handle load errors
    img.onerror = () => {
      reject(new Error('Failed to load SVG as image'));
    };
    
    // Set the image source to the SVG
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  });
};

// Download all QR codes as a ZIP file
export const downloadAllQRCodes = async (employees: Employee[]): Promise<void> => {
  // Create a new ZIP file
  const zip = new JSZip();
  
  // Process employees in batches to avoid memory issues
  const batchSize = 10;
  const totalEmployees = employees.length;
  
  // Show progress to user
  let processedCount = 0;
  const progressElement = document.createElement('div');
  progressElement.style.position = 'fixed';
  progressElement.style.top = '50%';
  progressElement.style.left = '50%';
  progressElement.style.transform = 'translate(-50%, -50%)';
  progressElement.style.padding = '20px';
  progressElement.style.background = 'rgba(0,0,0,0.7)';
  progressElement.style.color = 'white';
  progressElement.style.borderRadius = '5px';
  progressElement.style.zIndex = '9999';
  document.body.appendChild(progressElement);
  
  for (let i = 0; i < totalEmployees; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);
    
    // Process each employee in the current batch
    await Promise.all(
      batch.map(async (employee) => {
        try {
          // Generate SVG QR code
          const svgData = await generateEmployeeQRSVG(employee);
          
          // Convert SVG to PNG
          const pngBlob = await svgToPng(svgData);
          
          // Add to ZIP file - use a sanitized name for the file
          const safeFileName = (employee.name || `${employee.first_name}_${employee.last_name}`)
            .replace(/[^\w\s]/gi, '_').replace(/\s+/g, '_');
          zip.file(`${safeFileName}_QRCode.png`, pngBlob);
          processedCount++;
          progressElement.textContent = `Processing QR Codes: ${processedCount}/${totalEmployees}`;
        } catch (error) {
          console.error(`Error generating QR code for ${employee.name || `${employee.first_name} ${employee.last_name}`}:`, error);
          // Continue with other employees even if one fails
        }
      })
    );
  }
  
  // Generate the ZIP file
  progressElement.textContent = 'Creating ZIP file...';
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  
  // Remove progress indicator
  document.body.removeChild(progressElement);
  
  // Create a download link and trigger download
  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(zipBlob);
  downloadLink.download = 'employee_qr_codes.zip';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};

// Generate and download QR code for a single gate pass with improved output
export const generateQRCodeForPass = async (pass: GatePass): Promise<Blob | null> => {
  try {
    // Generate SVG QR code
    const svgData = await generateGatePassQRSVG(pass);
    
    // Convert SVG to PNG
    const pngBlob = await svgToPng(svgData);
    return pngBlob;
  } catch (error) {
    console.error('Error generating gate pass QR code:', error);
    return null;
  }
};
