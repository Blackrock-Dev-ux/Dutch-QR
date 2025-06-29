import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';
import LoadingSpinner from './LoadingSpinner';
import { AttendanceStateIndicator } from './AttendanceStateIndicator';
import { getCurrentAttendanceState, getNextAttendanceAction, recordAttendance } from '@/utils/attendanceUtils';
import { parseQRCodeData } from '@/utils/qrCodeUtils';
import { AlertTriangle, CheckCircle, Clock, Volume2, VolumeX } from 'lucide-react';
import { Badge } from './ui/badge';
import { attendanceSpeechService } from '@/utils/speechUtils';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

interface QRScannerProps {
  onScanSuccess?: (result: any) => void;
  onScanError?: (error: any) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanError }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [attendanceState, setAttendanceState] = useState<'not_checked_in' | 'first_checked_in' | 'first_checked_out' | 'second_checked_in' | 'second_checked_out'>('not_checked_in');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastScanTime, setLastScanTime] = useState(0);
  const { toast } = useToast();
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleScan = useCallback(async (detectedCodes: any[]) => {
    if (!detectedCodes.length || isLoading) return;

    const result = detectedCodes[0].rawValue;
    if (!result) return;

    // Debounce scanning to prevent duplicate scans
    const currentTime = Date.now();
    if (currentTime - lastScanTime < 2000) return;
    setLastScanTime(currentTime);

    try {
      setIsLoading(true);
      setIsScanning(false);

      // Parse QR code data
      const qrData = parseQRCodeData(result);
      if (qrData.type !== 'employee' || !qrData.id) {
        throw new Error('Invalid QR code format');
      }

      // Record attendance
      const attendanceResult = await recordAttendance(qrData.id);

      // Show success message with roster compliance info
      const {
        action,
        employeeName,
        isLate,
        lateMinutes,
        earlyDepartureMinutes,
        actualHours,
        expectedHours,
        complianceRate
      } = attendanceResult;

      // Update attendance state
      const newState = await getCurrentAttendanceState(qrData.id);
      setAttendanceState(newState);

      // Voice announcement if enabled
      if (voiceEnabled && attendanceSpeechService.isSupported()) {
        try {
          await attendanceSpeechService.speakAttendanceResult(attendanceResult);
        } catch (voiceError) {
          console.warn('Voice announcement failed:', voiceError);
        }
      }

      toast({
        title: `${action.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Successful`,
        description: (
          <div className="mt-2">
            <p>Employee: {employeeName}</p>
            {isLate ? (
              <div className="flex items-center text-destructive mt-1">
                <AlertTriangle className="w-4 h-4 mr-1" />
                <span>{lateMinutes} minutes late</span>
              </div>
            ) : (
              <div className="flex items-center text-success mt-1">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span>On time</span>
              </div>
            )}
            <div className="flex items-center mt-1">
              <Clock className="w-4 h-4 mr-1" />
              <span>{actualHours?.toFixed(1) || 0} / {expectedHours?.toFixed(1)} hours</span>
            </div>
            <Badge variant={complianceRate >= 90 ? "default" : "destructive"} className="mt-2">
              {complianceRate?.toFixed(1)}% Compliance
            </Badge>
              </div>
        ),
        duration: 5000
      });

      if (onScanSuccess) {
        onScanSuccess(attendanceResult);
      }
    } catch (error) {
      console.error('Scan error:', error);
      
      // Voice error announcement if enabled
      if (voiceEnabled && attendanceSpeechService.isSupported()) {
        try {
          const errorMessage = error instanceof Error ? error.message : "Failed to process attendance";
          await attendanceSpeechService.speak(`Error: ${errorMessage}`);
        } catch (voiceError) {
          console.warn('Voice error announcement failed:', voiceError);
        }
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process attendance",
        duration: 3000
      });

      if (onScanError) {
        onScanError(error);
      }
    } finally {
      setIsLoading(false);
      // Clear any existing timeout
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      // Restart scanning after a brief delay
      scanTimeoutRef.current = setTimeout(() => setIsScanning(true), 2000);
    }
  }, [isLoading, lastScanTime, voiceEnabled, onScanSuccess, onScanError, toast]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      attendanceSpeechService.stop();
    };
  }, []);

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <AttendanceStateIndicator currentState={attendanceState} />
          <div className="flex items-center space-x-2">
            {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <Switch
              checked={voiceEnabled}
              onCheckedChange={setVoiceEnabled}
              disabled={!attendanceSpeechService.isSupported()}
            />
            <Label htmlFor="voice-toggle" className="text-sm">
              Voice Feedback
            </Label>
          </div>
        </div>
        
        {!attendanceSpeechService.isSupported() && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
              <span className="text-sm text-orange-700">
                Voice feedback is not supported in this browser
              </span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <LoadingSpinner />
          </div>
        )}
        
        {isScanning ? (
          <div className="relative">
            <Scanner
              onScan={handleScan}
              onError={(error) => {
                console.error('Scanner error:', error);
                toast({
                  variant: "destructive",
                  title: "Scanner Error",
                  description: "Failed to access camera",
                  duration: 3000
                });
              }}
              constraints={{
                facingMode: 'environment',
                // Optimized video constraints for better performance
                video: {
                  width: { ideal: 1280 },
                  height: { ideal: 720 }
                }
              }}
              // Increased scan frequency for faster detection
              scanDelay={100}
              // Enhanced QR detection formats
              formats={['qr_code', 'data_matrix']}
              components={{
                audio: false,
                finder: true,
                onOff: false,
                torch: true,
                zoom: false
              }}
              styles={{
                container: {
                  width: '100%',
                  height: '300px'
                },
                finderBorder: 40
              }}
            />
            <Button
              onClick={() => {
                setIsScanning(false);
                if (scanTimeoutRef.current) {
                  clearTimeout(scanTimeoutRef.current);
                }
              }}
              variant="destructive"
              className="w-full mt-4"
            >
              Stop Scanning
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setIsScanning(true)}
            className="w-full mt-4"
          >
            Start Scanning
          </Button>
        )}
      </div>
    </Card>
  );
};

export default QRScanner; 