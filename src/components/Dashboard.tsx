import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getAttendanceRecords, getTodayAttendanceSummary } from '@/utils/attendanceUtils';
import { getAdminContactInfo, saveAdminContactInfo, autoShareAttendanceSummary } from '@/utils/adminUtils';
import { getEmployees } from '@/utils/employeeUtils';
import { User, Users, Clock, CheckCircle, UploadCloud, Share2, AlertTriangle, Calendar, TestTube, Mail, UserCheck, LogOut, UserX } from 'lucide-react';
import { Attendance, Employee, AttendanceSummary } from '@/types';
import { Button } from '@/components/ui/button';
import BulkEmployeeUpload from './BulkEmployeeUpload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 p-4">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-gray-600 mb-4">The dashboard failed to load properly.</p>
          <Button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

const Dashboard: React.FC = () => {
  // Basic state
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  
  // WhatsApp settings state
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [isWhatsappShareEnabled, setIsWhatsappShareEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  
  // Today's summary with proper typing
  const [summary, setSummary] = useState<AttendanceSummary>({
    totalEmployees: 0,
    presentCount: 0,
    lateCount: 0,
    checkedOutCount: 0,
    absentCount: 0,
    onTime: 0,
    stillWorking: 0,
    currentPresenceRate: '0.0',
    totalPresentRate: '0.0',
    presentRate: '0.0',
    onTimeRate: '0.0',
    lateRate: '0.0',
    absentRate: '0.0',
    detailed: {
      onTime: 0,
      lateArrivals: 0,
      veryLate: 0,
      halfDay: 0,
      earlyDepartures: 0,
      overtime: 0,
      regularHours: 0,
      attendanceRate: '0.0',
      efficiencyRate: '0.0',
      punctualityRate: '0.0'
    },
    presenceBreakdown: {
      currentlyPresent: 0,
      lateButPresent: 0,
      checkedOut: 0,
      onTimeArrivals: 0,
      absent: 0
    }
  });
  
  const today = new Date().toISOString().split('T')[0];
  
  // Fetch initial data with improved error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch data with individual error handling for better resilience
        const promises = [
          getAttendanceRecords().catch((error) => {
            console.error('Error fetching attendance records:', error);
            return [];
          }),
          getEmployees().catch((error) => {
            console.error('Error fetching employees:', error);
            return [];
          }),
          getAdminContactInfo().catch((error) => {
            console.error('Error fetching admin settings:', error);
            return null;
          }),
          getTodayAttendanceSummary().catch((error) => {
            console.error('Error fetching today summary:', error);
            return {
              totalEmployees: 0,
              presentCount: 0,
              lateCount: 0,
              checkedOutCount: 0,
              absentCount: 0,
              onTime: 0,
              stillWorking: 0,
              currentPresenceRate: '0.0',
              totalPresentRate: '0.0',
              presentRate: '0.0',
              onTimeRate: '0.0',
              lateRate: '0.0',
              absentRate: '0.0',
              detailed: {
                onTime: 0,
                lateArrivals: 0,
                veryLate: 0,
                halfDay: 0,
                earlyDepartures: 0,
                overtime: 0,
                regularHours: 0,
                attendanceRate: '0.0',
                efficiencyRate: '0.0',
                punctualityRate: '0.0'
              },
              presenceBreakdown: {
                currentlyPresent: 0,
                lateButPresent: 0,
                checkedOut: 0,
                onTimeArrivals: 0,
                absent: 0
              }
            };
          })
        ];
        
        const [attendanceData, employeesData, adminSettings, todaySummary] = await Promise.all(promises);
        
        setAttendanceRecords(attendanceData || []);
        setEmployees(employeesData || []);
        setSummary(todaySummary);
        
        // Set WhatsApp settings
        if (adminSettings) {
          setWhatsappNumber(adminSettings.whatsapp_number || '');
          setIsWhatsappShareEnabled(adminSettings.is_whatsapp_share_enabled || false);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load some dashboard data. Some features may be limited.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Refresh data every 30 seconds for more real-time updates
    const intervalId = setInterval(fetchData, 30 * 1000);
    return () => clearInterval(intervalId);
  }, []);
  
  // Calculate stats from attendance records with proper fallbacks
  const stats = React.useMemo(() => {
    if (!summary) {
      return {
        totalEmployees: 0,
        present: 0,
        late: 0,
        absent: 0,
        checkedOut: 0,
        onTime: 0,
        stillWorking: 0,
        lateRate: '0.0',
        absentRate: '0.0',
        presentRate: '0.0'
      };
    }

    return {
      totalEmployees: summary.totalEmployees || 0,
      present: summary.presentCount || 0,
      late: summary.lateCount || 0,
      absent: summary.absentCount || 0,
      checkedOut: summary.checkedOutCount || 0,
      onTime: summary.onTime || 0,
      stillWorking: summary.stillWorking || 0,
      lateRate: summary.lateRate || '0.0',
      absentRate: summary.absentRate || '0.0',
      presentRate: summary.presentRate || summary.totalPresentRate || '0.0'
    };
  }, [summary]);

  // Format WhatsApp number
  const formatWhatsAppNumber = (number: string): string => {
    let formatted = number.replace(/\D/g, '');
    if (formatted.startsWith('0')) {
      formatted = '94' + formatted.substring(1);
    } else if (!formatted.startsWith('94')) {
      formatted = '94' + formatted;
    }
    return formatted;
  };

  // Handle saving WhatsApp settings
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      if (isWhatsappShareEnabled && !whatsappNumber) {
        toast({
          title: 'Validation Error',
          description: 'Please add a WhatsApp number',
          variant: 'destructive',
        });
        return;
      }

      const formatted = formatWhatsAppNumber(whatsappNumber);
      if (formatted.length < 11) {
        toast({
          title: 'Validation Error',
          description: 'Please enter a valid WhatsApp number (minimum 11 digits)',
          variant: 'destructive',
        });
        return;
      }

      const info = {
        whatsappNumber: formatted,
        isWhatsappShareEnabled
      };
      
      await saveAdminContactInfo(formatted, isWhatsappShareEnabled, info);
      
      toast({
        title: 'Success',
        description: 'Settings saved successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle WhatsApp sharing
  const handleShareNow = async () => {
    if (!whatsappNumber) {
      toast({
        title: 'Validation Error',
        description: 'Please add a WhatsApp number',
        variant: 'destructive',
      });
      return;
    }

    setIsSharing(true);
    try {
      const whatsappUrl = await autoShareAttendanceSummary();
      
      if (whatsappUrl) {
        // Open the WhatsApp URL in a new window
        window.open(whatsappUrl, '_blank');
        toast({
          title: 'Success',
          description: 'Opening WhatsApp to share the report...',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to share report. Please check your settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error sharing report:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred while sharing',
        variant: 'destructive',
      });
    } finally {
      setTimeout(() => setIsSharing(false), 1000);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleBulkUploadComplete = () => {
    setShowBulkUpload(false);
  };

  if (showBulkUpload) {
    return <BulkEmployeeUpload onComplete={handleBulkUploadComplete} />;
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-4">
        <Tabs defaultValue="overview" onValueChange={(value) => setActiveTab(value as 'overview' | 'settings')}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
            <h2 className="text-2xl font-semibold">{activeTab === 'overview' ? 'Dashboard Overview' : 'WhatsApp Report Settings'}</h2>
            <div className="flex flex-wrap gap-2">
              <TabsList className="bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
                <TabsTrigger value="settings" className="text-xs sm:text-sm">WhatsApp Settings</TabsTrigger>
              </TabsList>
              <Button 
                onClick={() => setShowBulkUpload(true)}
                className="flex items-center gap-1 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md transition-all duration-300"
                size="sm"
              >
                <UploadCloud size={16} />
                <span className="text-xs sm:text-sm">Bulk Import</span>
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalEmployees}</div>
                  <p className="text-xs text-muted-foreground">Active employees in system</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {((summary?.presentCount || 0) + (summary?.checkedOutCount || 0))}
                  </div>
                  {summary?.totalEmployees > 0 && (
                    <p className="text-xs text-green-600">
                      Present Rate: {summary?.totalPresentRate || '0'}%
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.checkedOutCount}</div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Still Working: {summary.stillWorking}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
                  <UserX className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.absentCount}</div>
                  <div className="space-y-1">
                    <p className="text-xs text-red-600">
                      Absence Rate: {summary.absentRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Out of {summary.totalEmployees} total employees
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <Card className="border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-300">
                    <UserCheck size={16} className="text-green-500" />
                    Present Employees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">
                    {((summary?.presentCount || 0) + (summary?.checkedOutCount || 0))}
                  </div>
                  <p className="text-xs text-green-600/80 dark:text-green-400/80">
                    {summary?.totalEmployees > 0
                      ? `${summary?.totalPresentRate || '0'}% present today`
                      : 'No employees in the system'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <Card className="border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-300">
                    <AlertTriangle size={16} className="text-red-500" />
                    Absent Employees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">{summary.absentCount}</div>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80">
                    {summary.totalEmployees > 0
                      ? `${summary.absentRate}% absence rate today (${summary.absentCount} out of ${summary.totalEmployees} employees)`
                      : 'No employees in the system'}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            {isSharing && (
              <Alert className="mb-4">
                <Share2 className="h-4 w-4" />
                <AlertTitle>Sharing in progress</AlertTitle>
                <AlertDescription>Opening WhatsApp to share the attendance report...</AlertDescription>
              </Alert>
            )}
            
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-800/30 border-none shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="h-5 w-5 text-green-600" />
                  WhatsApp Attendance Reports
                </CardTitle>
                <CardDescription>
                  Configure super admin WhatsApp number for attendance reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="whatsapp-share"
                      checked={isWhatsappShareEnabled}
                      onCheckedChange={setIsWhatsappShareEnabled}
                    />
                    <Label htmlFor="whatsapp-share" className="font-medium">
                      Enable WhatsApp Sharing
                    </Label>
                  </div>

                  {isWhatsappShareEnabled && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>WhatsApp Number</Label>
                        <div className="relative">
                          <Input
                            type="tel"
                            value={whatsappNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 15) {
                                setWhatsappNumber(value);
                              }
                            }}
                            placeholder="Enter WhatsApp number (e.g., 0741233252)"
                            className="pl-8"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            +
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          Enter number with or without country code (e.g., 0741233252 or 94741233252)
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                          onClick={handleSaveSettings}
                          disabled={isSaving || !whatsappNumber}
                          className={cn(
                            "flex-1 transition-all duration-200",
                            isSaving 
                              ? "bg-gray-400"
                              : "bg-green-600 hover:bg-green-700"
                          )}
                        >
                          {isSaving ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Saving...
                            </>
                          ) : (
                            'Save Settings'
                          )}
                        </Button>
                        {whatsappNumber && (
                          <Button
                            variant="outline"
                            onClick={handleShareNow}
                            disabled={isSharing}
                            className="flex-1 border-green-600 text-green-600 hover:bg-green-50 flex items-center justify-center gap-2"
                          >
                            <Share2 className="h-4 w-4" />
                            {isSharing ? 'Opening WhatsApp...' : 'Share Now'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium mb-2">About WhatsApp Reports</h3>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-green-600 mt-0.5" />
                      <p>Daily attendance summary will be shared at 6:00 PM</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                      <p>The summary includes late arrivals, check-ins, and check-outs</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-green-600 mt-0.5" />
                      <p>Reports show detailed statistics of employee attendance</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-green-600 mt-0.5" />
                      <p>Get insights into late arrivals and absence rates</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
};

export default Dashboard;
