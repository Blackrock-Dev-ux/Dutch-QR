import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Download, 
  Calendar as CalendarIcon, 
  Users, 
  Clock, 
  Search,
  FileText,
  Loader2,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO, differenceInMinutes } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PresentEmployee {
  id: string;
  employee_id: string;
  employee_name: string;
  date: string;
  first_check_in: string | null;
  first_check_out: string | null;
  second_check_in: string | null;
  second_check_out: string | null;
  late_minutes: number;
  break_hours: number;
  working_duration: number; // in minutes
  department: string;
  position: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
}

interface PresentEmployeeReportProps {
  className?: string;
  onSuccess?: () => void;
}

interface AttendanceRecord {
  id: string;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  second_check_in: string | null;
  second_check_out: string | null;
  break_minutes: number;
  working_duration: number;
  status: string;
  minutes_late: number;
  employee: {
    name: string;
    department_id: string;
  };
}

export function PresentEmployeeReport({ className, onSuccess }: PresentEmployeeReportProps) {
  const [presentEmployees, setPresentEmployees] = useState<PresentEmployee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<PresentEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [departments, setDepartments] = useState<Department[]>([]);
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);

  // Function to validate department selection
  const validateDepartment = (departmentId: string): Department | null => {
    const dept = departments.find(d => d.id === departmentId);
    if (!dept) {
      console.error('Invalid department selected:', departmentId);
      console.log('Available departments:', departments);
      toast({
        title: 'Error',
        description: 'Invalid department selected',
        variant: 'destructive',
      });
      return null;
    }
    return dept;
  };

  // Function to handle department selection
  const handleDepartmentChange = (value: string) => {
    console.log('Department selected:', value);
    console.log('Available departments:', departments);
    const dept = validateDepartment(value);
    if (dept) {
      console.log('Selected department data:', dept);
      setSelectedDepartment(value);
      // Clear any existing report data when department changes
      setReportData([]);
    }
  };

  // Function to ensure department exists
  const ensureDepartmentExists = async (departmentName: string): Promise<Department | null> => {
    try {
      // First try to find the department
      const { data: existingDept, error: findError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('name', departmentName)
        .single();

      if (existingDept) {
        console.log('Found existing department:', existingDept);
        return existingDept;
      }

      // If not found, create it
      console.log('Department not found, creating:', departmentName);
      const { data: newDept, error: createError } = await supabase
        .from('departments')
        .insert({ name: departmentName })
        .select()
        .single();

      if (createError) {
        console.error('Error creating department:', createError);
        toast({
          title: 'Error',
          description: `Failed to create department "${departmentName}"`,
          variant: 'destructive',
        });
        return null;
      }

      console.log('Created new department:', newDept);
      return newDept;
    } catch (error) {
      console.error('Error in ensureDepartmentExists:', error);
      return null;
    }
  };

  // Fetch departments on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        // First ensure Dutch Activity department exists
        const dutchActivityDept = await ensureDepartmentExists('Dutch Activity');
        
        // Then fetch all departments
        const { data, error } = await supabase
          .from('departments')
          .select('id, name')
          .order('name');

        if (error) throw error;

        if (data) {
          // Log departments for debugging
          console.log('Fetched departments:', data.map(d => ({ id: d.id, name: d.name })));
          
          // Filter out any null or undefined values
          const validDepartments = data.filter(d => d && d.id && d.name);
          
          if (validDepartments.length === 0) {
            console.warn('No valid departments found');
            toast({
              title: 'Warning',
              description: 'No departments available',
              variant: 'default',
            });
            return;
          }
          
          setDepartments(validDepartments);
          
          // If Dutch Activity department exists, select it
          if (dutchActivityDept) {
            console.log('Setting Dutch Activity department as selected:', dutchActivityDept);
            setSelectedDepartment(dutchActivityDept.id);
          }
          // Otherwise, if there's only one department, select it
          else if (validDepartments.length === 1) {
            console.log('Auto-selecting only department:', validDepartments[0]);
            setSelectedDepartment(validDepartments[0].id);
          }
        } else {
          console.warn('No departments found in the database');
          toast({
            title: 'Warning',
            description: 'No departments found in the database',
            variant: 'default',
          });
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
        toast({
          title: 'Error',
          description: 'Failed to load departments',
          variant: 'destructive',
        });
      }
    };

    fetchDepartments();
  }, []);

  // Fetch present employees data
  const fetchPresentEmployees = async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Query attendance records for the selected date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          employee_id,
          date,
          first_check_in_time,
          first_check_out_time,
          second_check_in_time,
          second_check_out_time,
          status,
          working_duration_minutes,
          minutes_late,
          break_duration_minutes,
          employees:employee_id (
            name,
            first_name,
            last_name,
            department_id,
            position,
            departments:department_id (
              name
            )
          )
        `)
        .eq('date', dateStr)
        .in('status', ['PRESENT', 'CHECKED_IN', 'CHECKED_OUT', 'FIRST_SESSION_ACTIVE', 'FIRST_CHECK_OUT', 'SECOND_SESSION_ACTIVE', 'SECOND_CHECK_OUT', 'COMPLETED']);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        throw attendanceError;
      }

      // Process the data to calculate required metrics
      const processedData: PresentEmployee[] = (attendanceData || []).map((record: any) => {
        const employee = record.employees;
        const employeeName = employee ? 
          (employee.first_name && employee.last_name 
            ? `${employee.first_name} ${employee.last_name}` 
            : employee.name || 'Unknown') 
          : 'Unknown';

        // Calculate late minutes - use stored value or calculate
        const lateMinutes = record.minutes_late || 0;
        const firstCheckIn = record.first_check_in_time;

        // Calculate break hours - use stored value or calculate
        let breakMinutes = record.break_duration_minutes || 0;
        if (!breakMinutes && record.first_check_out_time && record.second_check_in_time) {
          const firstCheckOut = parseISO(record.first_check_out_time);
          const secondCheckIn = parseISO(record.second_check_in_time);
          breakMinutes = differenceInMinutes(secondCheckIn, firstCheckOut);
        }

        // Calculate working duration - use stored value or calculate
        let workingMinutes = record.working_duration_minutes || 0;
        if (!workingMinutes && firstCheckIn) {
          // Calculate manually if not stored
          const checkInTime = parseISO(firstCheckIn);
          let totalWorked = 0;

          // First session
          if (record.first_check_out_time) {
            const firstCheckOut = parseISO(record.first_check_out_time);
            totalWorked += differenceInMinutes(firstCheckOut, checkInTime);
          } else {
            // Still working
            totalWorked += differenceInMinutes(new Date(), checkInTime);
          }

          // Second session
          if (record.second_check_in_time) {
            const secondCheckIn = parseISO(record.second_check_in_time);
            if (record.second_check_out_time) {
              const secondCheckOut = parseISO(record.second_check_out_time);
              totalWorked += differenceInMinutes(secondCheckOut, secondCheckIn);
            } else {
              // Still in second session
              totalWorked += differenceInMinutes(new Date(), secondCheckIn);
            }
          }

          workingMinutes = totalWorked;
        }

        return {
          id: record.id,
          employee_id: record.employee_id,
          employee_name: employeeName,
          date: record.date,
          first_check_in: record.first_check_in_time,
          first_check_out: record.first_check_out_time,
          second_check_in: record.second_check_in_time,
          second_check_out: record.second_check_out_time,
          late_minutes: Math.max(0, lateMinutes),
          break_hours: breakMinutes / 60,
          working_duration: workingMinutes,
          department: employee?.departments?.name || 'Unassigned',
          position: employee?.position || 'Unassigned',
          status: record.status
        };
      });

      setPresentEmployees(processedData);

      toast({
        title: 'Success',
        description: `Found ${processedData.length} present employees for ${format(date, 'PP')}`,
      });

    } catch (error) {
      console.error('Error fetching present employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch present employees data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter employees based on search and department
  useEffect(() => {
    let filtered = presentEmployees;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(emp =>
        emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.position.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by department
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp.department === departmentFilter);
    }

    setFilteredEmployees(filtered);
  }, [presentEmployees, searchQuery, departmentFilter]);

  // Load data when component mounts or date changes
  useEffect(() => {
    fetchPresentEmployees(selectedDate);
  }, [selectedDate]);

  // Format time display
  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    try {
      return format(parseISO(timeString), 'HH:mm');
    } catch {
      return '-';
    }
  };

  // Format duration display
  const formatDuration = (minutes: number) => {
    if (minutes === 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const fetchAttendanceData = async () => {
    if (!startDate || !endDate || !selectedDepartment) {
      toast({
        title: 'Validation Error',
        description: 'Please select date range and department',
        variant: 'destructive',
      });
      return null;
    }

    try {
      // Log query parameters for debugging
      console.log('Fetching attendance with params:', {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        departmentId: selectedDepartment,
        availableDepartments: departments
      });

      // First get employees in the selected department
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, first_name, last_name, department_id')
        .eq('department_id', selectedDepartment)
        .eq('status', 'active');

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
        throw new Error(`Failed to fetch employees: ${employeesError.message}`);
      }

      // Double check that all employees belong to the selected department
      const validEmployees = employeesData?.filter(emp => emp.department_id === selectedDepartment) || [];

      if (!validEmployees || validEmployees.length === 0) {
        console.log('No active employees found in department:', selectedDepartment);
        console.log('Department data:', departments.find(d => d.id === selectedDepartment));
        toast({
          title: 'No Employees',
          description: 'No active employees found in the selected department',
          variant: 'default',
        });
        return [];
      }

      const employeeIds = validEmployees.map(emp => emp.id);
      console.log(`Found ${employeeIds.length} active employees in department`);

      // Fetch attendance records for these employees
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select(`
          id,
          date,
          check_in_time,
          check_out_time,
          first_check_in_time,
          first_check_out_time,
          second_check_in_time,
          second_check_out_time,
          break_duration_minutes,
          working_duration_minutes,
          working_duration,
          status,
          minutes_late,
          employees!inner (
            id,
            name,
            first_name,
            last_name,
            department_id,
            position,
            departments:department_id (
              id,
              name
            )
          )
        `)
        .in('employee_id', employeeIds)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))
        .in('status', ['present', 'checked-out', 'checked-out-overtime', 'half-day', 'late']);

      if (attendanceError) {
        console.error('Attendance fetch error:', attendanceError);
        throw new Error(`Failed to fetch attendance: ${attendanceError.message}`);
      }

      if (!attendanceData || attendanceData.length === 0) {
        toast({
          title: 'No Data',
          description: 'No attendance records found for the selected criteria',
          variant: 'default',
        });
        return [];
      }

      // Log successful data fetch with department info
      console.log('Successfully fetched attendance data:', {
        recordCount: attendanceData.length,
        dateRange: `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
        employeeCount: employeeIds.length,
        sampleRecord: attendanceData[0],
        departments: departments
      });

      return attendanceData;
    } catch (error) {
      console.error('Error in fetchAttendanceData:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch attendance data',
        variant: 'destructive',
      });
      return null;
    }
  };

  const generatePDF = async () => {
    setLoading(true);
    try {
      const attendanceData = await fetchAttendanceData();
      if (!attendanceData || attendanceData.length === 0) {
        setLoading(false);
        return;
      }

      // Get department name
      const selectedDepartmentData = departments.find(d => d.id === selectedDepartment);
      if (!selectedDepartmentData) {
        console.error('Selected department not found:', selectedDepartment);
        toast({
          title: 'Error',
          description: 'Selected department not found',
          variant: 'destructive',
        });
        return;
      }
      
      // Initialize PDF with A4 portrait for better readability
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - (2 * margin);

      // Add header with company logo/name and department
      doc.setFillColor(41, 128, 185); // Professional blue color
      doc.rect(0, 0, pageWidth, 50, 'F');
      
      // Add subtle accent line
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(margin, 47, pageWidth - margin, 47);

      // Add company name with enhanced styling
      doc.setFontSize(32);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('DUTCH TRAILS', pageWidth / 2, 20, { align: 'center' });

      // Add department name with professional styling
    doc.setFontSize(20);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedDepartmentData.name.toUpperCase(), pageWidth / 2, 32, { align: 'center' });

      // Add report title with subtle separator
      doc.setFontSize(16);
      doc.text('PRESENT EMPLOYEES REPORT', pageWidth / 2, 44, { align: 'center' });

      // Add date range and generation info with enhanced styling
      doc.setFontSize(10);
      doc.setTextColor(44, 62, 80);
      const dateRange = `Period: ${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
      const generatedAt = `Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
      doc.text(dateRange, margin, 60);
      doc.text(generatedAt, pageWidth - margin, 60, { align: 'right' });

      // Calculate statistics with null safety
      const safeAttendanceData = attendanceData || [];
      const totalEmployees = new Set(safeAttendanceData.map(record => record.employees?.id)).size;
      const totalDays = new Set(safeAttendanceData.map(record => record.date)).size;
      const onTimeCount = safeAttendanceData.filter(record => record.minutes_late === 0).length;
      const lateCount = safeAttendanceData.filter(record => record.minutes_late > 0).length;
      const totalHours = safeAttendanceData.reduce((sum, record) => sum + (record.working_duration_minutes || 0), 0) / 60;

      // Add statistics section with enhanced box styling
      doc.setDrawColor(41, 128, 185);
      doc.setFillColor(240, 244, 248);
      doc.roundedRect(margin, 65, contentWidth, 45, 3, 3, 'FD');
      
      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.setFont('helvetica', 'bold');
      doc.text('SUMMARY STATISTICS', margin + 5, 73);
      
      // Create two columns for statistics
      doc.setFontSize(10);
    doc.setTextColor(44, 62, 80);
      doc.setFont('helvetica', 'normal');
      
      // Left column
      doc.text([
        `Total Employees: ${totalEmployees}`,
        `Total Days: ${totalDays}`,
        `Total Hours: ${Math.round(totalHours * 10) / 10}h`
      ], margin + 5, 82, { lineHeightFactor: 1.5 });

      // Right column
      doc.text([
        `On Time: ${onTimeCount} (${Math.round((onTimeCount/attendanceData.length)*100)}%)`,
        `Late: ${lateCount} (${Math.round((lateCount/attendanceData.length)*100)}%)`
      ], pageWidth / 2, 82, { lineHeightFactor: 1.5 });

      // Prepare table data with enhanced formatting
      const tableData = attendanceData.map(record => {
        const workingDuration = record.working_duration_minutes || 0;
        const hours = Math.floor(workingDuration / 60);
        const minutes = workingDuration % 60;
        
        return [
          format(new Date(record.date), 'dd/MM/yyyy'),
          record.employees?.first_name && record.employees?.last_name 
            ? `${record.employees.first_name} ${record.employees.last_name}`
            : record.employees?.name || 'Unknown',
          record.employees?.position || '-',
          record.first_check_in_time 
            ? format(new Date(record.first_check_in_time), 'HH:mm') 
            : '-',
          record.first_check_out_time 
            ? format(new Date(record.first_check_out_time), 'HH:mm') 
            : '-',
          record.second_check_in_time 
            ? format(new Date(record.second_check_in_time), 'HH:mm') 
            : '-',
          record.second_check_out_time 
            ? format(new Date(record.second_check_out_time), 'HH:mm') 
            : '-',
          record.break_duration_minutes 
            ? `${record.break_duration_minutes}m` 
            : '-',
          `${hours}h ${minutes}m`,
          record.minutes_late > 0 ? `${record.minutes_late}m` : '-',
          record.status.toUpperCase()
        ];
      });

      // Add table with enhanced styling for A4 portrait
      (doc as any).autoTable({
        head: [['Date', 'Employee Name', 'Position', 'First In', 'First Out', 'Second In', 'Second Out', 'Break', 'Hours', 'Late', 'Status']],
      body: tableData,
        startY: 115,
      styles: {
          fontSize: 9,
        cellPadding: 2,
          lineColor: [189, 195, 199],
          lineWidth: 0.1,
          font: 'helvetica',
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
          fontSize: 10,
        fontStyle: 'bold',
          halign: 'center',
      },
      columnStyles: {
          0: { cellWidth: 20 }, // Date
          1: { cellWidth: 35 }, // Name
          2: { cellWidth: 25 }, // Position
          3: { cellWidth: 15 }, // First In
          4: { cellWidth: 15 }, // First Out
          5: { cellWidth: 15 }, // Second In
          6: { cellWidth: 15 }, // Second Out
          7: { cellWidth: 15 }, // Break
          8: { cellWidth: 15 }, // Hours
          9: { cellWidth: 15 }, // Late
          10: { cellWidth: 20 }, // Status
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249],
        },
        margin: { top: 115, left: margin, right: margin },
        didDrawPage: function (data: any) {
          // Add header on each page
          doc.setFillColor(41, 128, 185);
          doc.rect(0, 0, pageWidth, 50, 'F');
          
          // Add subtle accent line
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.5);
          doc.line(margin, 47, pageWidth - margin, 47);

          // Add company name with enhanced styling
          doc.setFontSize(32);
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.text('DUTCH TRAILS', pageWidth / 2, 20, { align: 'center' });

          // Add department name with professional styling
          doc.setFontSize(20);
          doc.setFont('helvetica', 'normal');
          doc.text(selectedDepartmentData.name.toUpperCase(), pageWidth / 2, 32, { align: 'center' });

          // Add report title
          doc.setFontSize(16);
          doc.text('PRESENT EMPLOYEES REPORT', pageWidth / 2, 44, { align: 'center' });

          // Add footer with page number and timestamp
          doc.setFontSize(8);
          doc.setTextColor(128, 128, 128);
          doc.text(
            `Page ${data.pageNumber} of ${data.pageCount}`,
            pageWidth - margin,
            pageHeight - margin,
            { align: 'right' }
          );
          
          // Add footer line
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.1);
          doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      },
    });

      // Add footer text
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        'This report is system generated and does not require signature.',
        pageWidth / 2,
        pageHeight - margin,
        { align: 'center' }
      );

      // Save the PDF with a descriptive filename
      const filename = `present_employees_report_${selectedDepartmentData.name.replace(/\s+/g, '_')}_${format(startDate, 'yyyyMMdd')}-${format(endDate, 'yyyyMMdd')}.pdf`;
      doc.save(filename);
    
    toast({
      title: 'Success',
      description: 'PDF report generated successfully',
    });

      setIsDialogOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error generating PDF report:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate PDF report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const data = await fetchAttendanceData();
    if (data) {
      setReportData(data);
    }
  };

  const renderPreviewTable = (data: any[]) => {
    // Get the selected department name
    const selectedDepartmentData = departments.find(d => d.id === selectedDepartment);
    
    return (
      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-medium">Preview ({data.length} records)</h3>
        
        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-3">
          {data.slice(0, 5).map((record) => (
            <Card key={record.id} className="p-3">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-sm">
                      {record.employees?.first_name && record.employees?.last_name 
                        ? `${record.employees.first_name} ${record.employees.last_name}`
                        : record.employees?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(record.date), 'dd/MM/yyyy')}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {record.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">In:</span> {record.first_check_in_time ? format(new Date(record.first_check_in_time), 'HH:mm') : '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Out:</span> {record.first_check_out_time ? format(new Date(record.first_check_out_time), 'HH:mm') : '-'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span> {record.working_duration_minutes ? `${Math.floor(record.working_duration_minutes / 60)}h ${record.working_duration_minutes % 60}m` : '0h 0m'}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Late:</span> {record.minutes_late > 0 ? `${record.minutes_late}m` : '-'}
                  </div>
                </div>
              </div>
            </Card>
          ))}
          {data.length > 5 && (
            <div className="text-center text-xs text-muted-foreground">
              Showing 5 of {data.length} records. Download PDF for complete list.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block">
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-2 text-left text-xs font-medium">Date</th>
                  <th className="p-2 text-left text-xs font-medium">Employee</th>
                  <th className="p-2 text-left text-xs font-medium">Department</th>
                  <th className="p-2 text-left text-xs font-medium">First In</th>
                  <th className="p-2 text-left text-xs font-medium">First Out</th>
                  <th className="p-2 text-left text-xs font-medium">Second In</th>
                  <th className="p-2 text-left text-xs font-medium">Second Out</th>
                  <th className="p-2 text-left text-xs font-medium">Break</th>
                  <th className="p-2 text-left text-xs font-medium">Duration</th>
                  <th className="p-2 text-left text-xs font-medium">Late</th>
                  <th className="p-2 text-left text-xs font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 10).map((record) => (
                  <tr key={record.id} className="border-b hover:bg-muted/50">
                    <td className="p-2 text-xs">
                      {format(new Date(record.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="p-2 text-xs">
                      {record.employees?.first_name && record.employees?.last_name 
                        ? `${record.employees.first_name} ${record.employees.last_name}`
                        : record.employees?.name || 'Unknown'}
                    </td>
                    <td className="p-2 text-xs">
                      {selectedDepartmentData?.name || 'Unknown'}
                    </td>
                    <td className="p-2 text-xs">
                      {record.first_check_in_time 
                        ? format(new Date(record.first_check_in_time), 'HH:mm') 
                        : '-'}
                    </td>
                    <td className="p-2 text-xs">
                      {record.first_check_out_time 
                        ? format(new Date(record.first_check_out_time), 'HH:mm') 
                        : '-'}
                    </td>
                    <td className="p-2 text-xs">
                      {record.second_check_in_time 
                        ? format(new Date(record.second_check_in_time), 'HH:mm') 
                        : '-'}
                    </td>
                    <td className="p-2 text-xs">
                      {record.second_check_out_time 
                        ? format(new Date(record.second_check_out_time), 'HH:mm') 
                        : '-'}
                    </td>
                    <td className="p-2 text-xs">
                      {record.break_duration_minutes 
                        ? `${record.break_duration_minutes}m` 
                        : '-'}
                    </td>
                    <td className="p-2 text-xs">
                      {record.working_duration_minutes 
                        ? `${Math.floor(record.working_duration_minutes / 60)}h ${record.working_duration_minutes % 60}m`
                        : '0h 0m'}
                    </td>
                    <td className="p-2 text-xs">
                      {record.minutes_late > 0 ? `${record.minutes_late}m` : '-'}
                    </td>
                    <td className="p-2 text-xs">
                      <Badge variant="outline" className="text-xs">
                        {record.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.length > 10 && (
            <div className="text-center text-xs text-muted-foreground mt-2">
              Showing 10 of {data.length} records. Download PDF for complete list.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        className="flex items-center gap-2 w-full sm:w-auto"
        variant="outline"
        size="sm"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Present Report</span>
        <span className="sm:hidden">Present</span>
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Generate Present Employee Report</DialogTitle>
          </DialogHeader>

          <div className={cn("space-y-4", className)}>
            <div className="flex flex-col gap-4">
              <div className="space-y-3">
                <label className="text-sm font-medium">Select Date Range</label>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      className="rounded-md border w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">End Date</label>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      className="rounded-md border w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Select 
                  value={selectedDepartment} 
                  onValueChange={handleDepartmentChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select department">
                      {departments.find(d => d.id === selectedDepartment)?.name || 'Select department'}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  disabled={loading || !startDate || !endDate || !selectedDepartment}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="sm:hidden">Refresh</span>
                </Button>
                <div className="text-sm text-muted-foreground">
                  {reportData.length > 0 && `${reportData.length} records found`}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Button
                  onClick={generatePDF}
                  disabled={loading || !startDate || !endDate || !selectedDepartment}
                  className="flex items-center gap-2 w-full sm:w-auto"
                  size="sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download PDF
                    </>
                  )}
            </Button>
          </div>
            </div>

            {reportData.length > 0 && renderPreviewTable(reportData)}
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
