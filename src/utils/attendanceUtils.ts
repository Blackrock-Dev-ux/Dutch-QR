// Attendance Utilities Module
import { supabase } from '@/integrations/supabase/client';
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { 
  Attendance, 
  AttendanceStatus, 
  WorkTimeInfo,
  ExtendedWorkTimeInfo, 
  ExtendedAttendance, 
  CustomPostgrestResponse,
  AttendanceAction, 
  Employee, 
  Roster, 
  RosterAttendance, 
  AdminContactInfo
} from '@/types';
import Swal from 'sweetalert2';

// Using AdminContactInfo from types

// Custom Error Class for Attendance-related Errors
export class AttendanceError extends Error {
  constructor(
    message: string, 
    public code: string = 'ATTENDANCE_ERROR',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AttendanceError';
  }
}

// Attendance Logging Service
class AttendanceLogger {
  private static instance: AttendanceLogger;
  private logBuffer: Array<{
    timestamp: string;
    type: 'check-in' | 'check-out' | 'error';
    employee_id: string;
    details: Record<string, any>;
  }> = [];

  private constructor() {}

  public static getInstance(): AttendanceLogger {
    if (!AttendanceLogger.instance) {
      AttendanceLogger.instance = new AttendanceLogger();
    }
    return AttendanceLogger.instance;
  }

  public log(
    type: 'check-in' | 'check-out' | 'error', 
    employee_id: string, 
    details: Record<string, any>
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type,
      employee_id,
      details
    };

    this.logBuffer.push(logEntry);
    console.log(`Attendance ${type.toUpperCase()} Log:`, logEntry);
    this.persistLogs();
  }

  private async persistLogs(): Promise<void> {
    try {
      if (this.logBuffer.length >= 10) {
        const { error } = await supabase
          .from('attendance_logs')
          .insert(this.logBuffer);

        if (error) {
          console.error('Failed to persist attendance logs:', error);
        } else {
          this.logBuffer = [];
        }
      }
    } catch (error) {
      console.error('Unexpected error in log persistence:', error);
    }
  }
}

// Initialize the logger
const attendanceLogger = AttendanceLogger.getInstance();

// Calculate session metrics utility
const calculateSessionMetrics = (
  firstCheckInTime: Date,
  firstCheckOutTime: Date | null,
  secondCheckInTime: Date | null,
  secondCheckOutTime: Date | null
) => {
  const metrics = {
    totalHours: 0,
    breakDuration: 0,
    status: 'present' as 'present' | 'checked-out',
    isOvertime: false
  };

  // Calculate first session duration
  if (firstCheckOutTime) {
    const firstSessionDuration = (firstCheckOutTime.getTime() - firstCheckInTime.getTime()) / (1000 * 60 * 60);
    metrics.totalHours += firstSessionDuration;
  }

  // Calculate break duration and second session duration
  if (firstCheckOutTime && secondCheckInTime) {
    metrics.breakDuration = (secondCheckInTime.getTime() - firstCheckOutTime.getTime()) / (1000 * 60);
    
    if (secondCheckOutTime) {
      const secondSessionDuration = (secondCheckOutTime.getTime() - secondCheckInTime.getTime()) / (1000 * 60 * 60);
      metrics.totalHours += secondSessionDuration;
      metrics.status = 'checked-out';
    }
  }

  // Check for overtime (more than 8 hours total)
  metrics.isOvertime = metrics.totalHours > 8;

  return metrics;
};

