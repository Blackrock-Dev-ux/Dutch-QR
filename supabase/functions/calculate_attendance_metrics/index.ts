import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Main function to calculate attendance metrics
export async function calculateAttendanceMetrics() {
  // Create Supabase client
  const supabaseClient = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  // Calculate attendance metrics including break duration
  const { data, error } = await supabaseClient.rpc('calculate_attendance_metrics', {
    start_date: new Date().toISOString(),
    end_date: new Date().toISOString()
  });

  if (error) {
    throw new Error(error.message);
  }

  // Enhanced metrics calculation
  return data.map(record => ({
    ...record,
    break_duration: calculateBreakDuration(
      record.first_check_out_time, 
      record.second_check_in_time
    ),
    total_working_hours: calculateTotalWorkingHours(record)
  }));
}

// Helper function to calculate break duration
function calculateBreakDuration(firstCheckOut: string, secondCheckIn: string): string {
  if (!firstCheckOut || !secondCheckIn) return 'N/A';
  
  const checkOut = new Date(firstCheckOut);
  const checkIn = new Date(secondCheckIn);
  
  const breakDurationMs = checkIn.getTime() - checkOut.getTime();
  const breakHours = Math.floor(breakDurationMs / (1000 * 60 * 60));
  const breakMinutes = Math.floor((breakDurationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${breakHours}:${breakMinutes.toString().padStart(2, '0')}`;
}

// Helper function to calculate total working hours
function calculateTotalWorkingHours(record: any): string {
  const firstWorkDuration = calculateTimeDifference(
    record.first_check_in_time, 
    record.first_check_out_time
  );
  const secondWorkDuration = calculateTimeDifference(
    record.second_check_in_time, 
    record.second_check_out_time
  );

  const totalMinutes = firstWorkDuration + secondWorkDuration;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} hrs ${minutes} mins`;
}

// Helper function to calculate time difference in minutes
function calculateTimeDifference(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  
  return Math.floor((end - start) / (1000 * 60));
}

// If running as a script
if (require.main === module) {
  calculateAttendanceMetrics()
    .then(metrics => console.log(metrics))
    .catch(error => console.error(error));
} 