import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Employee } from '@/types';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use a raw SQL query to avoid foreign key relationship issues
        const { data: employeeData, error: empError } = await supabase
        .rpc('get_employees_with_departments', {});

      if (empError) {
        console.error('Error fetching employees:', empError);
        throw empError;
      }

      // Map the data to our Employee type
      const mappedData = employeeData?.map(emp => ({
          id: emp.id,
        name: emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          first_name: emp.first_name || '',
          last_name: emp.last_name || '',
          email: emp.email,
          phone: emp.phone,
        position: emp.position,
        status: emp.status as 'active' | 'inactive',
          join_date: emp.join_date,
        department: emp.department_name || 'Unknown'
      })) || [];

      setEmployees(mappedData);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch employees'));
    } finally {
      setLoading(false);
    }
  };

  return { employees, loading, error, refetch: fetchEmployees };
} 