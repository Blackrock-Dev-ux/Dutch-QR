export interface Employee {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department: string;
  department_id?: string;
  position: string | null;
  phone: string | null;
  join_date: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export type AttendanceStatus = 
  | 'PRESENT'
  | 'ABSENT'
  | 'COMPLETED'
  | 'ON_BREAK'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'FIRST_SESSION_ACTIVE'
  | 'FIRST_CHECK_OUT'
  | 'SECOND_SESSION_ACTIVE'
  | 'SECOND_CHECK_OUT';

export interface Attendance {
  id: string;
  employee_id: string;
  roster_id: string;
  employee_name: string;
  employee: {
    id: string;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    department: string;
    position: string;
    status: 'active' | 'inactive';
    join_date: string;
    phone: string | null;
  };
  date: string;
  first_check_in_time: string | null;
  first_check_out_time: string | null;
  second_check_in_time: string | null;
  second_check_out_time: string | null;
  status: AttendanceStatus;
  minutes_late: number;
  early_departure_minutes: number;
  break_duration: number;
  expected_hours: number;
  actual_hours: number;
  working_duration: string;
  action: AttendanceAction;
  roster: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
    break_duration: number;
    grace_period: number;
    early_departure_threshold: number;
  };
  created_at: string;
  updated_at: string;
}

export interface ExtendedAttendance extends Attendance {
  first_check_in_time?: string;
  first_check_out_time?: string;
  second_check_in_time?: string;
  second_check_out_time?: string;
  break_duration?: string;
  action?: AttendanceAction;
  timestamp?: string;
}

export interface GatePass {
  id: string;
  employeeId: string;
  employeeName: string;
  passCode: string;
  validity: 'single' | 'day' | 'week' | 'month' | 'custom';
  type: 'entry' | 'exit' | 'both';
  reason: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
  usedBy?: string | null;
  expectedExitTime?: string | null;
  expectedReturnTime?: string | null;
  exitTime?: string | null;
  returnTime?: string | null;
  lastUsedAt?: string | null;
  useCount: number;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
  customValidity?: {
    hours: number;
    minutes: number;
  };
}

export interface WorkTimeInfo {
  check_in_time: string;
  check_out_time?: string;
  total_hours?: number;
  late_duration?: number;
  status: 'present' | 'checked-out';
  sequence_number: number;
}

export interface ExtendedWorkTimeInfo extends WorkTimeInfo {
  first_check_in_time: string | null;
  first_check_out_time: string | null;
  second_check_in_time: string | null;
  second_check_out_time: string | null;
  status: 'present' | 'checked-out';
  sequence_number: number;
  action: AttendanceAction;
  late_duration: number;
  timestamp: string;
  break_duration?: number;
  is_second_session: boolean;
  check_in_time: string;
  check_out_time: string | null;
  working_duration: string;
}

export interface CustomPostgrestResponse<T> {
  data: T & {
    action?: string;
    timestamp?: string;
    first_check_in_time?: string;
    first_check_out_time?: string;
    second_check_in_time?: string;
    second_check_out_time?: string;
    break_duration?: string;
    total_hours?: number;
    message?: string;
  };
  error: null | {
    message: string;
  };
}

// Attendance-related types
export type AttendanceAction = 'first_check_in' | 'first_check_out' | 'second_check_in' | 'second_check_out';

// Attendance Summary Interface
export interface AttendanceSummary {
  totalEmployees: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  checkedOutCount: number;
  onTime: number;
  stillWorking: number;
  currentPresenceRate: string;
  totalPresentRate: string;
  presentRate: string; // Alias for compatibility
  onTimeRate: string;
  lateRate: string;
  absentRate: string;
  detailed: {
    onTime: number;
    lateArrivals: number;
    veryLate: number;
    halfDay: number;
    earlyDepartures: number;
    overtime: number;
    regularHours: number;
    attendanceRate: string;
    efficiencyRate: string;
    punctualityRate: string;
  };
  presenceBreakdown: {
    currentlyPresent: number;
    lateButPresent: number;
    checkedOut: number;
    onTimeArrivals: number;
    absent: number;
  };
}

export interface Roster {
  id: string;
  name: string;
  description?: string;
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  break_duration: number;
  grace_period: number;
  early_departure_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRoster {
  id: string;
  employee_id: string;
  roster_id: string;
  effective_from: string;
  effective_until?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  roster?: Roster;
}

export interface RosterAttendance extends Attendance {
  roster_id: string;
  roster?: Roster;
  minutes_late: number;
  early_departure_minutes: number;
  break_minutes: number;
  expected_hours: number;
  actual_hours: number;
  compliance_rate: number;
}

export interface RosterMetrics {
  total_days: number;
  days_present: number;
  days_absent: number;
  total_late_minutes: number;
  total_early_departure_minutes: number;
  average_working_hours: number;
  roster_compliance_rate: number;
  attendance_percentage: number;
}

export interface AdminContactInfo {
  email: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  notification_preferences?: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    telegram: boolean;
  };
}