// Utility function to generate a unique timestamp
const generateUniqueTimestamp = async (
  employee_id: string, 
  baseTime: Date, 
  type: 'check-in' | 'check-out'
): Promise<Date> => {
  let uniqueTime = new Date(baseTime);
  let attempt = 0;

  while (attempt < 10) {    // Get the last check-in/check-out for this employee today
    const today = baseTime.toISOString().split('T')[0];
    const { data: lastRecord } = await supabase
      .from('attendance')
      .select('check_in_time, check_out_time')
      .eq('employee_id', employee_id)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // For check-out, ensure minimum 15 minutes from check-in
    if (type === 'check-out' && lastRecord?.check_in_time) {
      const lastCheckIn = new Date(lastRecord.check_in_time);
      const minCheckOutTime = new Date(lastCheckIn.getTime() + 15 * 60 * 1000);
      
      if (baseTime < minCheckOutTime) {
        uniqueTime = minCheckOutTime;
      }
    }

    // For check-in after a check-out, ensure minimum 15 minutes gap
    if (type === 'check-in' && lastRecord?.check_out_time) {
      const lastCheckOut = new Date(lastRecord.check_out_time);
      const minNextCheckIn = new Date(lastCheckOut.getTime() + 15 * 60 * 1000);
      
      if (baseTime < minNextCheckIn) {
        uniqueTime = minNextCheckIn;
      }
    }

    // Add a small offset if needed to ensure uniqueness
    uniqueTime = new Date(uniqueTime.getTime() + 1000 * attempt);

    // Check if this exact timestamp exists for the employee
    const { data: existingRecords, error } = await supabase
      .from('attendance')
      .select('id')
      .eq('employee_id', employee_id)
      .or(
        type === 'check-in' 
          ? `check_in_time.eq.${uniqueTime.toISOString()}`
          : `check_out_time.eq.${uniqueTime.toISOString()}`
      )
      .maybeSingle();

    if (error) {
      console.error('Error checking unique timestamp:', error);
      throw new AttendanceError('Failed to generate unique timestamp');
    }

    // If no record exists with this timestamp, return it
    if (!existingRecords) {
      return uniqueTime;
    }

    attempt++;
  }

  throw new AttendanceError('Unable to generate unique timestamp');
};

