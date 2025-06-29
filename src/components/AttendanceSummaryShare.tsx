import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { toast as sonnerToast } from "sonner";
import { Attendance } from '@/types';
import { 
  getAttendanceRecords, 
  getAdminContactInfo,
  saveAdminContactInfo,
  autoShareAttendanceSummary,
  getTodayAttendanceSummary
} from '@/utils/attendanceUtils';
import { getEmployees } from '@/utils/employeeUtils';
import { 
  CalendarIcon, 
  Send, 
  MessageSquare, 
  Clock, 
  Save, 
  Check, 
  AlertTriangle, 
  Share2, 
  Settings,
  Eye,
  RefreshCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from "@/components/ui/scroll-area";

// Add WhatsApp icon component
const WhatsAppIcon = () => (
  <svg 
    viewBox="0 0 24 24" 
    className="h-5 w-5"
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const AttendanceSummaryShare: React.FC = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappShareEnabled, setWhatsappShareEnabled] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('whatsapp');
  const { toast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const records = await getAttendanceRecords();
        // Filter for selected date
        const dateStr = format(date, 'yyyy-MM-dd');
        const filtered = records.filter(record => record.date === dateStr);
        setAttendanceRecords(filtered);
      } catch (error) {
        console.error('Error fetching attendance:', error);
        toast({
          title: 'Error',
          description: 'Failed to load attendance records',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [date, toast]);

  useEffect(() => {
    // Load admin contact information
    const loadAdminContactInfo = async () => {
      try {
        const contactInfo = await getAdminContactInfo();
        setWhatsappNumber(contactInfo.whatsappNumber || '');
        setWhatsappShareEnabled(contactInfo.isWhatsappShareEnabled || false);
      } catch (error) {
        console.error('Error loading admin contact info:', error);
        toast({
          title: 'Error',
          description: 'Failed to load sharing settings',
          variant: 'destructive'
        });
      }
    };

    loadAdminContactInfo();
  }, [toast]);

  // Setup auto-sharing interval checker
  useEffect(() => {
    // Check every 5 minutes if it's time to send the report
    const intervalId = setInterval(() => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Send report at 6 PM (18:00)
      if (hour === 18 && minute >= 0 && minute < 5) {
        if (whatsappShareEnabled && whatsappNumber) {
          autoShareAttendanceSummary()
            .then(success => {
              if (success) {
                sonnerToast.success('Auto-Share Success', {
                  description: 'Attendance summary automatically shared',
                });
              }
            })
            .catch(err => {
              console.error('Error in auto-sharing:', err);
              sonnerToast.error('Auto-Share Failed', {
                description: 'Could not send attendance summary automatically',
              });
            });
        }
      }
      
      // Set a reminder at 5 PM if auto-share is enabled
      if (hour === 17 && minute >= 0 && minute < 5 && !reminderSet) {
        if (whatsappShareEnabled && whatsappNumber) {
          sonnerToast('Auto-Share Reminder', {
            description: 'Daily attendance report will be automatically shared in 1 hour',
            duration: 10000,
          });
          setReminderSet(true);
          
          // Reset the reminder flag after 10 minutes
          setTimeout(() => setReminderSet(false), 10 * 60 * 1000);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(intervalId);
  }, [whatsappShareEnabled, whatsappNumber, reminderSet]);

  const validateAndFormatNumber = (number: string): string | null => {
    // Remove all non-digits
    const cleaned = number.trim().replace(/[^0-9]/g, '');
    
    // Must be at least 9 digits (without country code)
    if (cleaned.length < 9) return null;
    
    // Format with country code
    if (cleaned.startsWith('94') && cleaned.length >= 11) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '94' + cleaned.substring(1);
    } else if (!cleaned.startsWith('94')) {
      return '94' + cleaned;
    }
    return cleaned;
  };

  const checkWhatsAppWebAccess = async (): Promise<boolean> => {
    try {
      const response = await fetch('https://web.whatsapp.com', {
        method: 'HEAD',
        mode: 'no-cors'
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const generateDailySummary = async () => {
    try {
      const summary = await getTodayAttendanceSummary();
      if (!summary) {
        throw new Error('No attendance data available');
      }
      
      const dateStr = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = `🏢 *DAILY ATTENDANCE REPORT*\n` +
        `───────────────────\n` +
        `📅 Date: ${dateStr}\n` +
        `───────────────────\n\n` +
        `📊 *SUMMARY*\n` +
        `• Total Employees: ${summary.totalEmployees}\n` +
        `• Present: ${summary.presentCount} ✅\n` +
        `• Late: ${summary.lateCount} ⏰\n` +
        `• Absent: ${summary.absentCount} ❌\n` +
        `• Checked Out: ${summary.checkedOutCount} 🏃\n\n` +
        `📈 *DETAILED STATUS*\n` +
        `• Working Overtime: ${summary.detailed.overtime || 0} 💪\n` +
        `• Half Day: ${summary.detailed.halfDay || 0} 📅\n` +
        `• Early Departures: ${summary.detailed.earlyDepartures || 0} 🚶\n` +
        `• Very Late: ${summary.detailed.veryLate || 0} ⚠️\n\n` +
        `📊 *STATISTICS*\n` +
        `• Present Rate: ${summary.totalPresentRate}%\n` +
        `• Late Rate: ${summary.lateRate}%\n` +
        `• Absence Rate: ${summary.absentRate}%\n` +
        `• Efficiency Rate: ${summary.detailed.efficiencyRate}%\n\n` +
        `👥 *CURRENT STATUS*\n` +
        `• Still Working: ${summary.stillWorking}\n` +
        `• Checked Out: ${summary.checkedOutCount}\n\n` +
        `Generated by QR Check-In System\n` +
        `Time: ${format(new Date(), 'hh:mm a')}\n` +
        `───────────────────`;

      setSummaryPreview(message);
      return message;
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  };

  const refreshSummary = async () => {
    setIsRefreshing(true);
    try {
      await generateDailySummary();
      toast({
        title: 'Summary Updated',
        description: 'The attendance summary has been refreshed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh summary. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    generateDailySummary().catch(console.error);
  }, []);

  const handleShare = async () => {
    if (!whatsappNumber) {
      toast({
        title: 'Missing Information',
        description: 'Please enter WhatsApp numbers',
        variant: 'destructive'
      });
      return;
    }

    setIsSharing(true);
    try {
      // Debug log
      console.log('Starting share process with numbers:', whatsappNumber);

      // Clean and format numbers
      const numbers = whatsappNumber
        .split('|')
        .map(num => num.trim())
        .filter(Boolean)
        .map(num => {
          const cleaned = num.replace(/\D/g, '');
          // Ensure proper country code
          if (cleaned.startsWith('94')) {
            return cleaned;
          } else if (cleaned.startsWith('0')) {
            return '94' + cleaned.substring(1);
          }
          return '94' + cleaned;
        })
        .filter(num => num.length >= 11);

      console.log('Formatted numbers:', numbers);

      if (numbers.length === 0) {
        throw new Error('Please enter valid WhatsApp numbers (e.g., 94XXXXXXXXX or 0XXXXXXXXX)');
      }

      // Get summary
      console.log('Fetching attendance summary...');
      const summary = await getTodayAttendanceSummary();
      if (!summary) {
        throw new Error('Failed to generate attendance summary - No data available');
      }
      console.log('Summary fetched successfully:', summary);

      const dateStr = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Create message with minimal formatting
      const message = `🏢 *DAILY ATTENDANCE REPORT*\n` +
        `───────────────────\n` +
        `📅 Date: ${dateStr}\n` +
        `───────────────────\n\n` +
        `📊 *SUMMARY*\n` +
        `• Total Employees: ${summary.totalEmployees}\n` +
        `• Currently Present: ${summary.presentCount} 👥\n` +
        `• Late but Present: ${summary.lateCount} ⏰\n` +
        `• Absent: ${summary.absentCount} ❌\n` +
        `• Checked Out: ${summary.checkedOutCount} 🏃\n\n` +
        `📈 *DETAILED STATUS*\n` +
        `• Working Overtime: ${summary.detailed?.overtime || 0} 💪\n` +
        `• Half Day: ${summary.detailed?.halfDay || 0} 📅\n` +
        `• Early Departures: ${summary.detailed?.earlyDepartures || 0} 🚶\n` +
        `• Very Late: ${summary.detailed?.veryLate || 0} ⚠️\n\n` +
        `📊 *STATISTICS*\n` +
        `• Present Rate: ${summary.totalPresentRate}%\n` +
        `• Late Rate: ${summary.lateRate}%\n` +
        `• Absence Rate: ${summary.absentRate}%\n` +
        `• Efficiency Rate: ${summary.detailed?.efficiencyRate || '0'}%\n\n` +
        `👥 *CURRENT STATUS*\n` +
        `• Still Working: ${summary.stillWorking}\n` +
        `• Checked Out: ${summary.checkedOutCount}`;

      console.log('Message prepared:', message);

      // Try sharing with each number
      let successCount = 0;
      const errors = [];

      for (const number of numbers) {
        try {
          console.log(`Attempting to share with number: ${number}`);
          
          // Try direct WhatsApp API first
          const encodedMessage = encodeURIComponent(message);
          let url = `https://wa.me/${number}?text=${encodedMessage}`;
          
          console.log('Opening URL:', url);
          let win = window.open(url, '_blank');
          
          if (!win) {
            console.log('First attempt failed, trying alternative URL...');
            // If first attempt fails, try alternative URL
            url = `https://api.whatsapp.com/send?phone=${number}&text=${encodedMessage}`;
            win = window.open(url, '_blank');
          }

          if (win) {
            console.log(`Successfully opened WhatsApp for number: ${number}`);
            successCount++;
            // Add small delay between multiple numbers
            if (numbers.length > 1 && successCount < numbers.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            throw new Error('Pop-up blocked');
          }
        } catch (error: any) {
          console.error(`Error sharing to ${number}:`, error);
          const errorMessage = typeof error === 'object' && error !== null && 'message' in error
            ? error.message
            : 'Unknown error';
          errors.push(`Failed to share to ${number}: ${errorMessage}`);
        }
      }

      if (successCount > 0) {
        console.log(`Successfully shared with ${successCount} numbers`);
        // Save only if at least one share was successful
        const formattedNumbers = numbers.join(' | ');
        try {
          await saveAdminContactInfo(
            formattedNumbers,
            whatsappShareEnabled,
            {
              whatsappNumber: formattedNumbers,
              isWhatsappShareEnabled: whatsappShareEnabled
            }
          );

          toast({
            title: 'Success',
            description: `Report shared with ${successCount} number${successCount > 1 ? 's' : ''}`,
          });
        } catch (error) {
          console.error('Error saving settings:', error);
          toast({
            title: 'Partial Success',
            description: 'Report shared but failed to save settings',
            variant: 'default'
          });
        }
      } else {
        console.error('Share failed. Collected errors:', errors);
        if (errors.length > 0) {
          throw new Error(`Sharing failed: ${errors[0]}`);
        } else {
          throw new Error('Failed to share report. Please ensure pop-ups are enabled and try again.');
        }
      }

    } catch (error) {
      console.error('Share process error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error 
          ? error.message 
          : 'Failed to share report. Please check your WhatsApp settings and try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSharing(false);
    }
  };

  // Update the input field to handle multiple numbers
  const handleNumberInput = (value: string) => {
    // Allow only numbers, spaces, plus signs, and pipe symbols
    const cleaned = value.replace(/[^0-9\s+|]/g, '');
    setWhatsappNumber(cleaned);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      if (whatsappShareEnabled && !whatsappNumber.trim()) {
        throw new Error('Please enter WhatsApp number(s) before enabling auto-share');
      }

      // Clean and validate numbers
      const numbers = whatsappNumber
        .split('|')
        .map(num => num.trim())
        .filter(Boolean)
        .map(num => {
          const cleaned = num.replace(/\D/g, '');
          if (cleaned.startsWith('94') && cleaned.length >= 11) {
            return cleaned;
          } else if (cleaned.startsWith('0')) {
            return '94' + cleaned.substring(1);
          }
          return '94' + cleaned;
        })
        .filter(num => num.length >= 11);

      const formattedNumbers = numbers.join(' | ');
      
      // Create settings object
      const settings = {
        whatsappNumber: formattedNumbers,
        isWhatsappShareEnabled: whatsappShareEnabled
      };

      // Save settings
      await saveAdminContactInfo(
        formattedNumbers,
        whatsappShareEnabled,
        settings
      );

      setSettingsSaved(true);
      toast({
        title: 'Settings Saved',
        description: 'WhatsApp sharing settings updated successfully',
      });

      // Reset saved status after 3 seconds
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save WhatsApp settings. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/40 dark:to-blue-900/40 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-green-600" />
          Daily Attendance Summary
        </CardTitle>
        <CardDescription>
          View and share daily attendance reports via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Preview Card */}
        <Card className="bg-white/90 dark:bg-black/20 border border-green-100 dark:border-green-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-600" />
                Summary Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={refreshSummary}
                  disabled={isRefreshing}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCcw className={`h-4 w-4 text-green-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleShare}
                  disabled={isSharing}
                  className="h-8 flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 text-green-600"
                >
                  <WhatsAppIcon />
                  Share via WhatsApp
              </Button>
        </div>
                </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-white/50 dark:bg-black/20">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {summaryPreview}
              </pre>
            </ScrollArea>
            </CardContent>
          </Card>

        {/* WhatsApp Settings */}
        <Card className="border-green-100 dark:border-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-green-600" />
              WhatsApp Sharing Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
              <Label>Admin WhatsApp Numbers</Label>
                <Input 
                value={whatsappNumber} 
                onChange={(e) => handleNumberInput(e.target.value)}
                placeholder="Enter WhatsApp numbers (e.g., +94741233252 | +94768231675)"
                className="bg-white/80 dark:bg-black/20"
              />
              <p className="text-xs text-muted-foreground">
                Enter multiple numbers separated by | (pipe symbol)
              </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch 
                id="whatsapp-auto-share" 
                checked={whatsappShareEnabled}
                onCheckedChange={setWhatsappShareEnabled}
              />
              <Label htmlFor="whatsapp-auto-share">Enable automatic sharing at 6:00 PM</Label>
              </div>
              
            <div className="flex gap-2 pt-2">
            <Button
                onClick={handleShare}
                disabled={isSharing || !whatsappNumber}
                className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white"
              >
                {isSharing ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Sharing...
                </>
              ) : (
                <>
                    <WhatsAppIcon />
                    <span className="ml-2">Share Now</span>
                </>
              )}
            </Button>
          </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default AttendanceSummaryShare;
