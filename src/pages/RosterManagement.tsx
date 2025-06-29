import { useState, useEffect } from 'react';
import { format, isAfter, isBefore, isToday, differenceInDays, differenceInHours, differenceInMinutes, isPast } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { RosterService } from '@/services/RosterService';
import { RosterReportService } from '@/services/RosterReportService';
import { Roster, ShiftType } from '@/integrations/supabase/types';
import { useEmployees } from '@/hooks/useEmployees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Calendar as CalendarIcon,
  Users,
  Clock,
  Filter,
  Download,
  Share2,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { supabase } from '../integrations/supabase/client';
import Swal from 'sweetalert2';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const SHIFT_TYPES: ShiftType[] = ['morning', 'evening', 'night', 'off'];

// Department Management Tab Component
interface DepartmentManagementTabProps {
  employees: Array<{
    id: string;
    name: string;
    department_id: string;
    position: string;
  }>;
  onAssignRoster: (employee: any) => void;
}

const DepartmentManagementTab: React.FC<DepartmentManagementTabProps> = ({ employees, onAssignRoster }) => {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  
  // Group employees by department with null safety
  const employeesByDepartment = (employees || []).reduce((acc, employee) => {
    const dept = employee.department_id || 'Unassigned';
    if (!acc[dept]) {
      acc[dept] = [];
    }
    acc[dept].push(employee);
    return acc;
  }, {} as Record<string, typeof employees>);

  const departments = Object.keys(employeesByDepartment);
  const filteredEmployees = selectedDepartment === 'all' 
    ? employees 
    : employeesByDepartment[selectedDepartment] || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Department Management</h2>
          <p className="text-gray-500">Click on employees to assign rosters by department</p>
        </div>
        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Department Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="rounded-full p-3 bg-blue-100">
              <Users className="h-6 w-6 text-blue-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Departments</p>
              <p className="text-2xl font-bold">{departments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="rounded-full p-3 bg-green-100">
              <Users className="h-6 w-6 text-green-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Employees</p>
              <p className="text-2xl font-bold">{employees.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="rounded-full p-3 bg-purple-100">
              <Users className="h-6 w-6 text-purple-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Selected Department</p>
              <p className="text-2xl font-bold">
                {selectedDepartment === 'all' ? employees.length : filteredEmployees.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-4">
            <div className="rounded-full p-3 bg-orange-100">
              <Users className="h-6 w-6 text-orange-700" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Available for Assignment</p>
              <p className="text-2xl font-bold">{filteredEmployees.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Grid View */}
      {selectedDepartment === 'all' ? (
        <div className="space-y-8">
          {departments.map((department) => (
            <Card key={department} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary rounded-full"></div>
                  {department}
                </h3>
                <Badge variant="secondary">
                  {employeesByDepartment[department].length} employees
                </Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {employeesByDepartment[department].map((employee) => (
                  <Card 
                    key={employee.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow duration-200 hover:border-primary"
                    onClick={() => onAssignRoster(employee)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center space-y-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{employee.name}</h4>
                          <p className="text-xs text-gray-500">{employee.position}</p>
                        </div>
                        <Button size="sm" variant="outline" className="w-full">
                          Assign Roster
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <div className="w-4 h-4 bg-primary rounded-full"></div>
              {selectedDepartment}
            </h3>
            <Badge variant="secondary">
              {filteredEmployees.length} employees
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredEmployees.map((employee) => (
              <Card 
                key={employee.id} 
                className="cursor-pointer hover:shadow-md transition-shadow duration-200 hover:border-primary"
                onClick={() => onAssignRoster(employee)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {employee.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{employee.name}</h4>
                      <p className="text-xs text-gray-500">{employee.position}</p>
                    </div>
                    <Button size="sm" variant="outline" className="w-full">
                      Assign Roster
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// Detailed Roster View Component
interface DetailedRosterViewProps {
  rosters: Roster[];
  employees: Array<{
    id: string;
    name: string;
    department_id: string;
    position: string;
  }>;
}

const DetailedRosterView: React.FC<DetailedRosterViewProps> = ({ rosters, employees }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Get unique departments from employees
  const departments = [...new Set(employees.map(emp => emp.department_id).filter(Boolean))];

  const filteredRosters = rosters.filter(roster => {
    const employee = employees.find(emp => emp.id === roster.employee_id);
    const matchesSearch = employee?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === 'all' || employee?.department_id === filterDepartment;
    const rosterStatus = getRosterStatus(roster.start_date, roster.end_date).label.toLowerCase();
    const matchesStatus = filterStatus === 'all' || rosterStatus === filterStatus;
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const exportToCSV = () => {
    const csvContent = [
      ['Employee Name', 'Department', 'Position', 'Start Date', 'End Date', 'Shift Type', 'Time Slot', 'Status', 'Assignment Date'],
      ...filteredRosters.map(roster => {
        const employee = employees.find(emp => emp.id === roster.employee_id);
        const shift = roster.shift_pattern?.[0];
        return [
          employee?.name || 'Unknown',
          employee?.department_id || 'Unknown',
          employee?.position || 'Unknown',
          format(new Date(roster.start_date), 'PP'),
          format(new Date(roster.end_date), 'PP'),
          shift?.shift || 'N/A',
          shift?.time_slot || 'N/A',
          getRosterStatus(roster.start_date, roster.end_date).label,
          roster.assignment_time ? format(new Date(roster.assignment_time), 'PPpp') : 'N/A'
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detailed-roster-view-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const tableData = filteredRosters.map(roster => {
      const employee = employees.find(emp => emp.id === roster.employee_id);
      const shift = roster.shift_pattern?.[0];
      return [
        employee?.name || 'Unknown',
        employee?.department_id || 'Unknown',
        employee?.position || 'Unknown',
        format(new Date(roster.start_date), 'PP'),
        format(new Date(roster.end_date), 'PP'),
        shift?.shift || 'N/A',
        shift?.time_slot || 'N/A',
        getRosterStatus(roster.start_date, roster.end_date).label,
        roster.assignment_time ? format(new Date(roster.assignment_time), 'MM/dd/yyyy') : 'N/A'
      ];
    });

    doc.text('Detailed Roster Report', 14, 15);
    (doc as any).autoTable({
      head: [['Employee', 'Department', 'Position', 'Start Date', 'End Date', 'Shift', 'Time Slot', 'Status', 'Assignment Date']],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`detailed-roster-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <div className="flex-1 w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
              placeholder="Search by employee or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
        <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

          <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment</th>
                </tr>
              </thead>
          <tbody className="bg-white divide-y divide-gray-200">
                {filteredRosters.map((roster) => {
                  const employee = employees.find(emp => emp.id === roster.employee_id);
                  const shift = roster.shift_pattern?.[0];
                  const status = getRosterStatus(roster.start_date, roster.end_date);
                  
                  return (
                <tr key={roster.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{employee?.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{roster.employee_id}</div>
                          </div>
                        </div>
                      </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee?.department_id || 'Unknown'}</div>
                      </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{employee?.position || 'Unknown'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(roster.start_date), 'PP')} - {format(new Date(roster.end_date), 'PP')}
                        </div>
                      </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={shift?.shift === 'off' ? 'secondary' : 'default'}>
                            {shift?.shift ? shift.shift.charAt(0).toUpperCase() + shift.shift.slice(1) : 'N/A'}
                          </Badge>
                      </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={status.label === 'Active' ? 'default' : 'secondary'}>
                          {status.label}
                        </Badge>
                      </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {roster.assignment_time ? format(new Date(roster.assignment_time), 'PP p') : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
              </div>
    </div>
  );
};

interface FormValues {
  employee: string;
  startDate: Date;
  endDate: Date;
  rosterType: 'working' | 'off';
  shift?: 'morning' | 'evening' | 'night' | 'off';
  startTime?: string;
  endTime?: string;
  customStartTime?: string;
  customEndTime?: string;
}

interface CountdownInfo {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

const calculateCountdown = (endDate: string): CountdownInfo => {
  const end = new Date(endDate);
  const now = new Date();

  if (isPast(end)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const totalSeconds = Math.floor((end.getTime() - now.getTime()) / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isExpired: false };
};

const getShiftColor = (shift: string) => {
  const colors = {
    morning: 'bg-blue-100 text-blue-800',
    evening: 'bg-purple-100 text-purple-800',
    night: 'bg-indigo-100 text-indigo-800',
    off: 'bg-gray-100 text-gray-800',
  };
  return colors[shift as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

const getRosterStatus = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isBefore(end, now)) return { label: 'Completed', color: 'bg-gray-100 text-gray-800' };
  if (isAfter(start, now)) return { label: 'Upcoming', color: 'bg-yellow-100 text-yellow-800' };
  if (isToday(start) || isToday(end) || (isBefore(start, now) && isAfter(end, now))) {
    return { label: 'Active', color: 'bg-green-100 text-green-800' };
  }
  return { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
};

const getRosterTypeColor = (rosterType: string) => {
  switch (rosterType.toLowerCase()) {
    case 'working':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'off':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

const formSchema = z.object({
  employee: z.string().min(1, { message: "Employee is required" }),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  rosterType: z.enum(['working', 'off']),
  shift: z.enum(['morning', 'evening', 'night', 'off']).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  customStartTime: z.string().optional(),
  customEndTime: z.string().optional(),
}).refine((data) => {
  // Validate that end date is after start date
  return data.endDate >= data.startDate;
}, {
  message: "End date must be after start date",
  path: ["endDate"],
}).refine((data) => {
  // Validate custom time fields if they are being used
  if (data.rosterType === 'working' && data.customStartTime) {
    return data.customEndTime ? true : false;
  }
  return true;
}, {
  message: "Both custom start and end times must be provided",
  path: ["customEndTime"],
});

const generatePDFReport = async (roster: any, employee: any) => {
  const doc = new jsPDF();
  
  // Add company logo or header
  doc.setFontSize(20);
  doc.setTextColor(44, 62, 80);
  doc.text('Dutch Trails Roster Report', 105, 15, { align: 'center' });
  
  // Add basic information section
  doc.setFontSize(12);
  doc.setTextColor(52, 73, 94);
  
  const basicInfo = [
    ['Employee Name:', employee?.name || roster.employee_id],
    ['Department:', employee?.department_id || 'N/A'],
    ['Position:', employee?.position || 'N/A'],
    ['Roster Period:', `${format(new Date(roster.start_date), 'PP')} - ${format(new Date(roster.end_date), 'PP')}`],
    ['Duration:', `${differenceInDays(new Date(roster.end_date), new Date(roster.start_date))} days`],
    ['Roster Type:', roster.shift_pattern?.[0]?.shift === 'off' ? 'Off Roster' : 'Working Roster'],
  ];

  doc.autoTable({
    startY: 25,
    head: [],
    body: basicInfo,
    theme: 'plain',
    styles: {
      cellPadding: 2,
      fontSize: 10,
      textColor: [52, 73, 94],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 100 },
    },
  });

  // Add shift pattern details
  const shiftPatternHead = [['Day', 'Date', 'Shift Type', 'Time Slot', 'Status']];
  const shiftPatternBody = roster.shift_pattern?.map((pattern: any, index: number) => {
    const date = new Date(roster.start_date);
    date.setDate(date.getDate() + index);
    
    return [
      format(date, 'EEEE'),
      format(date, 'PP'),
      pattern.shift.charAt(0).toUpperCase() + pattern.shift.slice(1),
      pattern.time_slot ? `${pattern.time_slot.start_time} - ${pattern.time_slot.end_time}` : 'N/A',
      getRosterStatus(roster.start_date, roster.end_date).label,
    ];
  }) || [];

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 10,
    head: shiftPatternHead,
    body: shiftPatternBody,
    theme: 'striped',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
  });

  // Add attendance records if available
  if (roster.attendance_records?.length > 0) {
    const attendanceHead = [['Date', 'Check In', 'Check Out', 'Total Hours', 'Status']];
    const attendanceBody = roster.attendance_records.map((record: any) => {
      const checkIn = new Date(record.check_in);
      const checkOut = record.check_out ? new Date(record.check_out) : null;
      const totalHours = checkOut 
        ? ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
        : 'N/A';

      return [
        format(checkIn, 'PP'),
        format(checkIn, 'p'),
        checkOut ? format(checkOut, 'p') : 'Not checked out',
        totalHours,
        record.status || 'Present',
      ];
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: attendanceHead,
      body: attendanceBody,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
    });
  }

  // Add summary section
  const totalDays = differenceInDays(new Date(roster.end_date), new Date(roster.start_date));
  const workingDays = roster.shift_pattern?.filter((p: any) => p.shift !== 'off').length || 0;
  const offDays = totalDays - workingDays;
  
  const summaryInfo = [
    ['Total Days:', `${totalDays}`],
    ['Working Days:', `${workingDays}`],
    ['Off Days:', `${offDays}`],
    ['Generated On:', format(new Date(), 'PPpp')],
  ];

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 10,
    head: [],
    body: summaryInfo,
    theme: 'plain',
    styles: {
      cellPadding: 2,
      fontSize: 10,
      textColor: [52, 73, 94],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 100 },
    },
  });

  // Add footer
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount} - Generated by Dutch Trails Roster Management System`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  return doc;
};

export default function RosterManagement() {
  const [formValues, setFormValues] = useState<FormValues>({
    employee: '',
    startDate: new Date(),
    endDate: new Date(),
    rosterType: 'working',
    shift: 'morning'
  });
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { toast } = useToast();
  const { employees, loading: employeesLoading } = useEmployees();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState<Date>();
  const [selectedEndDate, setSelectedEndDate] = useState<Date>();
  const [selectedShift, setSelectedShift] = useState<ShiftType>('morning');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [isCustomTime, setIsCustomTime] = useState(false);

  // Add state for countdown refresh
  const [countdownTick, setCountdownTick] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employee: '',
      startDate: new Date(),
      endDate: new Date(),
      rosterType: 'working',
      shift: 'morning',
      startTime: '',
      endTime: '',
      customStartTime: '',
      customEndTime: ''
    }
  });

  useEffect(() => {
    loadRosters();
  }, []);

  // Auto-fill department and position when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      const employee = employees.find(emp => emp.id === selectedEmployee);
      if (employee) {
        setSelectedDepartment(employee.department_id);
        setSelectedPosition(employee.position);
      }
    }
  }, [selectedEmployee, employees]);

  // Update the countdown timer to tick every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownTick(prev => prev + 1);
    }, 1000); // Update every second instead of every minute

    return () => clearInterval(timer);
  }, []);

  const loadRosters = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error state
      const data = await RosterService.getRosters();
      if (!data) {
        throw new Error('No roster data received');
      }
      setRosters(data);
    } catch (error) {
      console.error('Error loading rosters:', error);
      setError(error instanceof Error ? error.message : 'Failed to load rosters');
      setRosters([]); // Set empty array on error to prevent undefined state
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load rosters',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormValues) => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate dates
      if (data.endDate < data.startDate) {
        throw new Error('End date must be after start date');
      }

      // Determine time slot based on roster type and custom time settings
      let timeSlot = null;
      if (data.rosterType === 'working') {
        if (isCustomTime && data.customStartTime && data.customEndTime) {
          timeSlot = {
            start_time: data.customStartTime,
            end_time: data.customEndTime
          };
        } else if (data.shift && data.shift !== 'off') {
          // Default time slots for each shift type
          const defaultTimeSlots = {
            morning: { start_time: '09:00', end_time: '17:00' },
            evening: { start_time: '17:00', end_time: '01:00' },
            night: { start_time: '23:00', end_time: '07:00' }
          };
          timeSlot = defaultTimeSlots[data.shift];
        }
      }

      // Create the roster object
      const newRoster: Omit<Roster, 'id' | 'created_at' | 'updated_at'> = {
        employee_id: data.employee,
        department_id: selectedDepartment || null,
        position: selectedPosition || 'Unassigned',
        start_date: format(data.startDate, 'yyyy-MM-dd'),
        end_date: format(data.endDate, 'yyyy-MM-dd'),
        shift_pattern: [{
          date: format(data.startDate, 'yyyy-MM-dd'),
          shift: data.rosterType === 'off' ? 'off' : (data.shift || 'morning'),
          time_slot: timeSlot
        }],
        status: 'active',
        notes: `${data.rosterType.toUpperCase()} Roster - Created on ${format(new Date(), 'PPP')}`,
      };

      console.log('Creating roster with data:', newRoster);

      const result = await RosterService.createRoster(newRoster);
      
      if (!result) {
        throw new Error('Failed to create roster - no response from server');
      }
      
      console.log('Roster creation successful:', result);

      // Update local state and close dialog
      setRosters(prevRosters => [...prevRosters, result]);
      setIsCreateDialogOpen(false);
      
      // Reset form and state
      resetForm();
      
      // Show success message
      await Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Roster has been created successfully',
        showConfirmButton: false,
        timer: 1500
      });

      // Refresh roster list
      await loadRosters();

    } catch (err) {
      console.error('Error creating roster:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      
      await Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: err instanceof Error ? err.message : 'An error occurred while creating the roster',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoster = async (id: string) => {
    try {
      await RosterService.deleteRoster(id);
      loadRosters();
        toast({
        title: 'Success',
        description: 'Roster deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete roster',
        variant: 'destructive',
      });
    }
  };

  const handleCustomTimeChange = (checked: boolean) => {
    setIsCustomTime(checked);
    if (!checked) {
      form.setValue("customStartTime", '');
      form.setValue("customEndTime", '');
    }
  };

  const resetForm = () => {
    setSelectedEmployee('');
    setSelectedDepartment('');
    setSelectedPosition('');
    setSelectedStartDate(undefined);
    setSelectedEndDate(undefined);
    setSelectedShift('morning');
    setIsCustomTime(false);
    form.reset({
      employee: '',
      startDate: new Date(),
      endDate: new Date(),
      rosterType: 'working',
      shift: 'morning',
      startTime: '',
      endTime: '',
      customStartTime: '',
      customEndTime: ''
    });
  };

  const filteredRosters = rosters.filter(roster => {
    // Get the first shift from the shift pattern
    const currentShift = roster.shift_pattern?.[0]?.shift || 'off';
    
    // Handle search filtering
    const matchesSearch = 
      (employees.find(emp => emp.id === roster.employee_id)?.name || '')
        .toLowerCase().includes(searchTerm.toLowerCase()) ||
      currentShift.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Handle shift filtering
    const matchesShift = filterShift === 'all' || currentShift === filterShift;

    // Handle date filtering
    if (!selectedStartDate) return matchesSearch && matchesShift;

    const rosterStart = new Date(roster.start_date);
    const rosterEnd = new Date(roster.end_date);
    const filterStartDate = new Date(selectedStartDate);
    
    const matchesDate = rosterEnd >= filterStartDate && 
      rosterStart <= filterStartDate;

    return matchesSearch && matchesShift && matchesDate;
  });

  const stats = {
    total: rosters.length,
    active: rosters.filter(r => getRosterStatus(r.start_date, r.end_date).label === 'Active').length,
    upcoming: rosters.filter(r => getRosterStatus(r.start_date, r.end_date).label === 'Upcoming').length,
    completed: rosters.filter(r => getRosterStatus(r.start_date, r.end_date).label === 'Completed').length,
  };

  const renderShiftCell = (shift: ShiftType) => {
    return (
      <div className="p-2 border">
        {shift}
      </div>
    );
  };

  const handleDownloadReport = async (rosterId: string) => {
    try {
      setGeneratingPdf(true);
      const roster = filteredRosters.find(r => r.id === rosterId);
      if (!roster) throw new Error('Roster not found');

      const employee = employees.find(emp => emp.id === roster.employee_id);
      const doc = await generatePDFReport(roster, employee);
      
      // Generate filename
      const fileName = `roster_${employee?.name || roster.employee_id}_${format(new Date(roster.start_date), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF report',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleShareViaWhatsApp = (rosterId: string, employeeName: string) => {
    const shareLink = RosterReportService.getWhatsAppShareLink(rosterId, employeeName);
    window.open(shareLink, '_blank');
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Roster Management</h1>
            <p className="text-gray-500 mt-1">Manage employee schedules and shifts</p>
          </div>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="whitespace-nowrap"
            size="lg"
          >
            Create New Roster
          </Button>
            </div>
            
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center p-4">
              <div className="rounded-full p-3 bg-blue-100">
                <Users className="h-6 w-6 text-blue-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Rosters</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-4">
              <div className="rounded-full p-3 bg-green-100">
                <Clock className="h-6 w-6 text-green-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-4">
              <div className="rounded-full p-3 bg-yellow-100">
                <CalendarIcon className="h-6 w-6 text-yellow-700" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Upcoming</p>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center p-4">
              <div className="rounded-full p-3 bg-gray-100">
                <Filter className="h-6 w-6 text-gray-700" />
            </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>
        </div>

        <Tabs defaultValue="roster-list" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="roster-list">Roster List</TabsTrigger>
            <TabsTrigger value="department-management">Department Management</TabsTrigger>
            <TabsTrigger value="detailed-view">Detailed Roster View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="roster-list" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Roster List</CardTitle>
              </CardHeader>
              <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by employee or shift..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterShift} onValueChange={setFilterShift}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  {SHIFT_TYPES.map((shift) => (
                    <SelectItem key={shift} value={shift}>
                      {shift.charAt(0).toUpperCase() + shift.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex justify-center items-center min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error Loading Rosters</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                      <button
                        onClick={() => loadRosters()}
                        className="mt-2 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : rosters.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="mt-2 text-sm font-medium text-gray-900">No rosters found</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new roster.</p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Create New Roster
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRosters.map((roster) => {
                  const status = getRosterStatus(roster.start_date, roster.end_date);
                  const currentShift = roster.shift_pattern?.[0]?.shift || 'off';
                  const timeSlot = roster.shift_pattern?.[0]?.time_slot;
                  const employee = employees.find(emp => emp.id === roster.employee_id);
                  const countdown = calculateCountdown(roster.end_date);
                  const rosterType = currentShift === 'off' ? 'Off' : 'Working';
                  
                  return (
                    <Card key={roster.id} className="overflow-hidden">
                      {/* Card Header with Roster Type */}
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <h3 className="font-semibold text-lg">
                                {employee?.name || roster.employee_id}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {format(new Date(roster.start_date), 'PP')} - {format(new Date(roster.end_date), 'PP')}
                              </p>
                          </div>
                          <div className={cn(
                            "px-4 py-1 rounded-full text-sm font-semibold",
                            getRosterTypeColor(rosterType)
                          )}>
                            {rosterType} Roster
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-2 px-4 pb-4">
                        <div className="flex flex-col gap-3">
                          {/* Real-time Countdown Timer */}
                          {!countdown.isExpired && status.label !== 'Completed' && (
                            <div className="bg-gray-50 p-3 rounded-lg border">
                              <p className="text-sm font-medium text-gray-500 mb-2">Time Remaining:</p>
                              <div className="grid grid-cols-4 gap-2 text-center">
                                <div className="bg-white p-2 rounded shadow-sm">
                                  <p className="text-lg font-bold text-primary">{countdown.days}</p>
                                  <p className="text-xs text-gray-500">Days</p>
                                </div>
                                <div className="bg-white p-2 rounded shadow-sm">
                                  <p className="text-lg font-bold text-primary">{countdown.hours}</p>
                                  <p className="text-xs text-gray-500">Hours</p>
                                </div>
                                <div className="bg-white p-2 rounded shadow-sm">
                                  <p className="text-lg font-bold text-primary">{countdown.minutes}</p>
                                  <p className="text-xs text-gray-500">Minutes</p>
                                </div>
                                <div className="bg-white p-2 rounded shadow-sm">
                                  <p className="text-lg font-bold text-primary">{countdown.seconds}</p>
                                  <p className="text-xs text-gray-500">Seconds</p>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="mt-3">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all duration-500"
                                    style={{
                                      width: `${Math.max(
                                        0,
                                        Math.min(
                                          100,
                                          ((new Date().getTime() - new Date(roster.start_date).getTime()) /
                                            (new Date(roster.end_date).getTime() - new Date(roster.start_date).getTime())) *
                                            100
                                        )
                                      )}%`
                                    }}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 text-right">
                                  {Math.round(((new Date().getTime() - new Date(roster.start_date).getTime()) /
                                    (new Date(roster.end_date).getTime() - new Date(roster.start_date).getTime())) *
                                    100)}% Complete
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Shift and Time Details */}
                          <div className="flex justify-between items-start">
                            <div>
                              {timeSlot && (
                                <p className="text-sm text-gray-600">
                                  Working Hours: {timeSlot.start_time} - {timeSlot.end_time}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <Badge className={getShiftColor(currentShift)}>
                                {currentShift.charAt(0).toUpperCase() + currentShift.slice(1)} Shift
                              </Badge>
                              <Badge className={status.color}>
                                {status.label}
                              </Badge>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-end gap-2 mt-2">
                            {status.label === 'Completed' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadReport(roster.id)}
                                  disabled={generatingPdf}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  PDF
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleShareViaWhatsApp(roster.id, employee?.name || roster.employee_id)}
                                >
                                  <Share2 className="h-4 w-4 mr-1" />
                                  Share
                                </Button>
                              </>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteRoster(roster.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="department-management" className="space-y-4">
            <DepartmentManagementTab 
              employees={employees} 
              onAssignRoster={(employee) => {
                setSelectedEmployee(employee.id);
                setSelectedDepartment(employee.department_id);
                setSelectedPosition(employee.position);
                setIsCreateDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="detailed-view" className="space-y-4">
            <DetailedRosterView rosters={rosters} employees={employees} />
          </TabsContent>
        </Tabs>
      </div>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Create New Roster</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Accordion type="single" collapsible defaultValue="employee">
                <AccordionItem value="employee">
                  <AccordionTrigger className="text-lg font-semibold">
                    Employee Details
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 pb-2">
                    <div className="grid gap-4">
                      <FormField
                        control={form.control}
                        name="employee"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Employee</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(value) => {
                                field.onChange(value);
                                setSelectedEmployee(value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {employees.map((employee) => (
                                  <SelectItem key={employee.id} value={employee.id}>
                                    {employee.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Input value={selectedDepartment} readOnly disabled />
                        </FormItem>
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <Input value={selectedPosition} readOnly disabled />
                        </FormItem>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="roster">
                  <AccordionTrigger className="text-lg font-semibold">
                    Roster Details
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 pb-2">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Start Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                    onSelect={field.onChange}
                                  disabled={(date) =>
                                      date < new Date()
                                  }
                                    initialFocus
                                />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>End Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                    onSelect={field.onChange}
                                  disabled={(date) =>
                                      date < form.getValues("startDate")
                                  }
                                    initialFocus
                                />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="rosterType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Roster Type</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select roster type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="working">Working Roster</SelectItem>
                                <SelectItem value="off">Off Roster</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {form.watch("rosterType") === "working" && (
                        <>
                      <FormField
                        control={form.control}
                        name="shift"
                        render={({ field }) => (
                          <FormItem>
                                <FormLabel>Shift</FormLabel>
                            <Select
                              value={field.value}
                                  onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                      <SelectValue placeholder="Select shift" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                    <SelectItem value="morning">Morning Shift</SelectItem>
                                    <SelectItem value="evening">Evening Shift</SelectItem>
                                    <SelectItem value="night">Night Shift</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <FormLabel className="text-base">Custom Time</FormLabel>
                              <Switch
                                checked={isCustomTime}
                                onCheckedChange={handleCustomTimeChange}
                                aria-label="Toggle custom time"
                              />
                            </div>

                            {isCustomTime && (
                              <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                                  name="customStartTime"
                            render={({ field }) => (
                              <FormItem>
                                      <FormLabel>Custom Start Time</FormLabel>
                                <FormControl>
                                  <Input
                                    type="time"
                                    {...field}
                                    placeholder="HH:mm"
                                          required
                                  />
                                </FormControl>
                                <FormDescription>
                                  24-hour format (e.g., 09:00)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                                  name="customEndTime"
                            render={({ field }) => (
                              <FormItem>
                                      <FormLabel>Custom End Time</FormLabel>
                                <FormControl>
                                  <Input
                                    type="time"
                                    {...field}
                                    placeholder="HH:mm"
                                          required
                                  />
                                </FormControl>
                                <FormDescription>
                                  24-hour format (e.g., 17:00)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading || !form.formState.isValid}
                  className="bg-primary hover:bg-primary/90"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </div>
                  ) : (
                    'Create Roster'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 