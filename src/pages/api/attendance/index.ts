import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase';
import { calculateTotalWorkingTime } from '@/utils/attendanceUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select(`
          *,
          employee:employees (
            id,
            name,
            department
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process the records to ensure all required fields are present and calculate working duration
      const processedData = data.map(record => {
        // Calculate working duration if not already present
        const workingDuration = record.working_duration || calculateTotalWorkingTime(record);

        return {
          ...record,
          employee_name: record.employee?.name || 'Unknown',
          first_check_in_time: record.first_check_in_time || record.check_in_time,
          first_check_out_time: record.first_check_out_time || record.check_out_time,
          working_duration: workingDuration,
          status: record.status || 'unknown'
        };
      });

      return res.status(200).json(processedData);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      return res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
} 