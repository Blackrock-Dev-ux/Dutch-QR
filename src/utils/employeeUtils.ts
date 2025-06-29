import { supabase } from '../integrations/supabase/client';
import { Employee } from '../types';
import { toast } from '@/components/ui/use-toast';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Define types for database responses
type Department = {
  id: string;
  name: string;
};

type DatabaseEmployee = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  join_date: string;
  status: string;
  department_id: string;
  departments: {
    id: string;
    name: string;
  };
  created_at?: string;
  updated_at?: string;
  name?: string;
};

// Define type for CSV parsing errors
type CSVError = {
  row?: number;
  message: string;
};

// Define type for database responses
type DatabaseResponse<T> = {
  data: T;
  error: Error | null;
};

// Define type for Supabase query builder response
type SupabaseResponse<T> = {
  data: T | null;
  error: {
    message: string;
    details: string;
    hint: string;
    code: string;
  } | null;
};

// Define type for Supabase join response
type WithDepartment<T> = T & {
  departments: Department;
};

export const getEmployees = async (): Promise<Employee[]> => {
  try {
    console.log('Fetching employees...');
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        position,
        join_date,
        status,
        department_id,
        departments:departments!department_id (
          id,
          name
        ),
        created_at,
        updated_at
      `)
      .eq('status', 'active') as SupabaseResponse<DatabaseEmployee[]>;
    
    if (error) {
      console.error('Error fetching employees:', error);
      throw new Error(`Failed to fetch employees: ${error.message}`);
    }
    
    if (!data) {
      console.log('No employees found');
      return [];
    }
    
    console.log('Fetched employees:', data);
    
    // Transform the data to match our Employee type
    return data.map(emp => ({
      id: emp.id,
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      email: emp.email,
      department: emp.departments.name,
      phone: emp.phone,
      position: emp.position,
      join_date: emp.join_date || new Date().toISOString().split('T')[0],
      status: emp.status as 'active' | 'inactive',
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
      created_at: emp.created_at,
      updated_at: emp.updated_at
    }));
  } catch (error) {
    console.error('Error in getEmployees:', error);
    throw error;
  }
};

export const addEmployee = async (employee: Omit<Employee, 'id'>): Promise<Employee | null> => {
  try {
    // Get department_id from department name
    let departmentData: Department & { id: string } | null = null;
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('name', employee.department)
      .single() as SupabaseResponse<Department & { id: string }>;
    
    if (deptError) {
      console.error('Error finding department:', deptError);
      
      // Try to create the department if it doesn't exist
      if (deptError.message.includes('no rows')) {
        const { data: newDept, error: createError } = await supabase
          .from('departments')
          .insert({ name: employee.department })
          .select('id, name')
          .single() as SupabaseResponse<Department & { id: string }>;
          
        if (createError) {
          console.error('Error creating department:', createError);
          toast({
            title: 'Error',
            description: `Failed to create department "${employee.department}"`,
            variant: 'destructive',
          });
          return null;
        }
        
        departmentData = newDept;
      } else {
        toast({
          title: 'Error',
          description: `Error finding department "${employee.department}"`,
          variant: 'destructive',
        });
        return null;
      }
    } else {
      departmentData = deptData;
    }

    if (!departmentData) {
      toast({
        title: 'Error',
        description: 'Department data is missing',
        variant: 'destructive',
      });
      return null;
    }
    
    const { data, error } = await supabase
      .from('employees')
      .insert({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email,
        department_id: departmentData.id,
        phone: employee.phone,
        position: employee.position,
        join_date: employee.join_date,
        status: employee.status,
        name: `${employee.first_name} ${employee.last_name}`.trim()
      })
      .select(`
        *,
        departments!inner (
          name
        )
      `)
      .single() as SupabaseResponse<WithDepartment<DatabaseEmployee>>;
    
    if (error || !data) {
      console.error('Error adding employee:', error);
      toast({
        title: 'Error adding employee',
        description: error?.message || 'Failed to add employee',
        variant: 'destructive',
      });
      return null;
    }
    
    // Return the new employee with the department name
    return {
      id: data.id,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email,
      department: data.departments.name,
      phone: data.phone,
      position: data.position,
      join_date: data.join_date,
      status: data.status as 'active' | 'inactive',
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim()
    };
  } catch (error) {
    console.error('Error adding employee:', error);
    toast({
      title: 'Error',
      description: 'An unexpected error occurred while adding the employee',
      variant: 'destructive',
    });
    return null;
  }
};

export const updateEmployee = async (updatedEmployee: Employee): Promise<Employee | null> => {
  try {
    // Get department_id from department name
    let departmentData: Department & { id: string } | null = null;
    const { data: deptData, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('name', updatedEmployee.department)
      .single() as SupabaseResponse<Department & { id: string }>;
    
    if (deptError) {
      console.error('Error finding department:', deptError);
      
      // Try to create the department if it doesn't exist
      if (deptError.message.includes('no rows')) {
        const { data: newDept, error: createError } = await supabase
          .from('departments')
          .insert({ name: updatedEmployee.department })
          .select('id, name')
          .single() as SupabaseResponse<Department & { id: string }>;
          
        if (createError) {
          console.error('Error creating department:', createError);
          toast({
            title: 'Error',
            description: `Failed to create department "${updatedEmployee.department}"`,
            variant: 'destructive',
          });
          return null;
        }
        
        departmentData = newDept;
      } else {
        toast({
          title: 'Error',
          description: `Error finding department "${updatedEmployee.department}"`,
          variant: 'destructive',
        });
        return null;
      }
    } else {
      departmentData = deptData;
    }

    if (!departmentData) {
      toast({
        title: 'Error',
        description: 'Department data is missing',
        variant: 'destructive',
      });
      return null;
    }
    
    const { data, error } = await supabase
      .from('employees')
      .update({
        first_name: updatedEmployee.first_name,
        last_name: updatedEmployee.last_name,
        email: updatedEmployee.email,
        department_id: departmentData.id,
        phone: updatedEmployee.phone,
        position: updatedEmployee.position,
        join_date: updatedEmployee.join_date,
        status: updatedEmployee.status,
        name: `${updatedEmployee.first_name} ${updatedEmployee.last_name}`.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', updatedEmployee.id)
      .select(`
        *,
        departments!inner (
          name
        )
      `)
      .single() as SupabaseResponse<WithDepartment<DatabaseEmployee>>;
    
    if (error || !data) {
      console.error('Error updating employee:', error);
      toast({
        title: 'Error updating employee',
        description: error?.message || 'Failed to update employee',
        variant: 'destructive',
      });
      return null;
    }
    
    // Return the updated employee with the department name
    return {
      id: data.id,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email,
      department: data.departments.name,
      phone: data.phone,
      position: data.position,
      join_date: data.join_date,
      status: data.status as 'active' | 'inactive',
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim()
    };
  } catch (error) {
    console.error('Error updating employee:', error);
    toast({
      title: 'Error',
      description: 'An unexpected error occurred while updating the employee',
      variant: 'destructive',
    });
    return null;
  }
};

export const deleteEmployee = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting employee:', error);
      toast({
        title: 'Error deleting employee',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting employee:', error);
    return false;
  }
};

export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        position,
        join_date,
        status,
        departments!inner(name)
      `)
      .eq('id', id)
      .single() as SupabaseResponse<WithDepartment<DatabaseEmployee>>;
    
    if (error || !data) {
      console.error('Error fetching employee:', error);
      return null;
    }
    
    // Transform to match our Employee type
    return {
      id: data.id,
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      email: data.email || '',
      department: data.departments.name,
      phone: data.phone || '',
      position: data.position || '',
      join_date: data.join_date,
      status: data.status as 'active' | 'inactive',
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim()
    };
  } catch (error) {
    console.error('Error fetching employee:', error);
    return null;
  }
};

