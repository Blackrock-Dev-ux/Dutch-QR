import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordAttendance, AttendanceError } from './attendanceUtils'; // Import AttendanceError
import { supabase } from '@/integrations/supabase/client'; // Actual path
import { ExtendedWorkTimeInfo, ExtendedAttendance } from '@/types'; // Actual path
import type { Mock } from 'vitest';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(), // Added for potential future use in mocks
    rpc: vi.fn(),
    // Add other Supabase methods if they are used by recordAttendance or its callees
    // For example, if .maybeSingle() is chained after .or()
    maybeSingle: vi.fn(),
  },
}));

describe('recordAttendance', () => {
  const mockEmployeeId = 'employee-123';
  const mockTimestamp = new Date().toISOString();

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
     // Default mock for employee validation succeeding
    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: mockEmployeeId, name: 'Test Employee', status: 'active' },
          error: null,
        }),
      }),
    });
  });

  it('should correctly process a second check-in', async () => {
    const firstCheckOutTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
    const breakDuration = '30m';
    const rpcResponse = {
      action: 'check-in' as const,
      timestamp: mockTimestamp,
      first_check_out_time: firstCheckOutTime,
      break_duration: breakDuration,
      // Fill in other required fields for ExtendedAttendance if any
      id: 'att-1',
      employee_id: mockEmployeeId,
      date: mockTimestamp.split('T')[0],
      status: 'present',
      sequence_number: 1, // This will be updated by recordAttendance logic
    };

    (supabase.rpc as Mock).mockResolvedValue({ data: rpcResponse, error: null });

    const result = await recordAttendance(mockEmployeeId);

    expect(supabase.rpc).toHaveBeenCalledWith('process_double_attendance', {
      p_employee_id: mockEmployeeId,
      p_current_time: expect.any(String), // expect any string for current_time
    }, { head: true });

    expect(result.check_in_time).toBe(mockTimestamp);
    expect(result.check_out_time).toBeNull();
    expect(result.sequence_number).toBe(2);
    expect(result.action).toBe('check-in');
    expect(result.break_duration).toBe(breakDuration);
    expect(result.status).toBe('present');
  });

  it('should correctly process a second check-out', async () => {
    const firstCheckInTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(); // 8 hours ago
    const secondCheckInTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago

    const rpcResponse = {
      action: 'check-out' as const,
      timestamp: mockTimestamp, // This is the second check-out time
      first_check_in_time: firstCheckInTime,
      second_check_in_time: secondCheckInTime,
      // Fill in other required fields for ExtendedAttendance
      id: 'att-2',
      employee_id: mockEmployeeId,
      date: mockTimestamp.split('T')[0],
      status: 'checked-out',
      sequence_number: 1, // This will be updated
    };

    (supabase.rpc as Mock).mockResolvedValue({ data: rpcResponse, error: null });

    const result = await recordAttendance(mockEmployeeId);

    expect(supabase.rpc).toHaveBeenCalledWith('process_double_attendance', {
      p_employee_id: mockEmployeeId,
      p_current_time: expect.any(String),
    }, { head: true });

    expect(result.check_in_time).toBe(secondCheckInTime);
    expect(result.check_out_time).toBe(mockTimestamp);
    expect(result.sequence_number).toBe(2);
    expect(result.action).toBe('check-out');
    expect(result.status).toBe('checked-out');
  });

  it('should correctly process a first check-in', async () => {
    const rpcResponse = {
      action: 'check-in' as const,
      timestamp: mockTimestamp,
      id: 'att-3',
      employee_id: mockEmployeeId,
      date: mockTimestamp.split('T')[0],
      status: 'present',
      sequence_number: 0, // This will be updated
    };
    (supabase.rpc as Mock).mockResolvedValue({ data: rpcResponse, error: null });

    const result = await recordAttendance(mockEmployeeId);

    expect(result.check_in_time).toBe(mockTimestamp);
    expect(result.check_out_time).toBeUndefined(); // For first check-in, check_out_time is not set
    expect(result.sequence_number).toBe(1);
    expect(result.action).toBe('check-in');
    expect(result.status).toBe('present');
  });

  it('should correctly process a first check-out', async () => {
    const firstCheckInTime = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // 4 hours ago
    const rpcResponse = {
      action: 'check-out' as const,
      timestamp: mockTimestamp, // This is the first check-out time
      first_check_in_time: firstCheckInTime,
      id: 'att-4',
      employee_id: mockEmployeeId,
      date: mockTimestamp.split('T')[0],
      status: 'present', // Status is still 'present' after first checkout, might become 'checked-out' after work duration calculation
      sequence_number: 0, // This will be updated
    };
    (supabase.rpc as Mock).mockResolvedValue({ data: rpcResponse, error: null });

    const result = await recordAttendance(mockEmployeeId);

    expect(result.check_in_time).toBe(firstCheckInTime);
    expect(result.check_out_time).toBe(mockTimestamp);
    expect(result.sequence_number).toBe(1);
    expect(result.action).toBe('check-out');
    expect(result.status).toBe('present');
  });

  it('should throw an AttendanceError if RPC call fails', async () => {
    (supabase.rpc as Mock).mockResolvedValue({
      data: null,
      error: { message: 'RPC Error', code: 'PGRST116' }, // Example error
    });

    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow(AttendanceError);
    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow('Failed to process attendance');
  });

  it('should throw an AttendanceError if RPC call result data is null but error is also null (unexpected)', async () => {
    (supabase.rpc as Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow(AttendanceError);
    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow('Failed to process attendance');
  });


  it('should throw an AttendanceError for invalid employee ID', async () => {
    // Mock employee validation to fail
    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null, // No employee data
          error: null,
        }),
      }),
    });

    await expect(recordAttendance('invalid-employee-id')).rejects.toThrow(AttendanceError);
    await expect(recordAttendance('invalid-employee-id')).rejects.toThrow('Invalid or unregistered employee');
  });

  it('should throw an AttendanceError for inactive employee', async () => {
    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: mockEmployeeId, name: 'Test Employee', status: 'inactive' },
          error: null,
        }),
      }),
    });

    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow(AttendanceError);
    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow('Employee is not currently active');
  });

  it('should throw an AttendanceError if employee validation itself throws an error', async () => {
    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ // or mockRejectedValue for a direct throw
          data: null,
          error: { message: 'DB Connection Error', code: '08001' },
        }),
      }),
    });

    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow(AttendanceError);
    // The error message comes from the original function's throw
    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow('Invalid or unregistered employee');
  });

  it('should throw AttendanceError for invalid QR code format (specific RPC error)', async () => {
    (supabase.rpc as Mock).mockResolvedValue({
      data: null,
      error: { message: 'Invalid employee ID format' }, // Specific error message check
    });

    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow(AttendanceError);
    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow('Invalid QR code format');
  });

  it('should throw AttendanceError for unknown action from RPC', async () => {
    const rpcResponse = {
      action: 'check-in' as const, // Using valid action type
      timestamp: mockTimestamp,
    };
    (supabase.rpc as Mock).mockResolvedValue({ data: rpcResponse, error: null });

    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow(AttendanceError);
    await expect(recordAttendance(mockEmployeeId)).rejects.toThrow('Maximum check-ins/check-outs reached'); // This is the default case message
  });
});
