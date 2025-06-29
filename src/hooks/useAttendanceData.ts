import { useState, useEffect, useCallback, useRef } from 'react';
import { Attendance } from '@/types';
import { getAttendanceRecords } from '@/utils/attendanceUtils';
import { getDepartments } from '@/utils/employeeUtils';

const CACHE_DURATION = 30 * 1000; // 30 seconds cache

interface AttendanceCache {
  data: Attendance[];
  timestamp: number;
}

interface DepartmentCache {
  data: string[];
  timestamp: number;
}

export function useAttendanceData(refreshTrigger = 0) {
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [departments, setDepartments] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache refs
  const attendanceCacheRef = useRef<AttendanceCache | null>(null);
  const departmentCacheRef = useRef<DepartmentCache | null>(null);

  // Check if cache is valid
  const isCacheValid = useCallback((cache: { timestamp: number }) => {
    return Date.now() - cache.timestamp < CACHE_DURATION;
  }, []);

  // Fetch departments with caching
  const fetchDepartments = useCallback(async () => {
    try {
      // Check cache first
      if (departmentCacheRef.current && isCacheValid(departmentCacheRef.current)) {
        setDepartments(['all', ...departmentCacheRef.current.data]);
        return;
      }

      const deptData = await getDepartments();
      departmentCacheRef.current = {
        data: deptData,
        timestamp: Date.now()
      };
      setDepartments(['all', ...deptData]);
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('Failed to load departments');
    }
  }, [isCacheValid]);

  // Fetch attendance records with caching
  const fetchAttendance = useCallback(async () => {
    try {
      // Check cache first
      if (attendanceCacheRef.current && isCacheValid(attendanceCacheRef.current)) {
        setAttendanceRecords(attendanceCacheRef.current.data);
        return;
      }

      const data = await getAttendanceRecords();
      
      // Process and normalize data
      const processedData = data.map(record => ({
        ...record,
        date: record.date || new Date(record.check_in_time || record.first_check_in_time).toISOString().split('T')[0]
      }));

      // Update cache
      attendanceCacheRef.current = {
        data: processedData,
        timestamp: Date.now()
      };

      setAttendanceRecords(processedData);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      setError('Failed to load attendance records');
    }
  }, [isCacheValid]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        fetchDepartments(),
        fetchAttendance()
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchDepartments, fetchAttendance]);

  // Initial fetch and refresh handling
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Force refresh method
  const forceRefresh = useCallback(() => {
    // Clear caches
    attendanceCacheRef.current = null;
    departmentCacheRef.current = null;
    // Fetch fresh data
    fetchData();
  }, [fetchData]);

  return {
    attendanceRecords,
    departments,
    loading,
    error,
    forceRefresh
  };
} 