// Enhanced Attendance Recording Function
export const recordAttendance = async (employeeId: string): Promise<any> => {
  try {
    // First validate that the employee exists
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, status')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      console.error('Employee validation error:', employeeError);
      throw new AttendanceError('Employee not found or invalid employee ID');
    }

    if (employee.status !== 'active') {
      throw new AttendanceError('Employee is not active in the system');
    }

    // Get today's date and current time
    const today = new Date().toISOString().split('T')[0];
    const currentTime = new Date();

    // Get employee's active roster
    const roster = await getEmployeeRoster(employeeId);
    if (!roster || !roster.id) {
      console.error('No valid roster found for employee:', employeeId);
      throw new AttendanceError('No valid roster found for employee');
    }

    // Get existing attendance record for today
    const { data: existingRecord, error: recordError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (recordError) {
      console.error('Error checking existing attendance:', recordError);
      throw new AttendanceError('Failed to check existing attendance');
    }

    // Determine the next action and status
    let nextAction: AttendanceAction = 'first_check_in';
    let nextStatus = 'CHECKED_IN';

    if (existingRecord) {
      // Determine next action based on existing record
      if (!existingRecord.first_check_out_time && existingRecord.first_check_in_time) {
        nextAction = 'first_check_out';
        nextStatus = 'ON_BREAK';
      } else if (!existingRecord.second_check_in_time && existingRecord.first_check_out_time) {
        nextAction = 'second_check_in';
        nextStatus = 'CHECKED_IN';
      } else if (!existingRecord.second_check_out_time && existingRecord.second_check_in_time) {
        nextAction = 'second_check_out';
        nextStatus = 'COMPLETED';
      } else {
        throw new AttendanceError('All attendance actions completed for today');
      }

      // Validate check times sequence
      const newTime = currentTime.getTime();
      switch (nextAction) {
      case 'first_check_out':
          if (newTime <= new Date(existingRecord.first_check_in_time).getTime()) {
            throw new AttendanceError('Check-out time must be after check-in time');
          }
          break;
        case 'second_check_in':
          if (newTime <= new Date(existingRecord.first_check_out_time).getTime()) {
            throw new AttendanceError('Second check-in time must be after first check-out time');
          }
          break;
        case 'second_check_out':
          if (newTime <= new Date(existingRecord.second_check_in_time).getTime()) {
            throw new AttendanceError('Second check-out time must be after second check-in time');
          }
          break;
      }
    }

    // Calculate metrics
    const minutesLate = calculateLateness(
      nextAction === 'first_check_in' ? currentTime : new Date(existingRecord?.first_check_in_time || ''),
      roster.start_time,
      roster.grace_period
    );

    const earlyDepartureMinutes = nextAction === 'second_check_out' ? 
      calculateEarlyDeparture(currentTime, roster.end_time, roster.early_departure_threshold) : 0;

    const expectedHours = calculateExpectedHours(
      roster.start_time,
      roster.end_time,
      roster.break_duration
    );

    // For second session, create a new record
    if (nextAction === 'second_check_in') {
      const attendanceData = {
        employee_id: employeeId,
        roster_id: roster.id,
        date: today,
        first_check_in_time: currentTime.toISOString(),
        first_check_out_time: null,
          second_check_in_time: null,
          second_check_out_time: null,
        is_second_session: true,
        previous_session_id: existingRecord?.id,
        status: nextStatus,
        minutes_late: minutesLate,
        early_departure_minutes: earlyDepartureMinutes,
        break_duration: roster.break_duration,
        expected_hours: expectedHours,
        last_action: currentTime.toISOString()
      };

      // Process attendance
      const { data: processedAttendance, error: processError } = await supabase
        .from('attendance')
        .insert(attendanceData)
        .select('*, employees(first_name, last_name)')
        .single();

      if (processError) {
        console.error('Error processing attendance:', {
          error: processError,
          details: processError.details,
          hint: processError.hint,
          code: processError.code,
          message: processError.message,
          data: attendanceData
        });

        // Check for specific error cases
        if (processError.message?.includes('valid_check_times')) {
          throw new AttendanceError('Invalid check-in/out sequence. Please try again.');
        } else if (processError.message?.includes('unique_daily_attendance')) {
          throw new AttendanceError('Attendance record already exists for today.');
        } else {
          throw new AttendanceError(`Failed to process attendance: ${processError.message}`);
        }
      }

      if (!processedAttendance) {
        throw new AttendanceError('No attendance record was created');
      }

      // Return the processed attendance record with additional info
        return {
        ...processedAttendance,
        action: nextAction,
        employeeName: `${employee.first_name} ${employee.last_name}`,
        isLate: minutesLate > 0,
        lateMinutes: formatMinutesToHoursMinutes(minutesLate),
        earlyDepartureMinutes: earlyDepartureMinutes,
        actualHours: processedAttendance.actual_hours || 0,
        expectedHours: processedAttendance.expected_hours || expectedHours
      };
    }

    // For other actions, update existing record
    const attendanceData = {
      id: existingRecord?.id, // Include the ID to ensure we update the existing record
      employee_id: employeeId,
      roster_id: roster.id,
      date: today,
      first_check_in_time: nextAction === 'first_check_in' ? currentTime.toISOString() : existingRecord?.first_check_in_time,
      first_check_out_time: nextAction === 'first_check_out' ? currentTime.toISOString() : existingRecord?.first_check_out_time,
      second_check_in_time: nextAction === 'second_check_in' ? currentTime.toISOString() : existingRecord?.second_check_in_time,
      second_check_out_time: nextAction === 'second_check_out' ? currentTime.toISOString() : existingRecord?.second_check_out_time,
      is_second_session: false,
      previous_session_id: null,
      status: nextStatus,
      minutes_late: minutesLate,
      early_departure_minutes: earlyDepartureMinutes,
      break_duration: roster.break_duration,
      expected_hours: expectedHours,
      last_action: currentTime.toISOString()
    };

    // Log the attendance data before processing
    console.log('Processing attendance with data:', {
      nextAction,
      nextStatus,
      attendanceData,
      existingRecord: existingRecord ? {
        id: existingRecord.id,
        status: existingRecord.status,
        first_check_in_time: existingRecord.first_check_in_time,
        first_check_out_time: existingRecord.first_check_out_time,
        second_check_in_time: existingRecord.second_check_in_time,
        second_check_out_time: existingRecord.second_check_out_time
      } : null
    });

    // Process attendance
    const { data: processedAttendance, error: processError } = await supabase
      .from('attendance')
      .upsert(attendanceData)
      .select('*, employees(first_name, last_name)')
      .single();

    if (processError) {
      console.error('Error processing attendance:', {
        error: processError,
        details: processError.details,
        hint: processError.hint,
        code: processError.code,
        message: processError.message,
        data: attendanceData,
        existingRecord: existingRecord ? {
          id: existingRecord.id,
          status: existingRecord.status,
          first_check_in_time: existingRecord.first_check_in_time,
          first_check_out_time: existingRecord.first_check_out_time,
          second_check_in_time: existingRecord.second_check_in_time,
          second_check_out_time: existingRecord.second_check_out_time
        } : null
      });

      // Check for specific error cases
      if (processError.message?.includes('valid_check_times')) {
        throw new AttendanceError('Invalid check-in/out sequence. Please try again.');
      } else if (processError.message?.includes('unique_daily_attendance')) {
        throw new AttendanceError('Attendance record already exists for today.');
      } else {
        throw new AttendanceError(`Failed to process attendance: ${processError.message}`);
      }
    }

    if (!processedAttendance) {
      throw new AttendanceError('No attendance record was created/updated');
    }

    // Return the processed attendance record with additional info
    return {
      ...processedAttendance,
      action: nextAction,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      isLate: minutesLate > 0,
      lateMinutes: minutesLate,
      earlyDepartureMinutes: earlyDepartureMinutes,
      actualHours: processedAttendance.actual_hours || 0,
      expectedHours: processedAttendance.expected_hours || expectedHours
    };
  } catch (error) {
    console.error('Error recording attendance:', error);
    if (error instanceof AttendanceError) {
    throw error;
    }
    throw new AttendanceError(
      error instanceof Error ? error.message : 'Failed to record attendance'
    );
  }
};

