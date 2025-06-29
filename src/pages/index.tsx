import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PlusCircle, QrCode, Users, FileText, Clock, Calendar, BarChartHorizontal, Bot, Settings } from 'lucide-react';
import { Employee } from '@/types';
import { getEmployees, deleteEmployee } from '@/utils/employeeUtils';
import EmployeeTable from '@/components/EmployeeTable';
import EmployeeForm from '@/components/EmployeeForm';
import QRScanner from '@/components/QRScanner';
import AttendanceTable from '@/components/AttendanceTable';
import Dashboard from '@/components/Dashboard';
import { useToast } from '@/components/ui/use-toast';
import { toast as sonnerToast } from "sonner";
import QRScanDialog from '@/components/QRScanDialog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import VoiceSettings from '@/components/VoiceSettings';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showQRScanDialog, setShowQRScanDialog] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const data = await getEmployees();
        setEmployees(data);
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast({
          title: 'Error',
          description: 'Failed to load employees',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchEmployees();
    
    const employeesChannel = supabase
      .channel('public:employees')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'employees' }, 
        () => {
          fetchEmployees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(employeesChannel);
    };
  }, [toast]);
  
  const refreshEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error refreshing employees:', error);
    }
  };
  
  const handleAddEmployee = () => {
    setSelectedEmployee(undefined);
    setShowEmployeeForm(true);
    setTimeout(() => {
      setActiveTab('employees');
    }, 0);
  };
  
  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeForm(true);
    setActiveTab('employees');
  };
  
  const handleDeleteEmployee = async (id: string) => {
    try {
      const success = await deleteEmployee(id);
      if (success) {
        toast({
          title: 'Employee Deleted',
          description: 'Employee has been removed successfully',
        });
        await refreshEmployees();
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      sonnerToast.error('Delete Failed', {
        description: 'Could not delete the employee. Please try again.'
      });
    }
  };
  
  const handleFormClose = () => {
    setShowEmployeeForm(false);
    setSelectedEmployee(undefined);
    refreshEmployees();
  };
  
  const handleQuickScan = () => {
    setShowQRScanDialog(true);
  };
  
  const handleScanComplete = (data: { type: string, id: string }) => {
    if (data.type === 'employee') {
      sonnerToast.success('Employee QR Scanned', {
        description: 'Employee ID: ' + data.id
      });
    } else if (data.type === 'gatepass') {
      sonnerToast.info('Gate Pass QR Scanned', {
        description: 'Pass ID: ' + data.id
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">QR Check-In System</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/roster" className="block">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Roster Management
              </CardTitle>
              <CardDescription>
                Manage employee attendance with QR code tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure and monitor the attendance roster
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/gate-pass" className="block">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChartHorizontal className="h-5 w-5 text-green-600" />
                Gate Pass System
              </CardTitle>
              <CardDescription>
                Manage gate pass access with QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure and monitor the gate pass system
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/bot">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                Attendance BOT
              </CardTitle>
              <CardDescription>
                Manage automated attendance reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure and monitor the WhatsApp BOT for attendance summaries
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-5 md:w-auto">
          <TabsTrigger value="dashboard" className="flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="scan" className="flex items-center">
            <QrCode className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Scan QR</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Employees</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard">
          <Dashboard />
        </TabsContent>
        
        <TabsContent value="scan">
          <div className="grid gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">QR Scanner</h2>
              <Button onClick={handleQuickScan}>
                <QrCode className="mr-2 h-4 w-4" />
                Quick Scan
              </Button>
            </div>
            <QRScanner />
          </div>
        </TabsContent>
        
        <TabsContent value="employees">
          <div className="grid gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Employee Management</h2>
              <Button onClick={handleAddEmployee}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </div>
          {showEmployeeForm ? (
            <EmployeeForm 
              employee={selectedEmployee} 
                onClose={handleFormClose}
            />
          ) : (
            <EmployeeTable 
              employees={employees} 
              onEdit={handleEditEmployee} 
              onDelete={handleDeleteEmployee}
                isLoading={loading}
            />
          )}
          </div>
        </TabsContent>
        
        <TabsContent value="attendance">
          <div className="grid gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Attendance Records</h2>
            </div>
          <AttendanceTable />
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">System Settings</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
              <VoiceSettings />
              <Card>
                <CardHeader>
                  <CardTitle>Export Settings</CardTitle>
                  <CardDescription>
                    Configure default export preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Export settings are configured per-export in the Advanced Export dialog.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <QRScanDialog 
        open={showQRScanDialog}
        onOpenChange={setShowQRScanDialog}
        onScanComplete={handleScanComplete}
      />
    </div>
  );
};

export default Index;