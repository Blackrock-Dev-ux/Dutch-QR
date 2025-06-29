import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { differenceInMinutes, parseISO, isSameMinute } from 'date-fns';

// Configuration for attendance actions
const ATTENDANCE_CONFIG = {
  MINIMUM_SESSION_DURATION: 30, // minutes
  MINIMUM_BREAK_DURATION: 15, // minutes
  MAXIMUM_DAILY_SESSIONS: 2,
  MINIMUM_TIME_BETWEEN_ACTIONS: 1 // minimum minutes between any two actions
};

// Custom error for attendance-related issues
class AttendanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttendanceError';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Fetch today's attendance records for this employee
    const { data: existingRecord, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }

    // Check for duplicate timestamps before proceeding
    if (existingRecord) {
      const isDuplicateTimestamp = await checkDuplicateTimestamp(existingRecord, now);
      if (isDuplicateTimestamp) {
        return res.status(400).json({
          error: 'Cannot record attendance at the same timestamp as previous action',
          action: 'error',
          lastActionTime: isDuplicateTimestamp
        });
      }
    }

    // Determine the next attendance action
    const nextAction = determineNextAttendanceAction(existingRecord);

    // Perform the attendance action
    const updatedRecord = await performAttendanceAction(
      employeeId, 
      nextAction, 
      existingRecord, 
      now
    );

    return res.status(200).json({
      message: `Successfully recorded ${nextAction}`,
      action: nextAction,
      record: updatedRecord
    });

  } catch (error) {
    console.error('Attendance recording error:', error);
    
    if (error instanceof AttendanceError) {
      return res.status(400).json({ 
        error: error.message,
        action: 'error'
      });
    }

    return res.status(500).json({ 
      error: 'Failed to record attendance',
      action: 'error'
    });
  }
}

async function checkDuplicateTimestamp(existingRecord: any, currentTime: Date): Promise<string | false> {
  const timestamps = [
    existingRecord.first_check_in_time,
    existingRecord.first_check_out_time,
    existingRecord.second_check_in_time,
    existingRecord.second_check_out_time
  ].filter(Boolean);

  // Check if current time is too close to any existing timestamp
  for (const timestamp of timestamps) {
    const existingTime = parseISO(timestamp);
    if (isSameMinute(currentTime, existingTime) || 
        Math.abs(differenceInMinutes(currentTime, existingTime)) < ATTENDANCE_CONFIG.MINIMUM_TIME_BETWEEN_ACTIONS) {
      return timestamp;
    }
  }

  return false;
}

function determineNextAttendanceAction(existingRecord: any): 
  'first_check_in' | 'first_check_out' | 'second_check_in' | 'second_check_out' {
  // No record exists for today
  if (!existingRecord) {
    return 'first_check_in';
        }

  // First session check-out pending
  if (existingRecord.first_check_in_time && !existingRecord.first_check_out_time) {
    return 'first_check_out';
  }

  // First session completed, no second session started
  if (existingRecord.first_check_out_time && !existingRecord.second_check_in_time) {
    return 'second_check_in';
  }

  // Second session check-out pending
  if (existingRecord.second_check_in_time && !existingRecord.second_check_out_time) {
    return 'second_check_out';
  }

  // All actions completed
  throw new AttendanceError('Maximum daily attendance actions reached');
}

async function performAttendanceAction(
  employeeId: string, 
  action: string, 
  existingRecord: any, 
  currentTime: Date
): Promise<any> {
  // Validate time sequence
  if (existingRecord) {
    validateTimeSequence(action, existingRecord, currentTime);
  }

  switch (action) {
    case 'first_check_in':
      return await createFirstCheckIn(employeeId, currentTime);
    
    case 'first_check_out':
      return await recordFirstCheckOut(existingRecord, currentTime);
    
    case 'second_check_in':
      return await recordSecondCheckIn(existingRecord, currentTime);
    
    case 'second_check_out':
      return await recordSecondCheckOut(existingRecord, currentTime);
    
    default:
      throw new AttendanceError('Invalid attendance action');
  }
}