// Helper functions for attendance calculations
const calculateLateness = (currentTime: Date, rosterStartTime: string, gracePeriod: number): number => {
  const [hours, minutes] = rosterStartTime.split(':').map(Number);
  const startTime = new Date(currentTime);
  startTime.setHours(hours, minutes, 0, 0);
  
  const lateMinutes = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60));
  return Math.max(0, lateMinutes - gracePeriod);
};

const formatMinutesToHoursMinutes = (totalMinutes: number): string => {
  if (totalMinutes < 0) return "0h 0m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}h ${minutes}m`;
};

const calculateEarlyDeparture = (currentTime: Date, rosterEndTime: string, threshold: number): number => {
  const [hours, minutes] = rosterEndTime.split(':').map(Number);
  const endTime = new Date(currentTime);
  endTime.setHours(hours, minutes, 0, 0);
  
  const earlyMinutes = Math.floor((endTime.getTime() - currentTime.getTime()) / (1000 * 60));
  return Math.max(0, earlyMinutes - threshold);
};

const calculateExpectedHours = (startTime: string, endTime: string, breakDuration: number): number => {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes) - breakDuration;
  return Math.max(0, totalMinutes / 60);
};

const calculateActualHours = (record: any, currentTime: Date, breakDuration: number): number => {
  if (!record?.first_check_in_time) return 0;
  
  let totalMinutes = 0;
  const firstCheckIn = new Date(record.first_check_in_time);
  
  if (record.first_check_out_time) {
    const firstCheckOut = new Date(record.first_check_out_time);
    totalMinutes += Math.floor((firstCheckOut.getTime() - firstCheckIn.getTime()) / (1000 * 60));
  }
  
  if (record.second_check_in_time) {
    const secondCheckIn = new Date(record.second_check_in_time);
    if (record.second_check_out_time) {
      const secondCheckOut = new Date(record.second_check_out_time);
      totalMinutes += Math.floor((secondCheckOut.getTime() - secondCheckIn.getTime()) / (1000 * 60));
    } else {
      totalMinutes += Math.floor((currentTime.getTime() - secondCheckIn.getTime()) / (1000 * 60));
    }
  }
  
  return Math.max(0, (totalMinutes - breakDuration) / 60);
};

