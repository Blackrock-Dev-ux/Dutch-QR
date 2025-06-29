import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Attendance } from '@/types';
import { Calendar, Download, Search, Clock, Timer, FileText, Share2, Loader2, Trash2, UserX, AlertTriangle, CheckCircle, FileDown, Share, UserCheck } from 'lucide-react';
import { getAttendanceRecords, deleteAttendance, deleteAttendanceRecord, createTestAttendanceRecord } from '@/utils/attendanceUtils';
import { getDepartments } from '@/utils/employeeUtils';
import { Document, Page, Text, View, PDFDownloadLink } from '@react-pdf/renderer';
import { toast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import Swal from 'sweetalert2';
import { supabase } from '@/integrations/supabase/client';
import AbsentEmployeeDownload from '@/components/AbsentEmployeeDownload';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceStrict, format } from 'date-fns';
import { calculateWorkingTime } from '@/utils/attendanceUtils';
import { PresentEmployeeReport } from './PresentEmployeeReport';
import EnhancedA4AttendanceReport from '@/components/EnhancedA4AttendanceReport';

interface AttendanceTableProps {
  attendanceRecords?: Attendance[] | Promise<Attendance[]>;
}

// Define styles for PDF
const styles = {
  // Color Palette
  colors: {
    primary: '#2c3e50',
    secondary: '#3498db',
    background: '#f4f6f7',
    text: '#2c3e50',
    muted: '#7f8c8d',
    accent: '#27ae60',
    warning: '#e74c3c',
  },

  // Page Layout
  page: {
    padding: '15 10',
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },

  // Header Design
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'column',
    flex: 2,
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#7f8c8d',
  },
  dateRange: {
    fontSize: 9,
    color: '#7f8c8d',
  },

  // Summary Section
  summarySection: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryBox: {
    width: '32%',
    backgroundColor: '#ffffff',
    padding: 5,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  summaryPercent: {
    fontSize: 8,
    color: '#27ae60',
  },

  // Table Styles
  table: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2c3e50',
    padding: '3 2',
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    padding: '2 1',
    minHeight: 16,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: '#f8f9fa',
  },
  tableCell: {
    fontSize: 7,
    color: '#2c3e50',
    textAlign: 'center',
  },
  nameCellStyle: {
    fontSize: 7,
    color: '#2c3e50',
    fontWeight: '500',
    textAlign: 'left',
  },
  statusCell: {
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statusPresent: {
    color: '#27ae60',
  },
  statusLate: {
    color: '#e74c3c',
  },

  // Footer
  footer: {
    marginTop: 5,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 6,
    color: '#7f8c8d',
  },
} as const;

// Add a helper function to format the status badge
const getStatusStyle = (status: string | undefined | null) => {
  if (!status) return {};

  switch(status.toLowerCase()) {
    case 'present':
      return styles.statusPresent;
    case 'late':
      return styles.statusLate;
    case 'absent':
      return {
        backgroundColor: 'rgba(231, 76, 60, 0.2)',
        color: '#e74c3c'
      };
    default:
      return {};
  }
};

