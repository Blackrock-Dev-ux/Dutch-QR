import React, { useState, useEffect } from 'react';
import { QrCode, Check, X, Clipboard, Download, AlertTriangle, Search, RefreshCw, Clock, Timer, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Employee, GatePass as GatePassType } from '@/types/index';
import { getEmployees } from '@/utils/employeeUtils';
import { 
  getGatePasses,
  createGatePass,
  verifyGatePass,
  generateGatePassImage,
  recordGatePassUsage,
  deleteGatePass
} from '@/utils/gatePassUtils';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Skeleton } from '@/components/ui/skeleton';
import { TimeSelector } from '@/components/TimeSelector';

interface ActiveGatePass {
  endTime: string;
  passCode: string;
  employeeName: string;
}

const GatePass: React.FC = () => {
  // State management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [gatePasses, setGatePasses] = useState<GatePassType[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [passType, setPassType] = useState<'entry' | 'exit' | 'both'>('both');
  const [passValidity, setPassValidity] = useState<'single' | 'day' | 'week' | 'month' | 'custom'>('single');
  const [passReason, setPassReason] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('create');
  const [passCode, setPassCode] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<{
    verified: boolean;
    message: string;
    pass?: any;
  } | null>(null);
  
  // Time tracking states
  const [expectedExitTime, setExpectedExitTime] = useState<string>(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [expectedReturnTime, setExpectedReturnTime] = useState<string>(
    new Date(Date.now() + 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [usageType, setUsageType] = useState<'exit' | 'return'>('exit');
  
  // Loading and operation states
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [countdownEnd, setCountdownEnd] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [activePass, setActivePass] = useState<ActiveGatePass | null>(null);
  
  // Add new state for custom validity
  const [customValidityHours, setCustomValidityHours] = useState<number>(1);
  const [customValidityMinutes, setCustomValidityMinutes] = useState<number>(0);
  const [isCustomValidity, setIsCustomValidity] = useState<boolean>(false);
  
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Fetch employees and gate passes on component mount or refresh
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch employees
        const employeesData = await getEmployees();
        setEmployees(employeesData);
        
        // Fetch gate passes with console logging for debugging
        console.log('Fetching gate passes...');
        const passesData = await getGatePasses();
        console.log('Fetched gate passes:', passesData);
        setGatePasses(passesData || []); // Ensure we always set an array
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load data',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    fetchData();
  }, [toast, refreshTrigger]);

  // Load active gate pass from localStorage on mount
  useEffect(() => {
    const savedPass = localStorage.getItem('activeGatePass');
    if (savedPass) {
      const pass = JSON.parse(savedPass);
      const endTime = new Date(pass.endTime);
      
      // Only restore if the pass hasn't expired
      if (endTime > new Date()) {
        setActivePass(pass);
        setCountdownEnd(endTime);
      } else {
        // Clear expired pass
        localStorage.removeItem('activeGatePass');
      }
    }
  }, []);

  // Countdown timer effect with localStorage persistence
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (countdownEnd) {
      intervalId = setInterval(() => {
        const now = new Date();
        const diff = Math.max(0, Math.floor((countdownEnd.getTime() - now.getTime()) / 1000));
        
        if (diff === 0) {
          clearInterval(intervalId);
          toast({
            title: 'Gate Pass Expired',
            description: 'The gate pass has expired.',
            variant: 'destructive',
          });
          // Keep the display but update the state
          setRemainingTime('EXPIRED');
        } else {
          setRemainingTime(formatTime(diff));
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [countdownEnd]);

  // Function to format time in a user-friendly way
  const formatTime = (timeInSeconds: number): string => {
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;

    let timeString = '';
    if (hours > 0) {
      timeString += `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    if (minutes > 0) {
      timeString += `${timeString ? ' ' : ''}${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }
    if (seconds > 0 || timeString === '') {
      timeString += `${timeString ? ' ' : ''}${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
    }
    return timeString;
  };

  // Modify getValidityText function
  const getValidityText = (validity: string): string => {
    if (validity === 'custom') {
      const hours = customValidityHours;
      const minutes = customValidityMinutes;
      let text = '';
      if (hours > 0) text += `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
      if (minutes > 0) text += `${text ? ' and ' : ''}${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
      return text || '0 minutes';
    }

    switch (validity) {
      case 'single':
        return '24 hours';
      case 'day':
        return '1 day (until midnight)';
      case 'week':
        return '7 days';
      case 'month':
        return '30 days';
      default:
        return '';
    }
  };

  // Function to download gate pass image
  const handleDownloadGatePass = async (pass: any) => {
    try {
      setIsDownloading(true);
      const imageBlob = await generateGatePassImage(pass);
      
      if (imageBlob) {
        // Create download link
        const url = URL.createObjectURL(imageBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `gate_pass_${pass.passCode}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        toast({
          title: 'Gate Pass Downloaded',
          description: 'Your gate pass has been downloaded successfully',
        });
      } else {
        throw new Error('Failed to generate gate pass');
      }
    } catch (error) {
      console.error('Error downloading gate pass:', error);
      toast({
        title: 'Error',
        description: 'Failed to download gate pass',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Modify handleCreateGatePass
  const handleCreateGatePass = async () => {
    if (!selectedEmployee || !passReason) {
      toast({
        title: 'Missing Information',
        description: 'Please select an employee and provide a reason',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);
      
      // Calculate custom validity if needed
      let validity = passValidity;
      if (passValidity === 'custom') {
        // For custom validity, we'll use 'single' but calculate the expiration differently
        validity = 'single';
      }
      
      const newPass = await createGatePass(
        selectedEmployee,
        validity as 'single' | 'day' | 'week' | 'month',
        passType,
        passReason,
        expectedExitTime,
        expectedReturnTime
      );
      
      if (newPass) {
        // Set countdown end time based on pass validity
        const now = new Date();
        let endTime: Date;
        
        if (passValidity === 'custom') {
          // For custom validity, calculate exact hours and minutes
          const totalMilliseconds = 
            (customValidityHours * 60 * 60 * 1000) + 
            (customValidityMinutes * 60 * 1000);
          endTime = new Date(now.getTime() + totalMilliseconds);
        } else {
          // For predefined periods, use the expiration date from the pass
          endTime = new Date(newPass.expiresAt);
        }
        
        // Save active pass to localStorage
        const activePassData = {
          endTime: endTime.toISOString(),
          passCode: newPass.passCode,
          employeeName: newPass.employeeName
        };
        localStorage.setItem('activeGatePass', JSON.stringify(activePassData));
        setActivePass(activePassData);
        setCountdownEnd(endTime);
        
        // Download gate pass image automatically
        await handleDownloadGatePass(newPass);
        
        // Show success toast
        toast({
          title: 'Gate Pass Created Successfully',
          description: `Pass code: ${newPass.passCode} - Valid until ${endTime.toLocaleString()}`,
          variant: 'default',
          duration: 5000,
        });

        // Refresh the gate passes list
        setRefreshTrigger(prev => prev + 1);

        // Reset form
        setSelectedEmployee('');
        setPassReason('');
        setPassType('both');
        setPassValidity('single');
        setCustomValidityHours(1);
        setCustomValidityMinutes(0);
        setIsCustomValidity(false);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to create gate pass. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating gate pass:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Verify gate pass by code
  const handleVerifyPass = async (codeToVerify = passCode) => {
    if (!codeToVerify || codeToVerify.trim() === '') {
      toast({
        title: 'Error',
        description: 'Please enter a pass code to verify',
        variant: 'destructive',
      });
      return;
    }
    
    setIsVerifying(true);
    
    try {
      console.log("Verifying pass with code:", codeToVerify);
      const verification = await verifyGatePass(codeToVerify);
      console.log("Verification result:", verification);
      
      setVerificationResult(verification);
      
      // Show the alert regardless of verification result
      setShowAlert(true);
      
      // If the pass was updated, refresh the gate passes list
      if (verification.pass && 
         (verification.verified || 
          verification.pass.status === 'expired' || 
          verification.pass.status === 'used')) {
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error verifying gate pass:', error);
      setVerificationResult({
        verified: false,
        message: 'Error verifying pass. Please try again.',
      });
      // Show error alert
      setShowAlert(true);
    } finally {
      setIsVerifying(false);
    }
  };

  // Record gate pass usage (exit or return)
  const handleRecordUsage = async (pass: any, type: 'exit' | 'return') => {
    try {
      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const result = await recordGatePassUsage(pass.id, type, currentTime);
      
      if (result.success) {
        toast({
          title: type === 'exit' ? 'Exit Recorded' : 'Return Recorded',
          description: `Time: ${currentTime}`,
        });
        
        // Refresh gate passes list
        setRefreshTrigger(prev => prev + 1);
        
        // Update verification result
        if (verificationResult?.pass) {
          const updatedPass = {
            ...verificationResult.pass,
            ...(type === 'exit' ? { exitTime: currentTime } : { returnTime: currentTime })
          };
          setVerificationResult({
            ...verificationResult,
            pass: updatedPass
          });
        }
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to record usage',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(`Error recording ${type}:`, error);
      toast({
        title: 'Error',
        description: `Failed to record ${type}`,
        variant: 'destructive',
      });
    }
  };

  // Copy pass details to clipboard
  const copyPassToClipboard = (pass: any) => {
    const passText = `Gate Pass: ${pass.passCode}
Employee: ${pass.employeeName}
Type: ${pass.type}
Validity: ${pass.validity}
Reason: ${pass.reason}
Expected Exit: ${pass.expectedExitTime || 'Not specified'}
Expected Return: ${pass.expectedReturnTime || 'Not specified'}
Expires: ${new Date(pass.expiresAt).toLocaleString()}`;

    navigator.clipboard.writeText(passText).then(
      () => {
        toast({
          title: 'Copied',
          description: 'Gate pass details copied to clipboard',
        });
      },
      (err) => {
        console.error('Could not copy text: ', err);
        toast({
          title: 'Error',
          description: 'Failed to copy to clipboard',
          variant: 'destructive',
        });
      }
    );
  };

  // Function to get appropriate badge color based on status
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'used':
        return 'bg-blue-100 text-blue-800';
      case 'expired':
        return 'bg-orange-100 text-orange-800';
      case 'revoked':
        return 'bg-red-100 text-red-800';
      default:
        return '';
    }
  };

  // Handle manual refresh of gate passes
  const handleRefreshPasses = () => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: 'Refreshing',
      description: 'Updating gate pass data...',
    });
  };

  // Add handleDeletePass function
  const handleDeletePass = async (passId: string) => {
    if (!passId) return;

    try {
      setIsDeleting(passId);
      const result = await deleteGatePass(passId);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Gate pass deleted successfully',
        });
        // Refresh the list
        setRefreshTrigger(prev => prev + 1);
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to delete gate pass',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting gate pass:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete gate pass',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Gate Pass System</h1>
            <p className="text-muted-foreground">
              Create and manage temporary access passes for employees
            </p>
          </div>
          <TabsList className="mt-4 md:mt-0">
            <TabsTrigger value="create">Create Pass</TabsTrigger>
            <TabsTrigger value="passes">All Passes</TabsTrigger>
          </TabsList>
        </div>
        
        {/* Create Pass Tab */}
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create New Gate Pass</CardTitle>
              <CardDescription>
                Generate a temporary access pass for employees
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Employee Selection */}
              <div className="space-y-2">
                <Label htmlFor="employee">Employee</Label>
                {loading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <select 
                    id="employee"
                    className="w-full border rounded-md p-2"
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    disabled={isCreating}
                    aria-label="Select employee"
                  >
                    <option value="">Select an employee</option>
                    {employees.map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {/* Pass Type */}
              <div className="space-y-2">
                <Label htmlFor="pass-type">Pass Type</Label>
                <select 
                  id="pass-type"
                  className="w-full border rounded-md p-2"
                  value={passType}
                  onChange={(e) => setPassType(e.target.value as 'entry' | 'exit' | 'both')}
                  disabled={isCreating}
                  aria-label="Select pass type"
                >
                  <option value="entry">Entry Only</option>
                  <option value="exit">Exit Only</option>
                  <option value="both">Entry & Exit</option>
                </select>
              </div>
              
              {/* Pass Validity */}
              <div className="space-y-2">
                <Label htmlFor="pass-validity">Validity Period</Label>
                <select 
                  id="pass-validity"
                  className="w-full border rounded-md p-2"
                  value={passValidity}
                  onChange={(e) => {
                    setPassValidity(e.target.value as 'single' | 'day' | 'week' | 'month' | 'custom');
                    setIsCustomValidity(e.target.value === 'custom');
                  }}
                  disabled={isCreating}
                  aria-label="Select validity period"
                >
                  <option value="single">Single Use (24 hours)</option>
                  <option value="day">One Day (until midnight)</option>
                  <option value="week">One Week</option>
                  <option value="month">One Month</option>
                  <option value="custom">Custom Duration</option>
                </select>

                {/* Custom Validity Input */}
                {isCustomValidity && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="validity-hours">Hours</Label>
                        <Input
                          id="validity-hours"
                          type="number"
                          min="0"
                          max="720"
                          value={customValidityHours}
                          onChange={(e) => setCustomValidityHours(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="Hours"
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="validity-minutes">Minutes</Label>
                        <Input
                          id="validity-minutes"
                          type="number"
                          min="0"
                          max="59"
                          value={customValidityMinutes}
                          onChange={(e) => setCustomValidityMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="Minutes"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Gate pass will be valid for {getValidityText('custom')}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Time Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expected-exit">Expected Exit Time</Label>
                  <TimeSelector 
                    id="expected-exit"
                    value={expectedExitTime}
                    onChange={setExpectedExitTime}
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expected-return">Expected Return Time</Label>
                  <TimeSelector 
                    id="expected-return"
                    value={expectedReturnTime}
                    onChange={setExpectedReturnTime}
                    disabled={isCreating}
                  />
                </div>
              </div>
              
              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  placeholder="Reason for gate pass"
                  value={passReason}
                  onChange={(e) => setPassReason(e.target.value)}
                  disabled={isCreating}
                />
              </div>

              {/* Active Pass Display */}
              {(countdownEnd || activePass) && (
                <div className={`mt-6 p-4 rounded-lg border ${
                  remainingTime === 'EXPIRED' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                }`}>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      {remainingTime === 'EXPIRED' ? (
                        <>
                          <X className="h-6 w-6 text-red-600 mr-2" />
                          <h3 className="text-lg font-semibold text-red-800">Gate Pass Expired</h3>
                        </>
                      ) : (
                        <>
                          <Check className="h-6 w-6 text-green-600 mr-2" />
                          <h3 className="text-lg font-semibold text-green-800">Gate Pass Active</h3>
                        </>
                      )}
                    </div>
                    {activePass && (
                      <div className="mb-4">
                        <p className={`text-sm font-medium ${
                          remainingTime === 'EXPIRED' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          Pass Code: {activePass.passCode}
                        </p>
                        <p className={`text-sm ${
                          remainingTime === 'EXPIRED' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          Employee: {activePass.employeeName}
                        </p>
                        <p className={`text-sm ${
                          remainingTime === 'EXPIRED' ? 'text-red-600' : 'text-green-600'
                        } mt-1`}>
                          Validity Period: {getValidityText(passValidity)}
                        </p>
                      </div>
                    )}
                    <div className={`bg-white p-4 rounded-lg shadow-sm ${
                      remainingTime === 'EXPIRED' ? 'bg-red-50' : ''
                    }`}>
                      <p className="text-sm text-gray-600 mb-1">Time Status</p>
                      <div className={`text-2xl font-mono font-bold mb-1 ${
                        remainingTime === 'EXPIRED' ? 'text-red-700' : 'text-green-700'
                      }`}>
                        {remainingTime}
                      </div>
                      <div className="text-sm text-gray-500">
                        Created: {new Date().toLocaleString()}<br />
                        Expires: {countdownEnd?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleCreateGatePass}
                disabled={!selectedEmployee || !passReason || isCreating}
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-b-2 border-white rounded-full"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate Gate Pass
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        {/* All Passes Tab */}
        <TabsContent value="passes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>All Gate Passes</CardTitle>
                <CardDescription>
                  View and manage all issued gate passes
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshPasses}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pass Code</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Exit Time</TableHead>
                        <TableHead>Return Time</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(gatePasses) && gatePasses.length > 0 ? (
                        gatePasses.map((pass: GatePassType) => (
                          <TableRow key={pass.id}>
                            <TableCell className="font-medium font-mono">
                              {pass.passCode}
                            </TableCell>
                            <TableCell>{pass.employeeName}</TableCell>
                            <TableCell className="capitalize">{pass.type}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusBadgeClass(pass.status)}>
                                {pass.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {pass.exitTime || pass.expectedExitTime || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {pass.returnTime || pass.expectedReturnTime || 'N/A'}
                            </TableCell>
                            <TableCell>
                              {new Date(pass.expiresAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => copyPassToClipboard(pass)}
                                  title="Copy pass details"
                                >
                                  <Clipboard className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadGatePass(pass)}
                                  disabled={isDownloading}
                                >
                                  {isDownloading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                  <span className="ml-2">Download</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeletePass(pass.id)}
                                  disabled={isDeleting === pass.id}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  {isDeleting === pass.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                            {loading ? (
                              'Loading gate passes...'
                            ) : (
                              <>
                                <div className="flex items-center justify-center mb-2">
                                  <AlertTriangle className="h-5 w-5 text-muted-foreground mr-2" />
                                  No gate passes found
                                </div>
                                <p className="text-sm">Create a new gate pass to see it here</p>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GatePass;