const calculateWorkingDuration = (record: any): string | null => {
  let totalMinutes = 0;

  // Calculate first session duration
  if (record.first_check_in_time && record.first_check_out_time) {
    const firstStart = new Date(record.first_check_in_time);
    const firstEnd = new Date(record.first_check_out_time);
    totalMinutes += (firstEnd.getTime() - firstStart.getTime()) / (1000 * 60);
  }

  // Calculate second session duration
  if (record.second_check_in_time && record.second_check_out_time) {
    const secondStart = new Date(record.second_check_in_time);
    const secondEnd = new Date(record.second_check_out_time);
    totalMinutes += (secondEnd.getTime() - secondStart.getTime()) / (1000 * 60);
  }

  if (totalMinutes === 0) return null;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}h ${minutes}m`;
};

// Fetch Attendance Records
export const getAttendanceRecords = async (): Promise<Attendance[]> => {
  try {
    // First, test the connection
    const isConnected = await testSupabaseConnection();
    if (!isConnected) {
      console.error('Failed to connect to Supabase');
      return [];
    }

    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        employee:employee_id (
          id,
          name,
          first_name,
          last_name,
          email,
          department,
          position,
          status,
          join_date,
          phone
        ),
        roster:roster_id (
          id,
          name,
          start_time,
          end_time,
          break_start,
          break_end,
          break_duration,
          grace_period,
          early_departure_threshold
        )
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching attendance records:', error);
      throw new AttendanceError(
        handleSupabaseError(error, 'Failed to fetch attendance records'),
        'FETCH_ERROR',
        { error }
      );
    }

    // Ensure data is an array and transform it to match the Attendance type
    if (!Array.isArray(data)) {
      console.warn('Received non-array data from Supabase:', data);
      return [];
    }

    return data.map(record => ({
      id: record.id || '',
      employee_id: record.employee_id || '',
      roster_id: record.roster_id || '',
      employee_name: record.employee_name || '',
      employee: record.employee || {
        id: '',
        name: '',
        first_name: '',
        last_name: '',
        email: '',
        department: '',
        position: '',
        status: 'inactive',
        join_date: '',
        phone: null
      },
      date: record.date || '',
      first_check_in_time: record.first_check_in_time,
      first_check_out_time: record.first_check_out_time,
      second_check_in_time: record.second_check_in_time,
      second_check_out_time: record.second_check_out_time,
      status: record.status || 'ABSENT',
      minutes_late: record.minutes_late || 0,
      early_departure_minutes: record.early_departure_minutes || 0,
      break_duration: record.break_duration || 0,
      expected_hours: record.expected_hours || 0,
      actual_hours: record.actual_hours || 0,
      working_duration: record.working_duration || '0:00',
      action: record.action || 'first_check_in',
      roster: record.roster || {
        id: '',
        name: '',
        start_time: '',
        end_time: '',
        break_start: null,
        break_end: null,
        break_duration: 0,
        grace_period: 0,
        early_departure_threshold: 0
      },
      created_at: record.created_at || '',
      updated_at: record.updated_at || ''
    }));
  } catch (error) {
    console.error('Unexpected error in getAttendanceRecords:', error);
    return [];
  }
};

// Get Today's Attendance Summary
export const getTodayAttendanceSummary = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch active employees and today's attendance
    const { data: activeEmployees, error: employeeError } = await supabase
      .from('employees')
      .select('id, status')
      .eq('status', 'active');

    if (employeeError) throw employeeError;

    const totalEmployees = activeEmployees?.length || 0;
    
    // Fetch today's attendance records
    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today);

    if (attendanceError) throw attendanceError;

    // Compute attendance metrics
    const statusCounts = {
      currentlyPresent: 0,
      lateButPresent: 0,
      checkedOut: 0,
      onTimeArrivals: 0,
      absent: 0
    };

    attendanceData?.forEach(record => {
      // Handle first check-in/out sequence
      if (record.first_check_in_time && !record.first_check_out_time) {
        statusCounts.currentlyPresent++;
        if (record.minutes_late > 0) {
          statusCounts.lateButPresent++;
        } else {
          statusCounts.onTimeArrivals++;
        }
      }
      // Handle second check-in/out sequence
      else if (record.second_check_in_time && !record.second_check_out_time) {
        statusCounts.currentlyPresent++;
      }
      // Handle completed attendance
      else if (record.second_check_out_time || (record.first_check_out_time && !record.second_check_in_time)) {
        statusCounts.checkedOut++;
        if (record.minutes_late === 0) {
          statusCounts.onTimeArrivals++;
        }
      }
    });

    // Calculate absent count
    statusCounts.absent = Math.max(0, totalEmployees - (statusCounts.currentlyPresent + statusCounts.checkedOut));

    // Compute rates
    const totalPresent = statusCounts.currentlyPresent + statusCounts.checkedOut;
    const rates = {
      currentPresenceRate: totalEmployees > 0 
        ? ((statusCounts.currentlyPresent / totalEmployees) * 100).toFixed(1) 
        : '0.0',
      
      totalPresentRate: totalEmployees > 0 
        ? ((totalPresent / totalEmployees) * 100).toFixed(1) 
        : '0.0',
      
      onTimeRate: totalPresent > 0 
        ? ((statusCounts.onTimeArrivals / totalPresent) * 100).toFixed(1) 
        : '0.0',
      
      lateRate: totalPresent > 0 
        ? ((statusCounts.lateButPresent / totalPresent) * 100).toFixed(1) 
        : '0.0',
      
      absentRate: totalEmployees > 0 
        ? ((statusCounts.absent / totalEmployees) * 100).toFixed(1) 
        : '0.0'
    };

    return {
      totalEmployees: totalEmployees,
      presentCount: totalPresent,
      lateCount: statusCounts.lateButPresent,
      checkedOutCount: statusCounts.checkedOut,
      absentCount: statusCounts.absent,
      onTime: statusCounts.onTimeArrivals,
      stillWorking: statusCounts.currentlyPresent,
      currentPresenceRate: rates.currentPresenceRate,
      totalPresentRate: rates.totalPresentRate,
      presentRate: rates.totalPresentRate,
      onTimeRate: rates.onTimeRate,
      lateRate: rates.lateRate,
      absentRate: rates.absentRate,
      detailed: {
        onTime: statusCounts.onTimeArrivals,
        lateArrivals: statusCounts.lateButPresent,
        veryLate: 0, // Simplified
        halfDay: 0, // Simplified
        earlyDepartures: 0, // Simplified
        overtime: 0, // Simplified
        regularHours: 0, // Simplified
        attendanceRate: rates.totalPresentRate,
        efficiencyRate: rates.onTimeRate,
        punctualityRate: rates.onTimeRate
      },
      presenceBreakdown: statusCounts
    };
  } catch (error) {
    console.error("Error in getTodayAttendanceSummary:", error);
    return {
      totalEmployees: 0,
      presentCount: 0,
      lateCount: 0,
      checkedOutCount: 0,
      absentCount: 0,
      onTime: 0,
      stillWorking: 0,
      currentPresenceRate: "0.0",
      totalPresentRate: "0.0",
      presentRate: "0.0",
      onTimeRate: "0.0",
      lateRate: "0.0",
      absentRate: "0.0",
      detailed: {
        onTime: 0,
        lateArrivals: 0,
        veryLate: 0,
        halfDay: 0,
        earlyDepartures: 0,
        overtime: 0,
        regularHours: 0,
        attendanceRate: "0.0",
        efficiencyRate: "0.0",
        punctualityRate: "0.0"
      },
      presenceBreakdown: {
        currentlyPresent: 0,
        lateButPresent: 0,
        checkedOut: 0,
        onTimeArrivals: 0,
        absent: 0
      }
    };
  }
};

// Calculate attendance metrics for reporting
export const calculateAttendanceMetrics = async (
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<{
  totalDays: number;
  daysPresent: number;
  daysAbsent: number;
  totalLateMinutes: number;
  totalEarlyDepartureMinutes: number;
  averageWorkingHours: number;
  rosterComplianceRate: number;
  attendancePercentage: number;
}> => {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      date,
      minutes_late,
      early_departure_minutes,
      actual_hours,
      expected_hours,
      compliance_rate
    `)
    .eq('employee_id', employeeId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  if (error) {
    throw new Error('Error fetching attendance metrics');
  }

  const metrics = (data || []).reduce((acc, record) => {
    acc.totalLateMinutes += record.minutes_late || 0;
    acc.totalEarlyDepartureMinutes += record.early_departure_minutes || 0;
    acc.totalActualHours += record.actual_hours || 0;
    acc.totalExpectedHours += record.expected_hours || 0;
    acc.totalComplianceRate += record.compliance_rate || 0;
    acc.daysPresent += 1;
    return acc;
  }, {
    totalLateMinutes: 0,
    totalEarlyDepartureMinutes: 0,
    totalActualHours: 0,
    totalExpectedHours: 0,
    totalComplianceRate: 0,
    daysPresent: 0
  });

  // Calculate total working days in the date range
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
    totalDays,
    daysPresent: metrics.daysPresent,
    daysAbsent: totalDays - metrics.daysPresent,
    totalLateMinutes: metrics.totalLateMinutes,
    totalEarlyDepartureMinutes: metrics.totalEarlyDepartureMinutes,
    averageWorkingHours: metrics.daysPresent ? metrics.totalActualHours / metrics.daysPresent : 0,
    rosterComplianceRate: metrics.daysPresent ? metrics.totalComplianceRate / metrics.daysPresent : 0,
    attendancePercentage: (metrics.daysPresent / totalDays) * 100
  };
};

