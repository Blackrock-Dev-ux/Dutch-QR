import { supabase } from '@/integrations/supabase/client';
import { Employee, GatePass } from '@/types';
import { generateQRCodeForPass as generateQRCode } from './qrCodeUtils';
import QRCode from 'qrcode';

// Generate a unique pass code with better uniqueness guarantee
export const generatePassCode = (): string => {
  // Use a timestamp and random parts for better uniqueness
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  const timestampPart = timestamp.toString(36).slice(-4).toUpperCase();
  const secondRandom = Math.random().toString(36).slice(2, 4).toUpperCase();
  // Create a more structured code format
  const code = `${randomPart}-${timestampPart}-${secondRandom}`;
  console.log('Generated pass code:', code);
  return code;
};

// Calculate expiration date based on validity with more precise timing
export const calculateExpirationDate = (validity: 'single' | 'day' | 'week' | 'month'): Date => {
  const expirationDate = new Date();
  
  switch (validity) {
    case 'single':
      // Single use passes expire in 24 hours
      expirationDate.setHours(expirationDate.getHours() + 24);
      break;
    case 'day':
      // Set to end of current day (23:59:59.999)
      expirationDate.setHours(23, 59, 59, 999);
      break;
    case 'week':
      // Add 7 days and set to end of that day
      expirationDate.setDate(expirationDate.getDate() + 7);
      expirationDate.setHours(23, 59, 59, 999);
      break;
    case 'month':
      // Add 1 month and set to end of that day
      expirationDate.setMonth(expirationDate.getMonth() + 1);
      expirationDate.setHours(23, 59, 59, 999);
      break;
  }
  
  return expirationDate;
};

