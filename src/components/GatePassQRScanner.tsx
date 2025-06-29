import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { toast } from '@/components/ui/use-toast';

// Add type declaration for Html5QrcodeScanner
declare global {
  interface Window {
    Html5QrcodeScanner: {
      new (
        elementId: string,
        config: {
          fps: number;
          qrbox: { width: number; height: number };
        },
        verbose: boolean
      ): Html5QrcodeScanner;
    };
  }
}

interface GatePassQRData {
  id: string;
  pass_code: string;
  type: 'gate_pass';
  employee_id: string;
  validity: 'single' | 'day' | 'week' | 'month';
}

interface Props {
  onScan: (data: GatePassQRData) => void;
  onError?: (error: string) => void;
}

const GatePassQRScanner: React.FC<Props> = ({ onScan, onError }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      "gate-pass-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render((decodedText) => {
      try {
        const parsedData = JSON.parse(decodedText);
        if (!isValidGatePassQR(parsedData)) {
          throw new Error('Invalid gate pass QR code format');
        }
        onScan(parsedData as GatePassQRData);
      } catch (error) {
        const errorMessage = 'Invalid gate pass QR code';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        if (onError) onError(errorMessage);
      }
    }, (error) => {
      // Ignore errors as they're too frequent during scanning
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [onScan, onError]);

  const isValidGatePassQR = (data: any): data is GatePassQRData => {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.id === 'string' &&
      typeof data.pass_code === 'string' &&
      data.type === 'gate_pass' &&
      typeof data.employee_id === 'string' &&
      ['single', 'day', 'week', 'month'].includes(data.validity)
    );
  };

  return (
    <div className="relative rounded-lg overflow-hidden">
      <div id="gate-pass-reader" className="w-full" />
    </div>
  );
};

export default GatePassQRScanner; 