// Calculate working time for an attendance record
export const calculateWorkingTime = (record: {
  first_check_in_time?: string | null;
  first_check_out_time?: string | null;
  second_check_in_time?: string | null;
  second_check_out_time?: string | null;
  break_duration?: number | null;
}): string => {
  if (!record.first_check_in_time) {
    return '0h';
  }

  const now = new Date();
  let totalMinutes = 0;

  // Calculate first session duration
  const firstCheckIn = new Date(record.first_check_in_time);
  const firstCheckOut = record.first_check_out_time ? new Date(record.first_check_out_time) : null;

  if (firstCheckOut) {
    totalMinutes += (firstCheckOut.getTime() - firstCheckIn.getTime()) / (1000 * 60);
  } else {
    // Ongoing first session
    totalMinutes += (now.getTime() - firstCheckIn.getTime()) / (1000 * 60);
    return `${Math.max(0, Math.round(totalMinutes / 60))}h`;
  }

  // Calculate second session duration if exists
  if (record.second_check_in_time) {
    const secondCheckIn = new Date(record.second_check_in_time);
    const secondCheckOut = record.second_check_out_time ? new Date(record.second_check_out_time) : now;
    totalMinutes += (secondCheckOut.getTime() - secondCheckIn.getTime()) / (1000 * 60);
  }

  // Subtract break duration if available and both sessions exist
  if (record.break_duration && record.first_check_out_time && record.second_check_in_time) {
    totalMinutes -= record.break_duration;
  }

  return `${Math.max(0, Math.round(totalMinutes / 60))}h`;
};

