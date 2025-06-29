// Simple script to seed sample data
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yaacbkoasdxrwavbwsbu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhYWNia29hc2R4cndhdmJ3c2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MTY4MzQsImV4cCI6MjA2MDI5MjgzNH0.yE1Xdci3eqP9vsVVPzYw9ihd5cYdLi985D8p1NSU-lk";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function seedData() {
  try {
    console.log('Starting to seed sample data...');

    // First, add departments
    const departments = [
      { name: 'Human Resources' },
      { name: 'Information Technology' },
      { name: 'Finance & Accounting' },
      { name: 'Marketing & Sales' },
      { name: 'Operations' },
      { name: 'Customer Service' },
      { name: 'Research & Development' },
      { name: 'Quality Assurance' }
    ];

    console.log('Inserting departments...');
    const { data: departmentData, error: deptError } = await supabase
      .from('departments')
      .upsert(departments, { onConflict: 'name' })
      .select();

    if (deptError) {
      console.error('Error inserting departments:', deptError);
      return;
    }

    console.log('Departments inserted successfully:', departmentData?.length);

    // Get department IDs for employees
    const { data: allDepartments, error: fetchDeptError } = await supabase
      .from('departments')
      .select('id, name');

    if (fetchDeptError) {
      console.error('Error fetching departments:', fetchDeptError);
      return;
    }

    // Create sample employees
    const employees = [
      {
        name: 'John Smith',
        first_name: 'John',
        last_name: 'Smith',
        email: 'john.smith@company.com',
        phone: '+1-555-0101',
        department_id: allDepartments?.find(d => d.name === 'Human Resources')?.id,
        position: 'HR Manager',
        status: 'active'
      },
      {
        name: 'Sarah Johnson',
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah.johnson@company.com',
        phone: '+1-555-0102',
        department_id: allDepartments?.find(d => d.name === 'Information Technology')?.id,
        position: 'Software Engineer',
        status: 'active'
      },
      {
        name: 'Michael Brown',
        first_name: 'Michael',
        last_name: 'Brown',
        email: 'michael.brown@company.com',
        phone: '+1-555-0103',
        department_id: allDepartments?.find(d => d.name === 'Finance & Accounting')?.id,
        position: 'Financial Analyst',
        status: 'active'
      },
      {
        name: 'Emily Davis',
        first_name: 'Emily',
        last_name: 'Davis',
        email: 'emily.davis@company.com',
        phone: '+1-555-0104',
        department_id: allDepartments?.find(d => d.name === 'Marketing & Sales')?.id,
        position: 'Marketing Coordinator',
        status: 'active'
      },
      {
        name: 'David Wilson',
        first_name: 'David',
        last_name: 'Wilson',
        email: 'david.wilson@company.com',
        phone: '+1-555-0105',
        department_id: allDepartments?.find(d => d.name === 'Operations')?.id,
        position: 'Operations Manager',
        status: 'active'
      },
      {
        name: 'Lisa Anderson',
        first_name: 'Lisa',
        last_name: 'Anderson',
        email: 'lisa.anderson@company.com',
        phone: '+1-555-0106',
        department_id: allDepartments?.find(d => d.name === 'Customer Service')?.id,
        position: 'Customer Service Representative',
        status: 'active'
      },
      {
        name: 'Robert Garcia',
        first_name: 'Robert',
        last_name: 'Garcia',
        email: 'robert.garcia@company.com',
        phone: '+1-555-0107',
        department_id: allDepartments?.find(d => d.name === 'Research & Development')?.id,
        position: 'Research Scientist',
        status: 'active'
      },
      {
        name: 'Jennifer Martinez',
        first_name: 'Jennifer',
        last_name: 'Martinez',
        email: 'jennifer.martinez@company.com',
        phone: '+1-555-0108',
        department_id: allDepartments?.find(d => d.name === 'Quality Assurance')?.id,
        position: 'QA Engineer',
        status: 'active'
      },
      {
        name: 'William Taylor',
        first_name: 'William',
        last_name: 'Taylor',
        email: 'william.taylor@company.com',
        phone: '+1-555-0109',
        department_id: allDepartments?.find(d => d.name === 'Information Technology')?.id,
        position: 'Senior Developer',
        status: 'active'
      },
      {
        name: 'Amanda Thompson',
        first_name: 'Amanda',
        last_name: 'Thompson',
        email: 'amanda.thompson@company.com',
        phone: '+1-555-0110',
        department_id: allDepartments?.find(d => d.name === 'Human Resources')?.id,
        position: 'HR Specialist',
        status: 'active'
      }
    ];

    console.log('Inserting employees...');
    const { data: employeeData, error: empError } = await supabase
      .from('employees')
      .upsert(employees, { onConflict: 'email' })
      .select();

    if (empError) {
      console.error('Error inserting employees:', empError);
      return;
    }

    console.log('Employees inserted successfully:', employeeData?.length);
    console.log('Sample data seeding completed successfully!');

    return {
      departments: departmentData?.length || 0,
      employees: employeeData?.length || 0
    };

  } catch (error) {
    console.error('Error seeding sample data:', error);
    throw error;
  }
}

seedData().then((result) => {
  console.log('Seeding completed:', result);
  process.exit(0);
}).catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