// Create a new gate pass with improved error handling and time tracking
export const createGatePass = async (
  employeeId: string,
  validity: 'single' | 'day' | 'week' | 'month',
  type: 'entry' | 'exit' | 'both',
  reason: string,
  expectedExitTime?: string,
  expectedReturnTime?: string
): Promise<GatePass | null> => {
  try {
    // Input validation with specific error messages
    if (!employeeId?.trim()) {
      throw new Error('Employee ID is required and cannot be empty');
    }
    
    if (!reason?.trim()) {
      throw new Error('Reason is required and cannot be empty');
    }

    if (!['single', 'day', 'week', 'month'].includes(validity)) {
      throw new Error(`Invalid validity type: ${validity}`);
    }

    if (!['entry', 'exit', 'both'].includes(type)) {
      throw new Error(`Invalid pass type: ${type}`);
    }
    
    // First get the employee's name with better error handling
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('first_name, last_name, id')
      .eq('id', employeeId)
      .maybeSingle();
    
    console.log('Employee lookup result:', { employee, employeeError });
    
    if (employeeError) {
      console.error('Error fetching employee:', {
        error: employeeError,
        details: employeeError.details,
        hint: employeeError.hint,
        code: employeeError.code
      });
      throw new Error(`Failed to fetch employee: ${employeeError.message}`);
    }
    
    if (!employee) {
      throw new Error(`Employee not found with ID: ${employeeId}`);
    }
    
    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
    if (!employeeName) {
      console.warn('Employee name is empty for ID:', employeeId);
    }

    // Generate pass code and expiration date
    const passCode = generatePassCode();
    const expirationDate = calculateExpirationDate(validity);
    
    // Prepare the gate pass data with all required fields
    const gatePassData = {
      employee_id: employee.id,
      pass_code: passCode,
      employee_name: employeeName,
      validity: validity,
      type: type,
      reason: reason.trim(),
      created_by: '00000000-0000-0000-0000-000000000000',
      expires_at: expirationDate.toISOString(),
      status: 'active',
      use_count: 0,
      expected_exit_time: expectedExitTime || null,
      expected_return_time: expectedReturnTime || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Attempting to create gate pass with data:', gatePassData);
    
    // Use RPC for better error handling and atomic operation
    const { data, error } = await supabase
      .rpc('create_gate_pass', {
        p_employee_id: employee.id,
        p_pass_code: passCode,
        p_employee_name: employeeName,
        p_validity: validity,
        p_type: type,
        p_reason: reason.trim(),
        p_created_by: '00000000-0000-0000-0000-000000000000',
        p_expires_at: expirationDate.toISOString()
      });
    
    if (error) {
      // Log the full error for debugging
      console.error('Error creating gate pass:', {
        error,
        details: error.details,
        hint: error.hint,
        code: error.code,
        message: error.message,
        data: gatePassData
      });
      
      // Handle specific error cases
      if (error.code === '23505') {
        // Try generating a new pass code and retry once
        const newPassCode = generatePassCode();
        console.log('Retrying with new pass code:', newPassCode);
        
        const { data: retryData, error: retryError } = await supabase
          .rpc('create_gate_pass', {
            p_employee_id: employee.id,
            p_pass_code: newPassCode,
            p_employee_name: employeeName,
            p_validity: validity,
            p_type: type,
            p_reason: reason.trim(),
            p_created_by: '00000000-0000-0000-0000-000000000000',
            p_expires_at: expirationDate.toISOString()
          });
          
        if (retryError) {
          throw new Error('Failed to create gate pass after retry: ' + retryError.message);
        }
        
        if (!retryData) {
          throw new Error('No data returned after successful retry');
        }
        
        return mapDatabasePassToGatePass(retryData, expectedExitTime, expectedReturnTime);
      }
      
      // Handle other specific error codes
      if (error.code === '23503') {
        throw new Error('Invalid employee reference. Please check the employee ID.');
      }
      
      throw new Error(`Failed to create gate pass: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Failed to create gate pass - no data returned from database');
    }
    
    console.log('Gate pass created successfully:', data);
    
    const mappedPass = mapDatabasePassToGatePass(data, expectedExitTime, expectedReturnTime);
    console.log('Mapped gate pass:', mappedPass);
    
    return mappedPass;
  } catch (error: any) {
    // Enhanced error logging
    console.error('Error in createGatePass:', {
      error,
      message: error.message || 'Unknown error',
      details: error.details,
      hint: error.hint,
      code: error.code,
      stack: error.stack
    });
    
    // Rethrow with a user-friendly message but preserve the original error
    throw new Error(error.message || 'Failed to create gate pass. Please try again.');
  }
};

// Helper function to map database pass to GatePass type
const mapDatabasePassToGatePass = (
  data: any,
  expectedExitTime?: string,
  expectedReturnTime?: string
): GatePass => {
  return {
    id: data.id,
    employeeId: data.employee_id,
    employeeName: data.employee_name,
    passCode: data.pass_code,
    validity: data.validity,
    type: data.type,
    reason: data.reason,
    status: data.status,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    usedAt: data.used_at,
    usedBy: data.used_by,
    expectedExitTime: expectedExitTime || data.expected_exit_time || null,
    expectedReturnTime: expectedReturnTime || data.expected_return_time || null,
    exitTime: data.exit_time,
    returnTime: data.return_time,
    lastUsedAt: data.last_used_at,
    useCount: data.use_count || 0,
    revokedAt: data.revoked_at,
    revokedBy: data.revoked_by,
    revocationReason: data.revocation_reason
  };
};

// Record gate pass usage (exit or return)
export const recordGatePassUsage = async (
  passId: string,
  usageType: 'exit' | 'return',
  time: string
): Promise<{ success: boolean; message?: string }> => {
  try {
    if (!passId) {
      return { success: false, message: 'Pass ID is required' };
    }
    
    // Get the current pass status first to check if it's valid
    const { data: pass, error: getError } = await supabase
      .from('gate_passes')
      .select('*')
      .eq('id', passId)
      .single();
      
    if (getError) {
      console.error('Error fetching gate pass:', getError);
      return { success: false, message: 'Error fetching gate pass' };
    }
    
    if (!pass) {
      return { success: false, message: 'Gate pass not found' };
    }
    
    if (pass.status !== 'active') {
      return { 
        success: false, 
        message: `This pass is ${pass.status} and cannot be used for ${usageType}` 
      };
    }
    
    // For return, check if exit time is recorded
    if (usageType === 'return' && !pass.exit_time) {
      return { 
        success: false, 
        message: 'Cannot record return time without an exit time' 
      };
    }
    
    // Create the correct update data
    let updateData: Record<string, any> = {};
    if (usageType === 'exit') {
      updateData = { exit_time: time };
    } else {
      updateData = { return_time: time };
    }
      
    const { error: updateError } = await supabase
      .from('gate_passes')
      .update(updateData)
      .eq('id', passId);
      
    if (updateError) {
      console.error(`Error recording ${usageType} time:`, updateError);
      return { success: false, message: `Error recording ${usageType} time` };
    }
    
    return { 
      success: true, 
      message: usageType === 'exit' ? 'Exit time recorded' : 'Return time recorded' 
    };
  } catch (error) {
    console.error(`Error recording ${usageType} time:`, error);
    return { success: false, message: `Unexpected error recording ${usageType} time` };
  }
};

// Fetch all gate passes with improved performance and status updates
export const getGatePasses = async (): Promise<GatePass[]> => {
  try {
    console.log('Fetching gate passes');
    const { data: passes, error } = await supabase
      .from('gate_passes')
      .select(`
        id,
        employee_id,
        pass_code,
        validity,
        type,
        reason,
        status,
        created_at,
        expires_at,
        used_at,
        expected_exit_time,
        expected_return_time,
        exit_time,
        return_time,
        employees (id, first_name, last_name)
      `)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching gate passes:', error);
      throw error;
    }
    
    console.log(`Retrieved ${passes?.length || 0} gate passes`);
    
    // Check for expired passes and update them in the database
    const now = new Date();
    const passesToUpdate = [];
    
    // Guard against undefined passes
    if (!passes) {
      return [];
    }
    
    const formattedPasses = passes.map(pass => {
      if (!pass) return null;
      
      const expirationDate = new Date(pass.expires_at);
      let currentStatus = pass.status;
      
      // If pass is active but expired, mark for update
      if (pass.status === 'active' && expirationDate < now) {
        passesToUpdate.push(pass.id);
        currentStatus = 'expired';
      }
      
      return {
        id: pass.id,
        employeeId: pass.employee_id,
        employeeName: pass.employees ? 
          `${pass.employees.first_name || ''} ${pass.employees.last_name || ''}`.trim() : 
          'Unknown Employee',
        passCode: pass.pass_code,
        validity: pass.validity,
        type: pass.type,
        reason: pass.reason,
        status: currentStatus,
        createdAt: pass.created_at,
        expiresAt: pass.expires_at,
        usedAt: pass.used_at,
        expectedExitTime: pass.expected_exit_time,
        expectedReturnTime: pass.expected_return_time,
        exitTime: pass.exit_time,
        returnTime: pass.return_time
      };
    }).filter(Boolean) as GatePass[]; // Filter out any null values and cast
    
    // Batch update expired passes
    if (passesToUpdate.length > 0) {
      console.log(`Updating ${passesToUpdate.length} expired passes`);
      const { error: updateError } = await supabase
        .from('gate_passes')
        .update({ status: 'expired' })
        .in('id', passesToUpdate);
      
      if (updateError) {
        console.error('Error updating expired passes:', updateError);
      }
    }
    
    return formattedPasses;
  } catch (error) {
    console.error('Error fetching gate passes:', error);
    return [];
  }
};

// Completely rewritten verification function for better reliability
export const verifyGatePass = async (passCode: string): Promise<{
  verified: boolean;
  message: string;
  pass?: GatePass;
}> => {
  try {
    if (!passCode?.trim()) {
      return {
        verified: false,
        message: 'Pass code is required and cannot be empty'
      };
    }

    // Clean up and standardize the pass code format
    const cleanPassCode = passCode.trim().toUpperCase();
    
    console.log('Verifying pass code:', {
      original: passCode,
      cleaned: cleanPassCode,
      timestamp: new Date().toISOString()
    });

    // Try to find the pass with exact match first
    let { data: pass, error: queryError } = await supabase
      .from('gate_passes')
      .select(`
        *,
        employees (
          id,
          first_name,
          last_name
        )
      `)
      .eq('pass_code', cleanPassCode)
      .eq('status', 'active')
      .maybeSingle();

    if (queryError) {
      console.error('Database query error:', {
        error: queryError,
        code: queryError.code,
        details: queryError.details
      });
      return {
        verified: false,
        message: 'Error verifying pass code. Please try again.'
      };
    }

    // If no exact match found, try without hyphens
    if (!pass) {
      const noHyphenCode = cleanPassCode.replace(/[^A-Z0-9]/g, '');
      console.log('Trying no-hyphen code:', noHyphenCode);
      
      const { data: altPass, error: altError } = await supabase
        .from('gate_passes')
        .select(`
          *,
          employees (
            id,
            first_name,
            last_name
          )
        `)
        .eq('pass_code', noHyphenCode)
        .eq('status', 'active')
        .maybeSingle();

      if (altError) {
        console.error('Error in alternative pass search:', altError);
        return {
          verified: false,
          message: 'Error verifying pass code. Please try again.'
        };
      }

      if (!altPass) {
        console.log('No valid pass found for codes:', {
          clean: cleanPassCode,
          noHyphens: noHyphenCode
        });
        return {
          verified: false,
          message: 'No valid gate pass found with this code'
        };
      }

      pass = altPass;
    }

    // Check expiration
    const now = new Date();
    const expirationDate = new Date(pass.expires_at);

    if (now > expirationDate) {
      // Update pass to expired status
      const { error: expireError } = await supabase
        .from('gate_passes')
        .update({
          status: 'expired' as const,
          updated_at: now.toISOString()
        })
        .eq('id', pass.id)
        .eq('status', 'active');

      if (expireError) {
        console.error('Error updating expired pass:', expireError);
      }

      return {
        verified: false,
        message: `This pass expired on ${expirationDate.toLocaleString()}`
      };
    }

    // Prepare update data
    const updateData = {
      use_count: (pass.use_count || 0) + 1,
      last_used_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    // For single-use passes, mark as used
    if (pass.validity === 'single') {
      Object.assign(updateData, {
        status: 'used' as const,
        used_at: now.toISOString()
      });
    }

    // Update the pass status
    const { data: updatedPass, error: updateError } = await supabase
      .from('gate_passes')
      .update(updateData)
      .eq('id', pass.id)
      .eq('status', 'active')
      .select(`
        *,
        employees (
          id,
          first_name,
          last_name
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating pass:', {
        error: updateError,
        passId: pass.id,
        updateData
      });
      return {
        verified: false,
        message: 'Error updating pass status. Please try again.'
      };
    }

    if (!updatedPass) {
      console.error('No pass returned after update');
      return {
        verified: false,
        message: 'Error verifying pass. Please try again.'
      };
    }

    // Map and return the verified pass
    const mappedPass = mapDatabasePassToGatePass(updatedPass);
    console.log('Verification successful:', {
      passId: mappedPass.id,
      status: mappedPass.status,
      passCode: mappedPass.passCode,
      timestamp: now.toISOString()
    });

    return {
      verified: true,
      message: 'Valid gate pass. Employee may proceed.',
      pass: mappedPass
    };

  } catch (error: any) {
    console.error('Verification error:', {
      error,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return {
      verified: false,
      message: 'An error occurred during verification. Please try again.'
    };
  }
};

// Helper function to calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + substitutionCost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

// Export the QR code generation function
export { generateQRCode as generateQRCodeForPass };

// Function to generate gate pass image
export const generateGatePassImage = async (pass: GatePass): Promise<Blob> => {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');

  // Set background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add border
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

  // Add header
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, canvas.width, 80);
  
  // Add header text
  ctx.font = 'bold 48px Arial';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('GATE PASS', canvas.width / 2, 55);

  // Add QR code
  const qrCodeDataUrl = await QRCode.toDataURL(pass.passCode, {
    width: 200,
    margin: 1,
    color: {
      dark: '#1d4ed8',
      light: '#ffffff'
    }
  });
  const qrImage = new Image();
  await new Promise((resolve) => {
    qrImage.onload = resolve;
    qrImage.src = qrCodeDataUrl;
  });
  ctx.drawImage(qrImage, 50, 150, 200, 200);

  // Add pass details
  ctx.fillStyle = '#1f2937';
  ctx.textAlign = 'left';
  ctx.font = 'bold 24px Arial';
  
  // Employee details
  ctx.fillText('Employee Name:', 300, 150);
  ctx.font = '24px Arial';
  ctx.fillText(pass.employeeName, 300, 180);
  
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Pass Code:', 300, 220);
  ctx.font = '24px Arial';
  ctx.fillText(pass.passCode, 300, 250);
  
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Type:', 300, 290);
  ctx.font = '24px Arial';
  ctx.fillText(pass.type.toUpperCase(), 300, 320);
  
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Valid Until:', 300, 360);
  ctx.font = '24px Arial';
  ctx.fillText(new Date(pass.expiresAt).toLocaleString(), 300, 390);

  // Add footer
  ctx.font = 'italic 16px Arial';
  ctx.fillStyle = '#6b7280';
  ctx.textAlign = 'center';
  ctx.fillText('This gate pass must be presented upon request', canvas.width / 2, canvas.height - 30);

  // Convert canvas to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else throw new Error('Could not generate gate pass image');
    }, 'image/png');
  });
};

// Delete a gate pass
export const deleteGatePass = async (passId: string): Promise<{ success: boolean; message: string }> => {
  try {
    if (!passId) {
      return { success: false, message: 'Pass ID is required' };
    }

    // Delete the gate pass
    const { error } = await supabase
      .from('gate_passes')
      .delete()
      .eq('id', passId);

    if (error) {
      console.error('Error deleting gate pass:', error);
      return { 
        success: false, 
        message: 'Failed to delete gate pass' 
      };
    }

    return {
      success: true,
      message: 'Gate pass deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting gate pass:', error);
    return {
      success: false,
      message: 'An unexpected error occurred while deleting the gate pass'
    };
  }
};