// Create a test attendance record for testing purposes
export const createTestAttendanceRecord = (
  employeeId: string,
  options: {
    date?: string;
    firstCheckIn?: string;
    firstCheckOut?: string;
    secondCheckIn?: string;
    secondCheckOut?: string;
    status?: 'present' | 'checked-out';
    minutesLate?: number;
    earlyDeparture?: boolean;
  } = {}
) => {
  const now = new Date();
  const defaultDate = now.toISOString().split('T')[0];
  
  return {
    id: `test-${Date.now()}`,
    employee_id: employeeId,
    date: options.date || defaultDate,
    first_check_in_time: options.firstCheckIn || now.toISOString(),
    first_check_out_time: options.firstCheckOut || null,
    second_check_in_time: options.secondCheckIn || null,
    second_check_out_time: options.secondCheckOut || null,
    status: options.status || 'present',
    minutes_late: options.minutesLate || 0,
    early_departure: options.earlyDeparture || false,
    working_duration: calculateWorkingTime({
      first_check_in_time: options.firstCheckIn,
      first_check_out_time: options.firstCheckOut,
      second_check_in_time: options.secondCheckIn,
      second_check_out_time: options.secondCheckOut
    }),
    sequence_number: options.secondCheckIn ? 2 : 1,
    is_second_session: !!options.secondCheckIn
  };
};