// Define a single source of truth for default departments
export const DEFAULT_DEPARTMENTS = [
      'Dutch Activity',
      'Kitchen',
      'Food & Beverage Department',
      'Butchery',
      'Operations',
      'Maintenance',
      'Reservations',
      'House Keeping',
      'Pastry Kitchen',
      'Stores',
      'Purchasing & Stores',
      'Accounts Department',
      'Administration',
      'Security Department',
      'Transport Section',
      'Human Resources',
  'IT',
  'Finance',
  'Marketing',
  'Sales',
  'Engineering',
  'Research',
  'Development',
  'Customer Service'
].sort();

let cachedDepartments: string[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getDepartments = async (): Promise<string[]> => {
  try {
    // Return cached departments if they exist and are not expired
    const now = Date.now();
    if (cachedDepartments && (now - lastFetchTime) < CACHE_DURATION) {
      return cachedDepartments;
    }

    console.log('Fetching departments from database...');
    const { data, error } = await supabase
      .from('departments')
      .select('name')
      .order('name');
    
    if (error) {
      console.error('Error fetching departments:', error);
      throw new Error(`Failed to fetch departments: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log('No departments found, creating default departments...');
      
      // Create all departments in a single transaction if possible
        const { error: insertError } = await supabase
        .from('departments')
        .insert(DEFAULT_DEPARTMENTS.map(name => ({ name })));
      
      if (insertError) {
        console.warn('Failed to create departments in bulk, falling back to one-by-one:', insertError);
        
        // Fall back to creating departments one by one
        for (const deptName of DEFAULT_DEPARTMENTS) {
          const { error: singleInsertError } = await supabase
          .from('departments')
          .insert({ name: deptName })
          .select('name')
          .single();
        
          if (singleInsertError && !singleInsertError.message.includes('duplicate')) {
            console.warn(`Failed to create department ${deptName}:`, singleInsertError);
          }
        }
      }

      // Fetch the departments again after creation
      const { data: refetchedData, error: refetchError } = await supabase
        .from('departments')
        .select('name')
        .order('name');

      if (refetchError || !refetchedData) {
        console.warn('Failed to fetch departments after creation:', refetchError);
        cachedDepartments = DEFAULT_DEPARTMENTS;
        lastFetchTime = now;
        return DEFAULT_DEPARTMENTS;
      }

      cachedDepartments = refetchedData.map(dept => dept.name);
      lastFetchTime = now;
      return cachedDepartments;
    }
    
    // Update cache with existing departments
    cachedDepartments = data.map(dept => dept.name);
    lastFetchTime = now;
    
    // Check if we need to add any missing departments
    const existingDepts = new Set(cachedDepartments);
    const missingDepts = DEFAULT_DEPARTMENTS.filter(dept => !existingDepts.has(dept));
    
    if (missingDepts.length > 0) {
      console.log('Adding missing departments:', missingDepts);
      
      // Try to add all missing departments in a single transaction
      const { error: bulkInsertError } = await supabase
        .from('departments')
        .insert(missingDepts.map(name => ({ name })));
      
      if (bulkInsertError) {
        console.warn('Failed to add missing departments in bulk, falling back to one-by-one:', bulkInsertError);
        
        // Fall back to adding missing departments one by one
      for (const deptName of missingDepts) {
        const { error: insertError } = await supabase
          .from('departments')
          .insert({ name: deptName })
          .select('name')
          .single();
        
          if (insertError && !insertError.message.includes('duplicate')) {
          console.warn(`Failed to create department ${deptName}:`, insertError);
          } else if (!insertError) {
          cachedDepartments.push(deptName);
          }
        }
      } else {
        // Add successful insertions to cache
        cachedDepartments.push(...missingDepts);
      }
    }
    
    // Sort departments alphabetically
    cachedDepartments.sort();
    console.log('Available departments:', cachedDepartments);
    return cachedDepartments;
  } catch (error) {
    console.error('Error in getDepartments:', error);
    // Return cached departments if available, otherwise return default list
    return cachedDepartments || DEFAULT_DEPARTMENTS;
  }
};

export const bulkImportEmployees = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ total: number; success: number; failed: number; errors: string[] }> => {
  try {
    if (onProgress) onProgress(10);
    const fileData = await parseFileToEmployees(file);
    if (onProgress) onProgress(30);
    
    const results = {
      total: fileData.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Get all existing departments for validation
    const existingDepartments = await getDepartments();
    if (onProgress) onProgress(40);
    
    // Process each employee row
    for (let i = 0; i < fileData.length; i++) {
      const row = fileData[i];
      const rowIndex = i + 2; // +2 because of 0-indexing and header row
      
      try {
        // Validate required fields
        if (!row.first_name) {
          results.failed++;
          results.errors.push(`Row ${rowIndex}: Missing first name`);
          continue;
        }
        
        if (!row.last_name) {
          results.failed++;
          results.errors.push(`Row ${rowIndex}: Missing last name`);
          continue;
        }
        
        if (!row.email) {
          results.failed++;
          results.errors.push(`Row ${rowIndex}: Missing email`);
          continue;
        }
        
        if (!row.department) {
          results.failed++;
          results.errors.push(`Row ${rowIndex}: Missing department`);
          continue;
        }
        
        // Validate department exists
        if (!existingDepartments.includes(row.department)) {
          results.failed++;
          results.errors.push(`Row ${rowIndex}: Department "${row.department}" does not exist`);
          continue;
        }
        
        // Add employee
        const result = await addEmployee({
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          department: row.department,
          position: row.position || '',
          phone: row.phone || '',
          join_date: row.join_date || new Date().toISOString().split('T')[0],
          status: (row.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
          name: `${row.first_name} ${row.last_name}`
        });
        
        if (result) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Row ${rowIndex}: Failed to add employee (${row.first_name} ${row.last_name})`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Row ${rowIndex}: ${(error as Error).message}`);
      }
      
      // Update progress periodically
      if (onProgress) {
        const progressValue = Math.floor(40 + ((i + 1) / fileData.length) * 50);
        onProgress(progressValue);
      }
    }
    
    if (onProgress) onProgress(100);
    return results;
  } catch (error) {
    console.error('Error processing file:', error);
    return {
      total: 0,
      success: 0,
      failed: 0,
      errors: [(error as Error).message]
    };
  }
};

// Helper function to parse either CSV or XLSX files
async function parseFileToEmployees(file: File): Promise<Partial<Employee>[]> {
  return new Promise((resolve, reject) => {
    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            if (results.errors && results.errors.length > 0) {
              const errorMessage = results.errors
                .map(err => `Row ${(err.row ?? 0) + 1}: ${err.message}`)
                .join('\n');
              reject(new Error(`CSV parsing errors:\n${errorMessage}`));
              return;
            }
            const employees = results.data.map(mapRowToEmployee);
            resolve(employees);
          } catch (err) {
            reject(new Error(`Failed to parse CSV: ${err}`));
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error}`));
        }
      });
    } else if (file.name.endsWith('.xlsx')) {
      (async () => {
        try {
          const workbook = XLSX.read(await file.arrayBuffer());
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            reject(new Error('Excel file does not contain any sheets'));
            return;
          }
          
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          if (!firstSheet) {
            reject(new Error('First sheet is empty or invalid'));
            return;
          }
          
          const data = XLSX.utils.sheet_to_json(firstSheet);
          if (!Array.isArray(data) || data.length === 0) {
            reject(new Error('No data found in the Excel file'));
            return;
          }
          
          const employees = data.map(mapRowToEmployee);
          resolve(employees);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          reject(new Error(`Failed to parse Excel file: ${errorMessage}`));
        }
      })();
    } else {
      reject(new Error('Unsupported file format. Please use a CSV or Excel (xlsx) file.'));
    }
  });
}

function mapRowToEmployee(row: any): Partial<Employee> {
  // Convert keys to lowercase and trim whitespace with null safety
  const normalizedRow = Object.keys(row || {}).reduce((acc, key) => {
    acc[key.toLowerCase().trim()] = typeof row[key] === 'string' ? row[key].trim() : row[key];
    return acc;
  }, {} as Record<string, any>);

  // Map common variations of column names
  const data = {
    first_name: normalizedRow.first_name || normalizedRow.firstname || normalizedRow['first name'] || '',
    last_name: normalizedRow.last_name || normalizedRow.lastname || normalizedRow['last name'] || '',
    email: normalizedRow.email || normalizedRow['email address'] || '',
    department: normalizedRow.department || normalizedRow.dept || '',
    phone: normalizedRow.phone || normalizedRow.phone_number || normalizedRow['phone number'] || '',
    position: normalizedRow.position || normalizedRow.title || normalizedRow.role || '',
    join_date: normalizedRow.join_date || normalizedRow.joindate || normalizedRow['join date'] || new Date().toISOString().split('T')[0],
    status: normalizedRow.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active' as 'active' | 'inactive'
  };

  return {
    ...data,
    name: `${data.first_name} ${data.last_name}`.trim()
  };
}