import React from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Share2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from 'date-fns';
import { Document, Page, Text, View, PDFDownloadLink } from '@react-pdf/renderer';
import { toast } from '@/components/ui/use-toast';

interface Employee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  position: string | null;
  phone: string | null;
  departments: { name: string } | null;
  status: string;
}

// PDF Document Component
const AbsentEmployeePDF = ({ absentEmployees, startDate, endDate }: { 
  absentEmployees: Employee[], 
  startDate: Date,
  endDate: Date 
}) => {
  // Group employees by department with null safety
  const departmentGroups = (absentEmployees || []).reduce((groups, employee) => {
    const dept = employee.departments?.name || 'Unassigned';
    if (!groups[dept]) {
      groups[dept] = [];
    }
    groups[dept].push(employee);
    return groups;
  }, {} as Record<string, Employee[]>);

  const dateRange = startDate.toISOString().split('T')[0] === endDate.toISOString().split('T')[0]
    ? format(startDate, 'EEEE, MMMM do, yyyy')
    : `${format(startDate, 'MMMM do, yyyy')} - ${format(endDate, 'MMMM do, yyyy')}`;

  return (
    <Document>
      <Page size="A4" style={{ padding: 30, fontFamily: 'Helvetica' }}>
        {/* Header */}
        <View style={{ marginBottom: 20, borderBottom: '1px solid #ccc', paddingBottom: 10 }}>
          <Text style={{ fontSize: 24, textAlign: 'center', color: '#1a1a1a', marginBottom: 5 }}>
            Absent Employees Report
          </Text>
          <Text style={{ fontSize: 14, textAlign: 'center', color: '#666666' }}>
            {dateRange}
          </Text>
        </View>

        {/* Summary Section */}
        <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#f5f5f5' }}>
          <Text style={{ fontSize: 16, marginBottom: 10, color: '#1a1a1a' }}>
            Summary
          </Text>
          <Text style={{ fontSize: 12, color: '#666666', marginBottom: 5 }}>
            Total Absent Employees: {absentEmployees.length}
          </Text>
          <Text style={{ fontSize: 12, color: '#666666' }}>
            Departments Affected: {Object.keys(departmentGroups).length}
          </Text>
        </View>

        {/* Department-wise Breakdown */}
        {Object.entries(departmentGroups).map(([department, employees]) => (
          <View key={department} style={{ marginBottom: 20 }}>
            <View style={{ 
              backgroundColor: '#e6e6e6', 
              padding: 8,
              marginBottom: 10
            }}>
              <Text style={{ fontSize: 14, color: '#1a1a1a' }}>
                {department} ({employees.length} absent)
              </Text>
            </View>

            {/* Employee Table */}
            <View style={{ border: '1px solid #cccccc' }}>
              {/* Table Header */}
              <View style={{ 
                flexDirection: 'row', 
                backgroundColor: '#f5f5f5',
                borderBottom: '1px solid #cccccc',
                padding: 8
              }}>
                <Text style={{ flex: 2, fontSize: 10, color: '#666666' }}>Name</Text>
                <Text style={{ flex: 1, fontSize: 10, color: '#666666' }}>Position</Text>
                <Text style={{ flex: 1, fontSize: 10, color: '#666666' }}>Contact</Text>
              </View>

              {/* Table Body */}
              {employees.map((emp) => (
                <View key={emp.id} style={{ 
                  flexDirection: 'row',
                  borderBottom: '1px solid #cccccc',
                  padding: 8,
                  backgroundColor: '#ffffff'
                }}>
                  <Text style={{ flex: 2, fontSize: 10 }}>
                    {emp.first_name} {emp.last_name}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 10 }}>
                    {emp.position || 'N/A'}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 10 }}>
                    {emp.phone || 'N/A'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={{ 
          position: 'absolute', 
          bottom: 30, 
          left: 30, 
          right: 30,
          borderTop: '1px solid #cccccc',
          paddingTop: 10
        }}>
          <Text style={{ 
            fontSize: 8, 
            color: '#666666', 
            textAlign: 'center' 
          }}>
            Generated on {format(new Date(), 'MMMM do, yyyy HH:mm:ss')}
          </Text>
          <Text style={{ 
            fontSize: 8, 
            color: '#666666', 
            textAlign: 'center',
            marginTop: 5
          }}>
            Dutch Activity Attendance System
          </Text>
        </View>
      </Page>
    </Document>
  );
};

const AbsentEmployeeDownload: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [absentEmployees, setAbsentEmployees] = React.useState<Employee[]>([]);
  const [whatsappNumber, setWhatsappNumber] = React.useState('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const today = new Date();
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);

  const fetchAbsentEmployees = async (start: Date, end: Date) => {
    setLoading(true);
    try {
      console.log('Fetching employees...');
      // Get all employees with proper department relationship
      const { data: employees, error: employeeError } = await supabase
        .from('employees')
        .select(`
          id,
          name,
          first_name,
          last_name,
          phone,
          status,
          position,
          department:department_id (
            name
          )
        `)
        .eq('status', 'active');

      console.log('Raw employee query result:', { data: employees, error: employeeError });

      if (employeeError) {
        console.error('Error fetching employees:', employeeError);
        toast({
          title: "Error",
          description: "Failed to fetch employees: " + employeeError.message,
          variant: "destructive"
        });
        setAbsentEmployees([]);
        return;
      }

      // Map employees with proper department structure
      const activeEmployees = employees?.map(emp => ({
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          name: emp.name,
          position: emp.position,
          phone: emp.phone,
        departments: emp.department ? { name: emp.department.name } : null,
          status: emp.status
      } satisfies Employee)) || [];
      console.log('Active employees found:', activeEmployees.length);

      if (activeEmployees.length === 0) {
        toast({
          title: "No Employees Found",
          description: "There are no active employees in the system.",
          variant: "destructive"
        });
        setAbsentEmployees([]);
        return;
      }

      // Get attendance records for the date range
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      console.log('Fetching attendance for date range:', { startStr, endStr });
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .select('employee_id, date')
        .gte('date', startStr)
        .lte('date', endStr);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        throw new Error('Failed to fetch attendance records');
      }

      // Create a map of present employees for each date
      const presentEmployees = new Map<string, Set<string>>();
      attendance?.forEach(record => {
        if (!presentEmployees.has(record.date)) {
          presentEmployees.set(record.date, new Set());
        }
        presentEmployees.get(record.date)?.add(record.employee_id);
      });

      // Find absent employees
      const absentEmployeesList = activeEmployees.filter(employee => {
        let currentDate = new Date(start);
        const endDate = new Date(end);
        
        // Check each date in range
        while (currentDate <= endDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const presentForDate = presentEmployees.get(dateStr);
          
          // If employee is not in the present list for this date, they were absent
          if (!presentForDate?.has(employee.id)) {
            return true;
          }
          
          currentDate.setDate(currentDate.getDate() + 1);
        }
        return false;
      });

      console.log('Absent employees found:', absentEmployeesList.length);
      setAbsentEmployees(absentEmployeesList);

      if (absentEmployeesList.length === 0) {
        toast({
          title: "No Absent Employees",
          description: "All employees were present during the selected date range.",
        });
      }
    } catch (error) {
      console.error('Error in fetchAbsentEmployees:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch absent employees. Please try again.",
        variant: "destructive"
      });
      setAbsentEmployees([]); // Reset the state on error
    } finally {
      setLoading(false);
    }
  };

  const generateWhatsAppMessage = () => {
    if (absentEmployees.length === 0) return '';

    const dateRange = startDate.toISOString().split('T')[0] === endDate.toISOString().split('T')[0]
      ? format(startDate, 'EEEE, MMMM do, yyyy')
      : `${format(startDate, 'MMMM do, yyyy')} - ${format(endDate, 'MMMM do, yyyy')}`;
    
    // Group employees by department with null safety
    const departmentGroups = (absentEmployees || []).reduce((groups, employee) => {
      const dept = employee.departments?.name || 'Unassigned';
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(employee);
      return groups;
    }, {} as Record<string, Employee[]>);

    const message = `🏢 *ABSENT EMPLOYEES REPORT*
📅 ${dateRange}

📊 *Summary*
• Total Absent: ${absentEmployees.length}

${Object.entries(departmentGroups).map(([dept, employees]) => 
  `👥 *${dept}* (${employees.length})
${employees.map((emp, i) => `${i + 1}. ${emp.name}`).join('\n')}`
).join('\n\n')}

🤖 Generated by Attendance System`;

    return encodeURIComponent(message);
  };

  const handleWhatsAppShare = () => {
    const message = generateWhatsAppMessage();
    if (!message) return;

    // Format WhatsApp number
    let formattedNumber = whatsappNumber.trim().replace(/\D/g, '');
    formattedNumber = formattedNumber.startsWith('0') 
      ? '94' + formattedNumber.substring(1)
      : formattedNumber.startsWith('94') 
        ? formattedNumber 
        : '94' + formattedNumber;

    // Create WhatsApp URL
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedNumber}&text=${message}`;
    window.open(whatsappUrl, '_blank');
    setIsDialogOpen(false);
  };

  const handleDateChange = (type: 'start' | 'end', event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value);
    if (type === 'start') {
      setStartDate(newDate);
      if (newDate > endDate) {
        setEndDate(newDate);
      }
    } else {
      setEndDate(newDate);
      if (newDate < startDate) {
        setStartDate(newDate);
      }
    }
    fetchAbsentEmployees(type === 'start' ? newDate : startDate, type === 'end' ? newDate : endDate);
  };

  React.useEffect(() => {
    fetchAbsentEmployees(startDate, endDate);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Absent Employees Report</CardTitle>
        <CardDescription>
          Generate PDF reports of absent employees by department
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={format(startDate, 'yyyy-MM-dd')}
                onChange={(e) => handleDateChange('start', e)}
                max={format(today, 'yyyy-MM-dd')}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={format(endDate, 'yyyy-MM-dd')}
                onChange={(e) => handleDateChange('end', e)}
                min={format(startDate, 'yyyy-MM-dd')}
                max={format(today, 'yyyy-MM-dd')}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <PDFDownloadLink
              document={<AbsentEmployeePDF 
                absentEmployees={absentEmployees} 
                startDate={startDate}
                endDate={endDate}
              />}
              fileName={`absent-employees-${format(startDate, 'yyyy-MM-dd')}-to-${format(endDate, 'yyyy-MM-dd')}.pdf`}
            >
              {({ loading: pdfLoading }) => (
                <Button
                  variant="default"
                  className="flex-1"
                  disabled={loading || absentEmployees.length === 0 || pdfLoading}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {pdfLoading ? 'Generating PDF...' : 'Download PDF Report'}
                </Button>
              )}
            </PDFDownloadLink>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={loading || absentEmployees.length === 0}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share via WhatsApp
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Absent Employees Report</DialogTitle>
                  <DialogDescription>
                    Enter the WhatsApp number to share the report with.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp Number</Label>
                    <Input
                      id="whatsapp"
                      placeholder="Enter WhatsApp number (e.g., 94771234567)"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Include country code (e.g., 94 for Sri Lanka)
                    </p>
                  </div>
                  <Button 
                    onClick={handleWhatsAppShare}
                    disabled={!whatsappNumber || whatsappNumber.length < 10}
                    className="w-full"
                  >
                    Share Report
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : absentEmployees.length > 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Found {absentEmployees.length} absent employees. Click "Download PDF Report" to view the detailed report.
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No absent employees found for the selected date range
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AbsentEmployeeDownload; 