// Delete an attendance record
export const deleteAttendance = async (
  attendanceId: string
): Promise<{ success: boolean; message: string }> => {
  try {
    // Get the attendance record first to check its status
    const { data: record, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('id', attendanceId)
      .single();

    if (fetchError) {
      throw new Error('Failed to fetch attendance record');
    }

    if (!record) {
    return {
        success: false,
        message: 'Attendance record not found'
      };
    }

    // Delete the attendance record
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('id', attendanceId);

    if (deleteError) {
      throw new Error('Failed to delete attendance record');
    }

    // Log the deletion
    attendanceLogger.log('error', record.employee_id, {
      action: 'delete',
      record_id: attendanceId,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      message: 'Attendance record deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting attendance record:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete attendance record'
    };
    }
};

// Save admin contact information
export const saveAdminContactInfo = async (
  contactInfo: AdminContactInfo
): Promise<{ success: boolean; message: string }> => {
  try {
    // First check if a record exists
    const { data: existingData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('id')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows returned
      throw new Error('Failed to check existing settings');
      }

    let result;
    if (existingData?.id) {
      // Update existing record
      result = await supabase
        .from('admin_settings')
          .update({
          email: contactInfo.email,
          phone: contactInfo.phone,
          whatsapp: contactInfo.whatsapp,
          telegram: contactInfo.telegram,
          notification_preferences: contactInfo.notification_preferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingData.id);
      } else {
      // Insert new record
      result = await supabase
        .from('admin_settings')
        .insert({
          ...contactInfo,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }

    if (result.error) {
      throw new Error('Failed to save admin contact information');
    }

    return {
      success: true,
      message: 'Admin contact information saved successfully'
    };
  } catch (error) {
    console.error('Error saving admin contact info:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save admin contact information'
    };
  }
};

interface AttendanceSession {
  first_check_in_time: string | null;
  first_check_out_time: string | null;
  second_check_in_time: string | null;
  second_check_out_time: string | null;
}

export const getNextAttendanceAction = async (employeeId: string): Promise<'first_check_in' | 'first_check_out' | 'second_check_in' | 'second_check_out' | 'completed'> => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { data: record, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (error) {
      console.error('Database error in getNextAttendanceAction:', error);
      return 'first_check_in';
    }

    // No record exists - start with first check in
    if (!record) {
      return 'first_check_in';
    }

    // Determine next action based on existing timestamps
    if (!record.first_check_in_time) {
      return 'first_check_in';
    }
    
    if (!record.first_check_out_time) {
      return 'first_check_out';
    }
    
    if (!record.second_check_in_time) {
      return 'second_check_in';
    }
    
    if (!record.second_check_out_time) {
      return 'second_check_out';
    }

    return 'completed';
  } catch (error) {
    console.error('Error in getNextAttendanceAction:', error);
    return 'first_check_in';
  }
};

export const getCurrentAttendanceState = async (employeeId: string): Promise<'not_checked_in' | 'first_checked_in' | 'first_checked_out' | 'second_checked_in' | 'second_checked_out'> => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { data: record, error } = await supabase
          .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (error || !record) {
      return 'not_checked_in';
    }

    if (record.second_check_out_time) {
      return 'second_checked_out';
    }
    
    if (record.second_check_in_time) {
      return 'second_checked_in';
    }
    
    if (record.first_check_out_time) {
      return 'first_checked_out';
    }
    
    if (record.first_check_in_time) {
      return 'first_checked_in';
    }

    return 'not_checked_in';
  } catch (error) {
    console.error('Error in getCurrentAttendanceState:', error);
    return 'not_checked_in';
  }
};

// Helper function to format duration
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};