// Add new interface for deletion type after the AttendanceTableProps interface
interface DeletionType {
  type: 'check_in' | 'check_out' | null;
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ 
  attendanceRecords: propAttendanceRecords = []
}) => {
  // Get today and 7 days ago for default date range
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Initialize all state with safe default values
  const [startDate, setStartDate] = useState<string>(sevenDaysAgo);
  const [endDate, setEndDate] = useState<string>(today);
  const [department, setDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [departments, setDepartments] = useState<string[]>(['all']);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [sharing, setSharing] = useState<boolean>(false);
  const [showAbsentDialog, setShowAbsentDialog] = useState<boolean>(false);
  const [deletionType, setDeletionType] = useState<DeletionType>({ type: null });
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [analyzedRecords, setAnalyzedRecords] = useState<Attendance[]>([]);
  const [lastDeletedId, setLastDeletedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPresentReportOpen, setIsPresentReportOpen] = useState(false);
  const [filteredRecords, setFilteredRecords] = useState<Attendance[]>([]);
  const [isAllFilteredSelected, setIsAllFilteredSelected] = useState(false);
  const [isPartiallySelected, setIsPartiallySelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch departments
        const deptData = await getDepartments();
        if (Array.isArray(deptData)) {
          setDepartments(['all', ...deptData]);
        } else {
          console.warn('Received invalid departments data:', deptData);
          setDepartments(['all']);
        }
        
        // Handle attendance records
        let fetchedRecords: Attendance[] = [];
        
        if (propAttendanceRecords) {
          if (propAttendanceRecords instanceof Promise) {
            try {
              fetchedRecords = await propAttendanceRecords;
            } catch (error) {
              console.error('Error fetching attendance records:', error);
              setError('Failed to fetch attendance records');
              fetchedRecords = [];
            }
          } else if (Array.isArray(propAttendanceRecords)) {
            fetchedRecords = propAttendanceRecords;
          } else {
            console.warn('Received invalid attendance records:', propAttendanceRecords);
            fetchedRecords = [];
          }
        }
        
        setRecords(fetchedRecords);
        setFilteredRecords(fetchedRecords);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch data');
        // Set empty arrays on error
        setRecords([]);
        setFilteredRecords([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [propAttendanceRecords]);

  useEffect(() => {
    if (!records || records.length === 0) return;

    const analyzeRecords = () => {
      const updatedRecords = records.map(record => {
        // Ensure all required date fields are properly formatted
        const processedRecord = {
          ...record,
          // Use existing properties
          check_in_time: record.check_in_time,
          check_out_time: record.check_out_time,
          second_check_in_time: record.second_check_in_time,
          second_check_out_time: record.second_check_out_time
        };

        // Calculate working time using the standardized function
        const workingTime = calculateWorkingTime(processedRecord);
        console.log('Record:', processedRecord);
        console.log('Calculated working time:', workingTime);

        return {
          ...processedRecord,
          working_duration: workingTime
        };
      });

      setAnalyzedRecords(updatedRecords);
    };

    analyzeRecords();
  }, [records]);
  
  // Filter records
  useEffect(() => {
    // Safety check for records array
    if (!Array.isArray(records)) {
      console.warn('Records is not an array:', records);
      setFilteredRecords([]);
      return;
    }

    let filtered = [...records];

    // Filter by date range
    filtered = filtered.filter(record => {
      if (!record?.date) return false;
      const recordDate = record.date;
      return recordDate >= startDate && recordDate <= endDate;
    });

    // Filter by department
    if (department !== 'all') {
      filtered = filtered.filter(record => 
        record?.employee?.department?.toLowerCase() === department.toLowerCase()
      );
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        (record?.employee_name || '').toLowerCase().includes(searchLower) ||
        (record?.employee?.department || '').toLowerCase().includes(searchLower) ||
        (record?.employee?.position || '').toLowerCase().includes(searchLower)
      );
    }

    setFilteredRecords(filtered);
    // Clear selected records when filters change
    setSelectedRecords([]);
  }, [records, startDate, endDate, department, searchTerm]);

  // Update selection states
  useEffect(() => {
    // Ensure both arrays are valid before comparing
    if (!Array.isArray(filteredRecords) || !Array.isArray(selectedRecords)) {
      setIsAllFilteredSelected(false);
      setIsPartiallySelected(false);
      return;
    }

    const filteredCount = filteredRecords.length;
    const selectedCount = selectedRecords.length;
    
    // Only set as all selected if there are records and all are selected
    setIsAllFilteredSelected(filteredCount > 0 && selectedCount === filteredCount);
    setIsPartiallySelected(selectedCount > 0 && selectedCount < filteredCount);
  }, [selectedRecords, filteredRecords]);

  const exportToCsv = () => {
    if (filteredRecords.length === 0) return;
    
    const headers = [
      'Date', 
      'Employee Name', 
      'First Check-In', 
      'First Check-Out', 
      'Second Check-In', 
      'Second Check-Out', 
      'Break Duration', 
      'Status', 
      'Minutes Late', 
      'Working Duration'
    ];
    
    const rows = filteredRecords.map(record => [
      record.date,
      record.employee_name || 'Unknown',
      record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString() : 'N/A',
      record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : 'N/A',
      record.second_check_in_time ? new Date(record.second_check_in_time).toLocaleTimeString() : 'N/A',
      record.second_check_out_time ? new Date(record.second_check_out_time).toLocaleTimeString() : 'N/A',
      formatBreakDuration(record.break_duration),
      record.status,
      record.minutes_late || 0,
      record.working_duration || 'N/A'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdf = () => {
    if (filteredRecords.length === 0) return null;

    // Calculate summary statistics
    const totalEmployees = filteredRecords.length;
    const onTimeEmployees = filteredRecords.filter(r => {
      const checkIn = new Date(r.check_in_time);
      const workStart = new Date(checkIn);
      workStart.setHours(9, 0, 0, 0);
      return checkIn <= workStart;
    }).length;
    const lateEmployees = totalEmployees - onTimeEmployees;
    const checkedOutEmployees = filteredRecords.filter(r => r.status === 'checked-out').length;
    const stillWorkingEmployees = filteredRecords.filter(r => r.status === 'present').length;

    // More aggressive font size scaling based on record count
    const getFontSize = (count: number) => {
      if (count <= 15) return { base: 9, header: 16 };
      if (count <= 25) return { base: 8, header: 14 };
      if (count <= 35) return { base: 7, header: 12 };
      if (count <= 45) return { base: 6, header: 10 };
      return { base: 5, header: 8 };
    };

    const sizes = getFontSize(filteredRecords.length);
    const padding = Math.max(10, 30 - Math.floor(filteredRecords.length / 10) * 5);

    const AttendancePDF = (): React.ReactElement => (
      <Document>
        <Page size="A4" style={[styles.page, { padding: '15 10' }]}>
          <View style={[styles.header, { marginBottom: 10, paddingBottom: 5 }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { fontSize: 14 }]}>Attendance Report</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={[styles.dateRange, { fontSize: 8 }]}>
                {startDate === endDate 
                  ? format(new Date(startDate), 'MM/dd/yy')
                  : `${format(new Date(startDate), 'MM/dd')} - ${format(new Date(endDate), 'MM/dd/yy')}`}
              </Text>
            </View>
          </View>

          <View style={[styles.summarySection, { padding: 6, marginBottom: 8 }]}>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryBox, { padding: 4 }]}>
                <Text style={[styles.summaryValue, { fontSize: 10 }]}>
                  Total: {totalEmployees}
                </Text>
              </View>
              <View style={[styles.summaryBox, { padding: 4 }]}>
                <Text style={[styles.summaryValue, { fontSize: 10 }]}>
                  On Time: {onTimeEmployees} ({((onTimeEmployees/totalEmployees)*100).toFixed(0)}%)
                </Text>
              </View>
              <View style={[styles.summaryBox, { padding: 4 }]}>
                <Text style={[styles.summaryValue, { fontSize: 10 }]}>
                  Late: {lateEmployees} ({((lateEmployees/totalEmployees)*100).toFixed(0)}%)
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.table}>
            <View style={[styles.tableHeader, { padding: '2 1' }]}>
              <Text style={[styles.tableHeaderCell, { flex: 0.5, fontSize: 7 }]}>Date</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, fontSize: 7 }]}>Name</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.5, fontSize: 7 }]}>In</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.5, fontSize: 7 }]}>Out</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.5, fontSize: 7 }]}>2nd In</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.5, fontSize: 7 }]}>2nd Out</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.4, fontSize: 7 }]}>Brk</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.4, fontSize: 7 }]}>Hrs</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.4, fontSize: 7 }]}>Sts</Text>
            </View>

            {filteredRecords.map((record, index) => (
              <View key={index} style={[
                styles.tableRow,
                { padding: '1 1', minHeight: 14 },
                index % 2 === 1 && styles.tableRowAlt
              ]}>
                <Text style={[styles.tableCell, { flex: 0.5, fontSize: 6 }]}>
                  {format(new Date(record.date), 'MM/dd')}
                </Text>
                <Text style={[styles.nameCellStyle, { flex: 1.2, fontSize: 6 }]}>
                  {record.employee_name}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.5, fontSize: 6 }]}>
                  {record.check_in_time ? format(new Date(record.check_in_time), 'HH:mm') : '-'}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.5, fontSize: 6 }]}>
                  {record.check_out_time ? format(new Date(record.check_out_time), 'HH:mm') : '-'}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.5, fontSize: 6 }]}>
                  {record.second_check_in_time ? format(new Date(record.second_check_in_time), 'HH:mm') : '-'}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.5, fontSize: 6 }]}>
                  {record.second_check_out_time ? format(new Date(record.second_check_out_time), 'HH:mm') : '-'}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.4, fontSize: 6 }]}>
                  {formatBreakDuration(record.break_duration)}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.4, fontSize: 6 }]}>
                  {calculateWorkingTime(record)}
                </Text>
                <Text style={[
                  styles.statusCell,
                  { flex: 0.4, fontSize: 6 },
                  record.status?.toLowerCase() === 'present' ? styles.statusPresent : styles.statusLate
                ]}>
                  {record.status?.slice(0,3) || '-'}
                </Text>
              </View>
            ))}
          </View>

          <View style={[styles.footer, { marginTop: 4, paddingTop: 2 }]}>
            <Text style={[styles.footerText, { fontSize: 5 }]}>
              Generated: {format(new Date(), 'MM/dd/yy HH:mm')}
            </Text>
          </View>
        </Page>
      </Document>
    );

    return (
      <PDFDownloadLink
        document={<AttendancePDF />}
        fileName={`attendance_${startDate}_to_${endDate}.pdf`}
      >
        {({ loading }) => (
          <Button 
            disabled={loading} 
            className="w-full sm:w-auto flex items-center justify-center"
          >
            <FileText className="mr-2 h-4 w-4" />
            {loading ? 'Generating...' : 'Export to PDF'}
          </Button>
        )}
      </PDFDownloadLink>
    );
  };

  const handleSelectRecord = (id: string) => {
    setSelectedRecords(prev => 
      prev.includes(id) 
        ? prev.filter(recordId => recordId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allFilteredIds = filteredRecords.map(record => record.id);
      setSelectedRecords(allFilteredIds);
    } else {
      setSelectedRecords([]);
    }
  };

  const formatRecordsForWhatsApp = (selectedRecords: Attendance[]): string => {
    // Safety check for empty or undefined records
    if (!Array.isArray(selectedRecords) || selectedRecords.length === 0) {
      return 'No attendance records to format';
    }
    
    // Get the date range for the report
    const dates = selectedRecords
      .filter(r => r?.date)
      .map(r => new Date(r.date));
      
    if (dates.length === 0) {
      return 'No valid dates found in records';
    }
    
    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const dateRange = startDate.toLocaleDateString() === endDate.toLocaleDateString() 
      ? `for ${startDate.toLocaleDateString()}` 
      : `from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;

    // Group records by department
    const recordsByDept = selectedRecords.reduce((acc, record) => {
      const dept = record?.employee?.department || 'Unassigned';
      if (!acc[dept]) {
        acc[dept] = [];
      }
      acc[dept].push(record);
      return acc;
    }, {} as { [key: string]: Attendance[] });

    // Calculate overall summary statistics
    const totalEmployees = selectedRecords.length;
    const onTime = selectedRecords.filter(r => {
      if (!r?.check_in_time) return false;
      const checkIn = new Date(r.check_in_time);
      const workStart = new Date(checkIn);
      workStart.setHours(9, 0, 0, 0);
      return checkIn <= workStart;
    }).length;
    const late = totalEmployees - onTime;
    const checkedOut = selectedRecords.filter(r => r?.status === 'checked-out').length;
    const stillWorking = selectedRecords.filter(r => r?.status === 'present').length;

    // Create header with overall summary
    const header = `*ATTENDANCE REPORT ${dateRange.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━
📊 *OVERALL SUMMARY*
• Total Employees: ${totalEmployees}
• On Time: ${onTime} (${((onTime/totalEmployees)*100).toFixed(1)}%) ✅
• Late: ${late} (${((late/totalEmployees)*100).toFixed(1)}%) ⚠️
• Checked Out: ${checkedOut} 🏃
• Still Working: ${stillWorking} 💼
━━━━━━━━━━━━━━━━━━━━━\n`;

    // Format department-wise records
    const departmentRecords = Object.entries(recordsByDept).map(([dept, records]) => {
      // Calculate department statistics
      const deptTotal = records.length;
      const deptOnTime = records.filter(r => {
        const checkIn = new Date(r.check_in_time);
        const workStart = new Date(checkIn);
        workStart.setHours(9, 0, 0, 0);
        return checkIn <= workStart;
      }).length;
      const deptLate = deptTotal - deptOnTime;
      const deptCheckedOut = records.filter(r => r.status === 'checked-out').length;
      const deptWorking = records.filter(r => r.status === 'present').length;

      // Department header with statistics
      const deptHeader = `\n🏛️ *DEPARTMENT: ${dept.toUpperCase()}*
📈 Department Statistics:
• Total Employees: ${deptTotal}
• On Time: ${deptOnTime} (${((deptOnTime/deptTotal)*100).toFixed(1)}%)
• Late: ${deptLate} (${((deptLate/deptTotal)*100).toFixed(1)}%)
• Checked Out: ${deptCheckedOut}
• Still Working: ${deptWorking}
──────────────────────`;

      // Format individual employee records for this department
      const employeeRecords = records.map(record => {
        const checkIn = new Date(record.check_in_time);
        const workStart = new Date(checkIn);
        workStart.setHours(9, 0, 0, 0);
        
        let lateStatus = '';
        let lateMinutes = 0;
        if (checkIn > workStart) {
          lateMinutes = Math.round((checkIn.getTime() - workStart.getTime()) / (1000 * 60));
          const hours = Math.floor(lateMinutes / 60);
          const minutes = lateMinutes % 60;
          
          if (hours > 0) {
            lateStatus = `⚠️ *${hours}h ${minutes}m late*`;
          } else {
            lateStatus = `⚠️ *${minutes}m late*`;
          }
        } else {
          lateStatus = '✅ *On Time*';
        }

        // Calculate working duration
        let workingTime = 'Still Working';
        let workingHours = 0;
        if (record.check_out_time) {
          const checkOut = new Date(record.check_out_time);
          workingHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          const hours = Math.floor(workingHours);
          const minutes = Math.floor((workingHours - hours) * 60);
          workingTime = `${hours}h ${minutes}m`;
        }

        // Status emoji based on working hours and late minutes
        let statusEmoji = '🟡'; // Default - Still Working
        if (record.check_out_time) {
          if (workingHours >= 9) {
            statusEmoji = '🟢'; // Full day
          } else if (workingHours >= 4) {
            statusEmoji = '🟠'; // Half day
          } else {
            statusEmoji = '🔴'; // Less than half day
          }
        }
        if (lateMinutes > 120) {
          statusEmoji = '🔴'; // Very late
        }

        return `${statusEmoji} *${record.employee_name}*
⏰ Check In: ${formatTime(record.check_in_time)}
${record.check_out_time ? `🏃 Check Out: ${formatTime(record.check_out_time)}` : '💼 Status: Still Working'}
${lateStatus}
⏱️ Duration: ${workingTime}
📝 Status: ${record.status === 'checked-out' ? 'Shift Completed' : 'Shift In Progress'}
${record.overtime ? `💪 Overtime: ${record.overtime.toFixed(1)}h` : ''}`;
      }).join('\n───────────\n');

      return `${deptHeader}\n\n${employeeRecords}`;
    }).join('\n\n━━━━━━━━━━━━━━━━━━━━━\n');

    // Add footer with generation time and legend
    const footer = `\n━━━━━━━━━━━━━━━━━━━━━
📋 *STATUS LEGEND*
🟢 Full Day (9+ hours)
🟠 Half Day (4-9 hours)
🔴 Critical (Less than 4 hours/Very Late)
🟡 Still Working

🤖 Generated by QR Check-In System
🕒 Generated on: ${new Date().toLocaleString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })}
📱 For more details, check the dashboard`;

    return `${header}${departmentRecords}${footer}`;
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      
      if (!Array.isArray(records) || !Array.isArray(selectedRecords)) {
        toast({
          title: "Error",
          description: "Invalid records data",
          variant: "destructive",
        });
        return;
      }

      const selectedAttendanceRecords = records.filter(record => 
        record?.id && selectedRecords.includes(record.id)
      );

      if (selectedAttendanceRecords.length === 0) {
        toast({
          title: "No Records Selected",
          description: "Please select at least one record to share.",
          variant: "destructive",
        });
        return;
      }

      // Split records into chunks if needed (WhatsApp has URL length limits)
      const chunkSize = 50;
      const recordChunks = [];
      for (let i = 0; i < selectedAttendanceRecords.length; i += chunkSize) {
        recordChunks.push(selectedAttendanceRecords.slice(i, i + chunkSize));
      }

      // Process each chunk
      for (let i = 0; i < recordChunks.length; i++) {
        const chunk = recordChunks[i];
        const message = formatRecordsForWhatsApp(chunk);
        if (!message) {
          toast({
            title: "Error",
            description: "Failed to format records for sharing",
            variant: "destructive",
          });
          return;
        }
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
        
        // Add a small delay between chunks to prevent browser blocking
        if (i < recordChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      toast({
        title: "Sharing Records",
        description: `WhatsApp has been opened with ${selectedAttendanceRecords.length} records.`,
      });
    } catch (error) {
      console.error('Error sharing records:', error);
      toast({
        title: "Sharing Failed",
        description: "An error occurred while sharing the records.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteSingleRecord = async (recordId: string) => {
    try {
      const result = await Swal.fire({
        title: 'Delete Attendance Record',
        text: 'Do you want to delete this attendance record?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
          await Swal.fire({
            title: 'Deleting...',
            allowEscapeKey: false,
            allowOutsideClick: false,
            showConfirmButton: false
          });
        
        try {
          // Use deleteAttendance instead of deleteAttendanceRecord for hard delete
          const result = await deleteAttendance([recordId]);
          
          if (result.success) {
            // Remove the record from local state first
            setRecords(prev => prev.filter(record => record.id !== recordId));
            
            // Trigger a refresh of the data
            setRefreshTrigger(prev => prev + 1);
            
      await Swal.fire({
        icon: 'success',
              title: 'Deleted!',
              text: 'The attendance record has been deleted.',
              timer: 1500
            });
          } else {
            throw new Error(result.message || 'Failed to delete record');
          }
    } catch (error) {
          console.error('Error deleting record:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
            text: error instanceof Error ? error.message : 'Failed to delete record'
          });
        }
      }
    } catch (error) {
      console.error('Error in handleDeleteSingleRecord:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An unexpected error occurred'
      });
    }
  };

  // Add this useEffect to handle record refreshes
  useEffect(() => {
    const refreshRecords = async () => {
      if (lastDeletedId) {
        // Wait a moment to ensure deletion is processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        const freshRecords = await getAttendanceRecords();
        // Filter out the deleted record if it somehow still exists
        setRecords(freshRecords.filter(record => record.id !== lastDeletedId));
        setLastDeletedId(null);
      }
    };

    refreshRecords();
  }, [lastDeletedId]);

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'No Records Selected',
        text: 'Please select records to delete.',
      });
      return;
    }

    try {
      const result = await Swal.fire({
        title: 'Delete Selected Records',
        html: `
          <div class="text-center">
            <p>You are about to delete <strong>${selectedRecords.length}</strong> attendance record(s).</p>
            <p class="text-red-600 mt-2">This action cannot be undone!</p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, Delete All',
        cancelButtonText: 'Cancel'
      });

      if (result.isConfirmed) {
          await Swal.fire({
            title: 'Deleting...',
            allowEscapeKey: false,
            allowOutsideClick: false,
            showConfirmButton: false
          });

        try {
      const deleteResult = await deleteAttendance(selectedRecords);

          if (deleteResult.success) {
      // Immediately update local state
            setRecords(prev => prev.filter(record => !selectedRecords.includes(record.id)));
        setSelectedRecords([]);
      
            // Set the last deleted IDs for refresh
            selectedRecords.forEach(id => setLastDeletedId(id));

      await Swal.fire({
        icon: 'success',
        title: 'Success',
              text: `Successfully deleted ${deleteResult.deletedCount} record(s)`,
              timer: 1500
            });
          } else {
            await Swal.fire({
              icon: 'error',
              title: 'Error',
              text: deleteResult.message || 'Failed to delete records'
            });
          }
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
            text: error instanceof Error ? error.message : 'Failed to delete records'
          });
        }
      }
    } catch (error) {
      console.error('Delete operation failed:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to delete records'
      });
    }
  };

  // Update formatBreakDuration function
  const formatBreakDuration = (duration: string | number | null | undefined): string => {
    if (duration === undefined || duration === null) return 'N/A';
    
    try {
      // Handle numeric input (assuming minutes)
      if (typeof duration === 'number') {
        const minutes = Math.floor(duration);
        if (minutes === 0) return 'N/A';
        
        // Convert to hours and minutes if needed
        if (minutes >= 60) {
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          return `${hours}h ${remainingMinutes}m`;
        }
        
        return `${minutes}m`;
      }

      // Handle string input
      const trimmedDuration = duration.trim().toLowerCase();
      
      // Handle 'N/A' or empty string cases
      if (trimmedDuration === 'n/a' || trimmedDuration === '') return 'N/A';
      
      // Parse minutes from string (e.g., '30 minutes', '45 mins')
      const minutesMatch = trimmedDuration.match(/(\d+)\s*(?:minutes?|mins?)/);
      if (minutesMatch) {
        const minutes = parseInt(minutesMatch[1], 10);
        if (minutes === 0) return 'N/A';
        
        // Convert to hours and minutes if needed
        if (minutes >= 60) {
          const hours = Math.floor(minutes / 60);
          const remainingMinutes = minutes % 60;
          return `${hours}h ${remainingMinutes}m`;
        }
        
        return `${minutes}m`;
      }
      
      // Handle direct hour:minute format
      const hourMinuteMatch = trimmedDuration.match(/(\d+):(\d+)/);
      if (hourMinuteMatch) {
        const hours = parseInt(hourMinuteMatch[1], 10);
        const minutes = parseInt(hourMinuteMatch[2], 10);
        
        if (hours === 0 && minutes === 0) return 'N/A';
        
        if (hours > 0 && minutes > 0) {
          return `${hours}h ${minutes}m`;
        } else if (hours > 0) {
          return `${hours}h`;
        } else {
          return `${minutes}m`;
        }
      }
      
      // Fallback: return original string duration
      return duration;
    } catch {
      return 'N/A';
    }
  };

  // Local implementation of formatTime
  const formatTime = (timeString: string) => {
    if (!timeString) return '-';
    const time = new Date(timeString);
    return time.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const calculateAverageBreakDuration = (records: Attendance[]): string => {
    if (records.length === 0) return 'N/A';
    
    const totalMinutes = records.reduce((total, record) => {
      const duration = record.break_duration;
      if (!duration) return total;
      
      if (typeof duration === 'number') {
        return total + duration;
      }
      
      // Handle string duration
      try {
        const minutes = parseInt(duration.replace(/[^\d]/g, ''), 10) || 0;
        return total + minutes;
      } catch {
      return total;
      }
    }, 0);
    
    const averageMinutes = totalMinutes / records.length;
    return `${Math.round(averageMinutes)}m`;
  };

  const calculateAverageWorkingTime = (records: Attendance[]): string => {
    if (records.length === 0) return 'N/A';
    
    const totalMinutes = records.reduce((total, record) => {
      const duration = record.working_duration;
      if (duration) {
        const minutes = parseInt(duration.split('m')[0] || '0', 10);
        return total + minutes;
      }
      return total;
    }, 0);
    
    const averageMinutes = totalMinutes / records.length;
    return `${Math.round(averageMinutes)}m`;
  };

  const handleCreateTestRecord = async () => {
    try {
      await createTestAttendanceRecord();
      // Refresh the records
      setRefreshTrigger(prev => prev + 1);
      toast({
        title: 'Success',
        description: 'Test record created successfully',
      });
    } catch (error) {
      console.error('Error creating test record:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create test record',
        variant: 'destructive'
      });
    }
  };

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const records = await getAttendanceRecords();
      setRecords(records);
    } catch (error) {
      console.error('Error fetching records:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to fetch attendance records'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add a helper function to format time compactly
  const formatTimeCompact = (timeString: string | null | undefined): string => {
    if (!timeString) return '-';
    return format(new Date(timeString), 'HH:mm');
  };

  // Add a helper function to format date compactly
  const formatDateCompact = (dateString: string): string => {
    return format(new Date(dateString), 'MM/dd');
  };

  const getStatusBadge = (record: Attendance) => {
    const isLate = record.minutes_late > 0;
    const isEarlyDeparture = record.early_departure_minutes > 0;
    const complianceRate = record.compliance_rate || 0;

    if (isLate || isEarlyDeparture) {
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            {isLate ? `${record.minutes_late}m Late` : `${record.early_departure_minutes}m Early`}
          </Badge>
          <Badge variant={complianceRate >= 90 ? "default" : "warning"}>
            {complianceRate.toFixed(1)}% Compliance
          </Badge>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          On Time
        </Badge>
        <Badge variant="default">
          {complianceRate.toFixed(1)}% Compliance
        </Badge>
      </div>
    );
  };

  // Add this helper function at the top level
  const formatTimeDisplay = (timeString: string | null | undefined): string => {
    if (!timeString) return '-';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '-';
    }
  };

  const formatDuration = (minutes: number | null | undefined): string => {
    if (!minutes || minutes < 0) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">Attendance Records</h2>
            <Button onClick={handleCreateTestRecord} variant="outline" size="sm" className="ml-4">
              Create Test Record
                </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            <Button
              onClick={() => exportToCsv()}
              disabled={filteredRecords.length === 0}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Quick CSV
            </Button>
            {filteredRecords.length > 0 && exportToPdf()}
            <EnhancedA4AttendanceReport
              records={records}
              filteredRecords={filteredRecords}
              currentFilters={{
                startDate,
                endDate,
                department,
                searchTerm
              }}
              className="w-full sm:w-auto"
            />
            <Button
              onClick={() => setIsPresentReportOpen(true)}
              className="w-full sm:w-auto flex items-center justify-center"
              variant="outline"
            >
              <UserCheck className="mr-2 h-4 w-4" />
              Present Report
            </Button>
            <Button
              onClick={() => setShowAbsentDialog(true)}
              className="w-full sm:w-auto flex items-center justify-center"
              variant="outline"
            >
              <UserX className="mr-2 h-4 w-4" />
              Absent Report
            </Button>
            <Button
              onClick={handleShare}
              disabled={selectedRecords.length === 0 || sharing}
              className="w-full sm:w-auto flex items-center justify-center"
            >
              {sharing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share className="mr-2 h-4 w-4" />
                  Share Selected
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="w-full">
              <label className="text-sm font-medium">Start Date</label>
              <div className="flex mt-1">
                <Calendar className="mr-2 h-4 w-4 mt-3" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={today}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="w-full">
              <label className="text-sm font-medium">End Date</label>
              <div className="flex mt-1">
                <Calendar className="mr-2 h-4 w-4 mt-3" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={today}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="w-full">
              <label className="text-sm font-medium">Department</label>
              <Select
                value={department}
                onValueChange={setDepartment}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept === 'all' ? 'All Departments' : dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full">
              <label className="text-sm font-medium">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search employee..."
                  className="pl-8 w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <Checkbox 
                checked={isPartiallySelected ? "indeterminate" : isAllFilteredSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all filtered records"
                className="translate-y-[2px]"
              />
              <span className="text-sm text-gray-500">
                {selectedRecords.length} records selected 
                {filteredRecords.length !== records.length && 
                  ` (${filteredRecords.length} in current view)`
                }
              </span>
              {selectedRecords.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedRecords.length})
                </Button>
              )}
            </div>
          </div>
          
          <div className="rounded-md border">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] sticky left-0 bg-background">Select</TableHead>
                      <TableHead className="min-w-[100px] text-center">Date</TableHead>
                      <TableHead className="min-w-[150px] text-left">Employee Name</TableHead>
                      <TableHead className="min-w-[160px] text-center">First Check-In</TableHead>
                      <TableHead className="min-w-[160px] text-center">First Check-Out</TableHead>
                      <TableHead className="min-w-[160px] text-center">Second Check-In</TableHead>
                      <TableHead className="min-w-[160px] text-center">Second Check-Out</TableHead>
                      <TableHead className="min-w-[120px] text-center">Break Duration</TableHead>
                      <TableHead className="min-w-[140px] text-center">Working Duration</TableHead>
                      <TableHead className="min-w-[140px] text-center">Status</TableHead>
                      <TableHead className="min-w-[140px] text-center">
                        <div className="flex items-center justify-center">
                          <Clock className="mr-1 h-4 w-4" />
                          <span className="hidden sm:inline">Late Duration</span>
                          <span className="sm:hidden">Late</span>
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[100px] sticky right-0 bg-background text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center h-24">
                          <div className="flex justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center h-24">
                          No attendance records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record, index) => (
                        <TableRow key={record.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/50'}>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            <Checkbox
                              checked={selectedRecords.includes(record.id)}
                              onCheckedChange={() => handleSelectRecord(record.id)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {formatDateCompact(record.date)}
                          </TableCell>
                          <TableCell className="text-left">
                            {record.employee_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatTimeDisplay(record.check_in_time || record.first_check_in_time)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatTimeDisplay(record.check_out_time || record.first_check_out_time)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatTimeDisplay(record.second_check_in_time)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatTimeDisplay(record.second_check_out_time)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatBreakDuration(record.break_duration)}
                          </TableCell>
                          <TableCell className="text-center">
                            {calculateWorkingTime(record) || (record.actual_hours ? formatDuration(Math.round(record.actual_hours * 60)) : '0h 0m')}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col gap-1 items-center">
                              <Badge 
                                variant={
                                  record.status === 'completed' ? 'default' :
                                  record.status === 'present' ? 'default' :
                                  record.status === 'checked-out' ? 'secondary' :
                                  record.status === 'on_break' ? 'outline' :
                                  'secondary'
                                }
                                className="text-xs"
                              >
                                {record.status === 'present' ? 'CHECKED IN' : 
                                 record.status === 'checked-out' ? 'COMPLETED' :
                                 record.status === 'on_break' ? 'ON BREAK' :
                                 record.status?.toUpperCase() || 'UNKNOWN'}
                              </Badge>
                              {record.minutes_late && record.minutes_late !== '0h 0m' && (
                                <Badge variant="destructive" className="text-xs">
                                  {record.minutes_late} Late
                                </Badge>
                              )}
                              {record.early_departure_minutes > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {record.early_departure_minutes}m Early
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {record.minutes_late && record.minutes_late !== '0h 0m' ? record.minutes_late : '-'}
                          </TableCell>
                          <TableCell className="sticky right-0 bg-background">
                            <div className="flex items-center justify-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                              onClick={() => handleDeleteSingleRecord(record.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Add Absent Report Dialog */}
      <Dialog open={showAbsentDialog} onOpenChange={setShowAbsentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Absent Employees Report</DialogTitle>
            <DialogDescription>
              View and download the list of absent employees.
            </DialogDescription>
          </DialogHeader>
          <AbsentEmployeeDownload />
        </DialogContent>
      </Dialog>

      {/* Present Report Dialog */}
      <Dialog open={isPresentReportOpen} onOpenChange={setIsPresentReportOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Generate Present Employee Report</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <PresentEmployeeReport 
              onSuccess={() => setIsPresentReportOpen(false)}
              className="flex-col space-y-4"
            />
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AttendanceTable;
