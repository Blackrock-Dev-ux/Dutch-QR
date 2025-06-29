import { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { getAdminContactInfo, saveAdminContactInfo, recordAttendanceCheckIn, determineNextAttendanceAction, singleScanAttendance, getAttendanceRecords } from '../utils/attendanceUtils';
import Swal from 'sweetalert2';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { 
  FileSpreadsheet, 
  FileText, 
  Filter, 
  Search,
  Trash2,
  X,
  Clock,
  Calendar,
  Loader2,
  Download
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  deleteAttendance 
} from '@/utils/attendanceUtils';
import { format } from 'date-fns';
import AbsentEmployeeDownload from '@/components/AbsentEmployeeDownload';
import { PDFDownloadLink } from '@react-pdf/renderer';
import EnhancedA4AttendanceReport from '@/components/EnhancedA4AttendanceReport';
import QRScanner from '@/components/QRScanner';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { AbsentEmployeeReport } from '@/components/AbsentEmployeeReport';
import { PresentEmployeeReport } from '@/components/PresentEmployeeReport';
import AttendanceTable from '@/components/AttendanceTable';
import { Attendance } from '@/types';

// Dynamically import QR Scanner to avoid SSR issues
const QrScanner = dynamic(() => import('react-qr-scanner'), {
  ssr: false
});

// Add this function before the Attendance component
const extractEmployeeId = (qrData: string): string | null => {
  // Assuming QR code contains either an employee ID or email
  const trimmedData = qrData.trim();
  
  // If it looks like an email, return it
  if (trimmedData.includes('@')) {
    return trimmedData;
  }
  
  // If it looks like an ID (assuming IDs are alphanumeric)
  if (/^[a-zA-Z0-9]+$/.test(trimmedData)) {
    return trimmedData;
  }
  
  return null;
};

export default function Attendance() {
  const router = useRouter();
  const { toast } = useToast();
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isWhatsappShareEnabled, setIsWhatsappShareEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(true);
  const [showAnimation, setShowAnimation] = useState<'success' | 'error' | null>(null);
  const [actionType, setActionType] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);

  // Enhanced filtering with more options
  const [advancedFilters, setAdvancedFilters] = useState({
    status: 'All',
    minWorkHours: '',
    maxWorkHours: '',
    lateArrivals: false,
    earlyDepartures: false
  });

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const records = await getAttendanceRecords();
      
      // Ensure records is always an array
      if (!Array.isArray(records)) {
        console.warn('Received non-array records:', records);
        setAttendanceRecords([]);
        return;
      }
      
      console.log('Fetched Attendance Records:', records);
      setAttendanceRecords(records);
    } catch (err) {
      console.error('Error fetching attendance records:', err);
      setError('Failed to fetch attendance records');
      setAttendanceRecords([]); // Set empty array on error
      toast({
        title: "Error",
        description: "Failed to fetch attendance records",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Try to refresh the session first
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!session) {
          // Try anonymous sign in if no session
          const { error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError) {
            console.error('Anonymous sign in failed:', signInError);
            toast({
              title: "Error",
              description: "Failed to initialize session",
              variant: "destructive"
            });
            return;
          }
        }

        // At this point we either have an existing session or a new anonymous session
        console.log('Session initialized successfully');
        setIsLoading(false);
        loadSettings();
        fetchRecords(); // Fetch records after session is initialized
      } catch (error) {
        console.error('Session initialization failed:', error);
        toast({
          title: "Error",
          description: "Failed to initialize session",
          variant: "destructive"
        });
      }
    };

    checkSession();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const loadSettings = async () => {
    try {
      const settings = await getAdminContactInfo();
      setWhatsappNumber(settings.whatsapp_number || '');
      setIsWhatsappShareEnabled(settings.is_whatsapp_share_enabled || false);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "Error",
        description: "Failed to load WhatsApp settings",
        variant: "destructive"
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      await saveAdminContactInfo(
        whatsappNumber,
        isWhatsappShareEnabled,
        {
          whatsapp_number: whatsappNumber,
          is_whatsapp_share_enabled: isWhatsappShareEnabled
        }
      );
      toast({
        title: "Success",
        description: "WhatsApp settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save WhatsApp settings",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatWhatsAppNumber = (number: string) => {
    // Remove all non-digit characters
    const digits = number.replace(/\D/g, '');
    
    // Add country code if not present
    if (digits.startsWith('0')) {
      return '62' + digits.substring(1);
    }
    
    return digits;
  };

  const handleWhatsAppShare = () => {
    if (!whatsappNumber) {
      toast.error('Please set WhatsApp number first');
      return;
    }

    const formattedNumber = formatWhatsAppNumber(whatsappNumber);
    const message = encodeURIComponent('Attendance Report');
    const whatsappUrl = `https://wa.me/${formattedNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const formatTime = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    const parsedDate = typeof date === 'string' ? new Date(date) : date;
    return parsedDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatHours = (hours: number | string | undefined) => {
    if (hours === undefined) return 'N/A';
    const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
    const h = Math.floor(numHours);
    const m = Math.round((numHours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Function to trigger success animation
  const triggerSuccessAnimation = (action: string) => {
    setActionType(action);
    setShowAnimation('success');
    
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Hide animation after 2 seconds
    setTimeout(() => {
      setShowAnimation(null);
      setActionType('');
    }, 2000);
  };

  // Function to trigger error animation
  const triggerErrorAnimation = () => {
    setShowAnimation('error');
    
    // Hide animation after 2 seconds
    setTimeout(() => {
      setShowAnimation(null);
    }, 2000);
  };

  const handleScan = async (qrData: string) => {
    try {
      const parsedData = JSON.parse(qrData);
      
      if (!parsedData.id) {
        // Try legacy format
        const legacyMatch = qrData.match(/^EMP:([^:]+):(.+)$/);
        if (!legacyMatch) {
          triggerErrorAnimation();
          toast({
            variant: "destructive",
            title: "Invalid QR Code",
            description: "Please scan a valid employee QR code"
          });
          return;
        }
        parsedData.id = legacyMatch[1];
      }

      setIsLoading(true);
      const result = await markAttendance(parsedData.id);
      
      if (result.success) {
        // Show success animation with action type
        triggerSuccessAnimation(result.action);
        
        toast({
          title: "Success",
          description: result.message
        });
      } else {
        triggerErrorAnimation();
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message
        });
      }
    } catch (error) {
      console.error('Error processing scan:', error);
      triggerErrorAnimation();
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process QR code"
      });
    } finally {
      setIsLoading(false);
      // Don't stop scanning immediately to allow animation to play
      setTimeout(() => setIsScanning(false), 2000);
    }
  };

  // Helper function to perform attendance action - THIS WILL NOW ONLY BE FOR CHECK-IN VIA QR
  const performAttendanceAction = async (employeeId: string) => {
    try {
      // This function in attendanceUtils.ts should now strictly be for check-in
      const attendanceInfo = await recordAttendanceCheckIn(employeeId);
      return { ...attendanceInfo, action: 'check-in' }; // Explicitly set action as check-in
    } catch (error) {
      console.error('Attendance Action Error:', error);
      throw error;
    }
  };

  // Helper function to display success message
  const displayAttendanceSuccessMessage = async (attendanceResult: any, action: 'check-in' /* removed 'check-out' */) => {
    const { employeeName, timestamp, status, lateMinutes } = attendanceResult;

    if (action === 'check-in') {
      const lateText = lateMinutes > 0 
        ? `<p class="text-warning">You are ${lateMinutes} minutes late</p>` 
        : '<p class="text-success">You are on time!</p>';

      await Swal.fire({
        icon: 'success',
        title: 'Check-in Successful',
        html: `
          <div class="text-left">
            <p>Employee: ${employeeName}</p>
            <p>Check-in time: ${formatTime(timestamp)}</p>
            <p>Status: ${status}</p>
            ${lateText}
          </div>
        `,
        showConfirmButton: true,
        timer: 5000
      });
    } 
    // Removed the 'else' block that handled check-out messages
  };

  const handleError = (err: any) => {
    console.error('QR Scanner error:', err);
    toast.error('Error accessing camera. Please check permissions.', {
      duration: 3000,
      style: {
        background: '#ef4444',
        color: '#fff',
        padding: '16px'
      }
    });
  };

  // Modify the handleDeleteRecords function to reset dashboard count
  const handleDeleteRecords = async () => {
    if (selectedRecords.length === 0) {
      toast.error('Please select records to delete');
      return;
    }

    try {
    // Show confirmation dialog
    const confirmDelete = await Swal.fire({
      title: 'Clear Selected Attendance Records?',
      html: `
        <div class="text-center">
          <p>You are about to permanently delete <strong>${selectedRecords.length}</strong> selected attendance record(s).</p>
          <p class="text-red-600 mt-2">This action cannot be undone!</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, Clear Selected',
      cancelButtonText: 'Cancel'
    });

    // If user confirms deletion
    if (confirmDelete.isConfirmed) {
        // Show loading state
        toast.loading('Deleting records...');

        const result = await deleteAttendance(selectedRecords);
        
        if (result.success) {
          // Remove deleted records from the list
          const updatedRecords = attendanceRecords.filter(
            (record) => !selectedRecords.includes(record.id)
          );
          setAttendanceRecords(updatedRecords);
          
          // Clear selected records
          setSelectedRecords([]);
          
          toast.success(`Successfully deleted ${result.deletedCount} attendance record(s)`);

          // Refresh the records
          await fetchRecords();
        } else {
          toast.error(result.message || 'Failed to clear records');
        }
        }
      } catch (error) {
        console.error('Bulk delete error:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred while clearing records.');
    }
  };

  // Add a new function to handle individual record deletion
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
        const result = await deleteAttendanceRecord(recordId, 'complete');
        
        if (result.success) {
          await fetchRecords();
          toast.success('Record deleted successfully');
        } else {
          toast.error(result.message || 'Failed to delete record');
        }
        }
      } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    }
  };

  // Handle record selection
  const handleSelectRecord = (recordId: string) => {
    setSelectedRecords(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  // Select all records
  const handleSelectAll = () => {
    if (selectedRecords.length === attendanceRecords.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(attendanceRecords.map(record => record.id));
    }
  };

  // Enhanced filter function
  const filteredRecords = attendanceRecords.filter(record => {
    // Basic filters
    const matchesSearch = record.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = department === 'All Departments' || record.employee?.department === department;
    const recordDate = new Date(record.date);
    const matchesDateRange = 
      recordDate >= new Date(startDate) && 
      recordDate <= new Date(endDate);
    
    // Advanced filters
    const matchesStatus = 
      advancedFilters.status === 'All' || 
      record.status === advancedFilters.status;

    const workHours = parseFloat(record.workingDuration) || 0;
    const matchesMinWorkHours = 
      !advancedFilters.minWorkHours || 
      workHours >= parseFloat(advancedFilters.minWorkHours);
    
    const matchesMaxWorkHours = 
      !advancedFilters.maxWorkHours || 
      workHours <= parseFloat(advancedFilters.maxWorkHours);

    const matchesLateArrivals = 
      !advancedFilters.lateArrivals || 
      (record.lateDuration && parseInt(record.lateDuration) > 0);

    const matchesEarlyDepartures = 
      !advancedFilters.earlyDepartures || 
      record.status === 'early-departure';

    return (
      matchesSearch && 
      matchesDepartment && 
      matchesDateRange &&
      matchesStatus &&
      matchesMinWorkHours &&
      matchesMaxWorkHours &&
      matchesLateArrivals &&
      matchesEarlyDepartures
    );
  });

  // Calculate summary statistics
  const attendanceSummary = {
    total: filteredRecords.length,
    present: filteredRecords.filter(r => r.status === 'present').length,
    late: filteredRecords.filter(r => r.lateDuration && parseInt(r.lateDuration) > 0).length,
    earlyDepartures: filteredRecords.filter(r => r.status === 'early-departure').length,
    averageWorkHours: filteredRecords.length > 0 ? filteredRecords.reduce((sum, r) => sum + (parseFloat(r.workingDuration) || 0), 0) / filteredRecords.length : 0
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Employee Name', 
      'Date', 
      'Check-In Time', 
      'Check-Out Time', 
      'Status', 
      'Working Duration'
    ];
    
    const csvData = filteredRecords.map(record => [
      record.employeeName,
      record.date,
      record.checkInTime,
      record.checkOutTime || 'Not Checked Out',
      record.status,
      record.workingDuration
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_records_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF
  const handleExportPDF = () => {
    return (
      <PDFDownloadLink
        document={
          <EnhancedA4AttendanceReport
            attendanceRecords={filteredRecords}
            absentEmployees={absentEmployees}
            startDate={new Date(startDate)}
            endDate={new Date(endDate)}
          />
        }
        fileName={`attendance_report_${format(new Date(startDate), 'yyyy-MM-dd')}_to_${format(new Date(endDate), 'yyyy-MM-dd')}.pdf`}
      >
        {({ loading }) => (
          <Button
            variant="default"
            className="flex items-center gap-2"
            disabled={loading || filteredRecords.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Export to PDF
              </>
            )}
          </Button>
        )}
      </PDFDownloadLink>
    );
  };

  // Function to clear all filters and selections
  const handleClearFilters = () => {
    // Reset all filter states
    setSearchTerm('');
    setDepartment('All Departments');
    
    // Reset date to today
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    
    // Clear selected records
    setSelectedRecords([]);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {isLoading ? (
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <AttendanceTable attendanceRecords={attendanceRecords} />
      )}
    </div>
  );
} 