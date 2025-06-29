import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Employee } from '@/types';
import { addEmployee, updateEmployee, getDepartments } from '@/utils/employeeUtils';

interface EmployeeFormProps {
  employee?: Employee;
  onSave: () => void;
}

const defaultEmployee: Omit<Employee, 'id'> = {
  first_name: '',
  last_name: '',
  email: '',
  department: '',
  position: '',
  phone: '',
  join_date: new Date().toISOString().split('T')[0],
  status: 'active',
  name: ''
};

const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee, onSave }) => {
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>(employee || defaultEmployee);
  const [existingDepartments, setExistingDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    
    const fetchDepartments = async () => {
      try {
        setLoadingDepartments(true);
        const departments = await getDepartments();
        if (mounted) {
          console.log('Fetched departments:', departments);
          setExistingDepartments(departments);
          // If editing and department exists, ensure it's selected
          if (employee?.department && !departments.includes(employee.department)) {
            setExistingDepartments(prev => [...prev, employee.department]);
          }
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        if (mounted) {
          toast({
            title: 'Error',
            description: 'Failed to load departments. Please refresh the page.',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) {
          setLoadingDepartments(false);
        }
      }
    };
    
    fetchDepartments();
    
    return () => {
      mounted = false;
    };
  }, [toast, employee]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.department) {
      toast({
        title: 'Validation Error',
        description: 'Please select a department',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Set the full name before saving
      const fullFormData = {
        ...formData,
        name: `${formData.first_name} ${formData.last_name}`.trim()
      };

      if (employee?.id) {
        // Update existing employee
        const result = await updateEmployee({ ...fullFormData, id: employee.id });
        if (result) {
          toast({
            title: 'Employee Updated',
            description: `${formData.first_name} ${formData.last_name} has been updated successfully.`,
          });
          onSave();
        }
      } else {
        // Add new employee
        const result = await addEmployee(fullFormData);
        if (result) {
          toast({
            title: 'Employee Added',
            description: `${formData.first_name} ${formData.last_name} has been added successfully.`,
          });
          setFormData(defaultEmployee);
          onSave();
        }
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({
        title: 'Error',
        description: 'There was an error saving the employee.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{employee?.id ? 'Edit' : 'Add'} Employee</CardTitle>
      </CardHeader>
      <CardContent>
        {loadingDepartments ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => handleSelectChange('department', value)}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingDepartments.length > 0 ? (
                      existingDepartments.map(dept => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No departments found
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="join_date">Join Date</Label>
                <Input
                  id="join_date"
                  name="join_date"
                  type="date"
                  value={formData.join_date}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleSelectChange('status', value as 'active' | 'inactive')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <Button
                type="submit"
                disabled={loading || !formData.department}
                className="min-w-[120px]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  employee?.id ? 'Update Employee' : 'Add Employee'
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeForm;