function validateTimeSequence(action: string, record: any, currentTime: Date): void {
  switch (action) {
    case 'first_check_out':
      if (record.first_check_in_time && currentTime <= parseISO(record.first_check_in_time)) {
        throw new AttendanceError('Check-out time must be after check-in time');
      }
      break;
    
    case 'second_check_in':
      if (record.first_check_out_time && currentTime <= parseISO(record.first_check_out_time)) {
        throw new AttendanceError('Second check-in time must be after first check-out time');
      }
      break;
    
    case 'second_check_out':
      if (record.second_check_in_time && currentTime <= parseISO(record.second_check_in_time)) {
        throw new AttendanceError('Second check-out time must be after second check-in time');
      }
      break;
  }
}

async function createFirstCheckIn(employeeId: string, currentTime: Date) {
      const { data, error } = await supabase
        .from('attendance')
    .insert({
      employee_id: employeeId,
      date: currentTime.toISOString().split('T')[0],
      first_check_in_time: currentTime.toISOString(),
          status: 'CHECKED_IN'
    })
        .select()
        .single();

      if (error) throw error;
  return data;
}

async function recordFirstCheckOut(existingRecord: any, currentTime: Date) {
  // Validate minimum first session duration
  const firstCheckInTime = parseISO(existingRecord.first_check_in_time);
  const sessionDuration = differenceInMinutes(currentTime, firstCheckInTime);
      
  if (sessionDuration < ATTENDANCE_CONFIG.MINIMUM_SESSION_DURATION) {
    throw new AttendanceError(`Minimum first session duration is ${ATTENDANCE_CONFIG.MINIMUM_SESSION_DURATION} minutes`);
      }

      const { data, error } = await supabase
        .from('attendance')
        .update({
      first_check_out_time: currentTime.toISOString(),
      status: 'CHECKED_OUT',
      last_action_time: currentTime.toISOString()
        })
    .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
  return data;
}

async function recordSecondCheckIn(existingRecord: any, currentTime: Date) {
      // Validate break duration
  const firstCheckOutTime = parseISO(existingRecord.first_check_out_time);
  const breakDuration = differenceInMinutes(currentTime, firstCheckOutTime);

  if (breakDuration < ATTENDANCE_CONFIG.MINIMUM_BREAK_DURATION) {
    throw new AttendanceError(`Minimum break duration is ${ATTENDANCE_CONFIG.MINIMUM_BREAK_DURATION} minutes`);
  }

  // Update the existing record with second check-in
      const { data, error } = await supabase
        .from('attendance')
        .update({
      second_check_in_time: currentTime.toISOString(),
      status: 'CHECKED_IN',
      break_duration: `${breakDuration} minutes`,
      last_action_time: currentTime.toISOString()
        })
    .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
  return data;
}

async function recordSecondCheckOut(existingRecord: any, currentTime: Date) {
  // Validate second session duration
  const secondCheckInTime = parseISO(existingRecord.second_check_in_time);
  const sessionDuration = differenceInMinutes(currentTime, secondCheckInTime);

  if (sessionDuration < ATTENDANCE_CONFIG.MINIMUM_SESSION_DURATION) {
    throw new AttendanceError(`Minimum second session duration is ${ATTENDANCE_CONFIG.MINIMUM_SESSION_DURATION} minutes`);
  }

  // Calculate total worked time including both sessions
  const firstSessionDuration = differenceInMinutes(
    parseISO(existingRecord.first_check_out_time), 
    parseISO(existingRecord.first_check_in_time)
  );
  const totalWorkedTime = firstSessionDuration + sessionDuration;

      const { data, error } = await supabase
        .from('attendance')
        .update({ 
      second_check_out_time: currentTime.toISOString(),
      total_worked_time: `${totalWorkedTime} minutes`,
      total_hours: totalWorkedTime / 60,
      status: 'CHECKED_OUT',
      last_action_time: currentTime.toISOString()
        })
    .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
  return data;
} 