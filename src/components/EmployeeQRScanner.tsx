import React, { useState } from 'react';
import { QRScanner } from './QRScanner';
import { parseQRCodeData } from '@/utils/qrCodeUtils';
import { recordAttendance } from '@/utils/attendanceUtils';
import { useToast } from '@/hooks/use-toast';
import { ScannerOverlay } from './ScannerOverlay';
import { SpeechUtility } from '@/utils/speechUtils';

interface EmployeeQRScannerProps {
  onScanComplete?: () => void;
}

const EmployeeQRScanner: React.FC<EmployeeQRScannerProps> = ({ onScanComplete }) => {
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const speechUtility = new SpeechUtility();

  const handleScan = async (detectedCodes: any[]) => {
    if (!detectedCodes.length || isLoading) return;

    const result = detectedCodes[0].rawValue;
    if (!result) return;

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

      // Play success sound and speak feedback
      await speechUtility.playSuccessSound();
      await speechUtility.speak(`Welcome ${attendanceResult.employeeName}`);

      // Show success message
    toast({
        title: 'Attendance Recorded',
        description: `Successfully recorded attendance for ${attendanceResult.employeeName}`,
        duration: 3000,
      });

      // Call completion callback
      if (onScanComplete) {
        onScanComplete();
      }

      } catch (error) {
      console.error('QR Scan Error:', error);
      
      // Play error sound
      await speechUtility.playErrorSound();

      // Determine error message and speak it
      let errorMessage = 'Failed to record attendance';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Special handling for roster-related errors
        if (errorMessage.includes('No active roster')) {
          errorMessage = 'No active roster found. Please contact your supervisor.';
          await speechUtility.speak('No active roster found. Please contact your supervisor.');
        } else {
          await speechUtility.speak('Error recording attendance');
        }
      }

      // Show error toast
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
      // Resume scanning after a short delay
      setTimeout(() => setIsScanning(true), 2000);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <QRScanner
        onScan={handleScan}
        scanning={isScanning}
        className="w-full aspect-square rounded-lg overflow-hidden"
      />
      <ScannerOverlay isScanning={isScanning} isLoading={isLoading} />
    </div>
  );
};

export default EmployeeQRScanner; 