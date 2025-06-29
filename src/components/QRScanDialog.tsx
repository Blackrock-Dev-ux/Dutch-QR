import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, XCircle, SwitchCamera } from 'lucide-react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { parseQRCodeData } from '@/utils/qrCodeUtils';
import { useToast } from '@/components/ui/use-toast';

// Performance optimized settings
const SCAN_INTERVAL = 50; // Scan every 50ms for better performance
const SCAN_RESOLUTION = { width: 640, height: 480 }; // Optimal resolution for QR scanning
const PROCESS_TIMEOUT = 1000; // 1 second timeout for processing
const CAMERA_CONSTRAINTS = {
  width: SCAN_RESOLUTION.width,
  height: SCAN_RESOLUTION.height,
  aspectRatio: 4/3,
  frameRate: { ideal: 30, min: 15 }
};

interface QRScanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (data: { type: 'employee' | 'gatepass' | 'unknown', id: string, additionalInfo?: string, employeeId?: string }) => void;
}

const QRScanDialog: React.FC<QRScanDialogProps> = ({ isOpen, onClose, onScanComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedData = useRef<string | null>(null);
  const processingLock = useRef<boolean>(false);
  
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'pending'>('pending');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Initialize canvas once
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCAN_RESOLUTION.width;
    canvas.height = SCAN_RESOLUTION.height;
    canvasRef.current = canvas;
    
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false,
      desynchronized: true
    });
    ctxRef.current = ctx;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
    scanIntervalRef.current = null;
    processingTimeoutRef.current = null;
    lastProcessedData.current = null;
    processingLock.current = false;
    setIsProcessing(false);
  }, []);

  // Setup camera permissions
  useEffect(() => {
    if (isOpen) {
      setScanning(true);
      setError(null);
      setCameraPermission('pending');
      
      navigator.mediaDevices.getUserMedia({ 
        video: {
          ...CAMERA_CONSTRAINTS,
          facingMode
        }
      })
        .then(() => {
          setCameraPermission('granted');
        })
        .catch((err) => {
          console.error("Camera access error:", err);
          setCameraPermission('denied');
          setError('Camera access denied. Please allow camera access and try again.');
        });
    } else {
      setScanning(false);
      cleanup();
    }
    
    return cleanup;
  }, [isOpen, cleanup, facingMode]);

  // Optimized QR scanning function
  const scanQRCode = useCallback(() => {
    if (!scanning || !webcamRef.current?.video || isProcessing || !ctxRef.current || !canvasRef.current) return;
    
    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    try {
      // Draw the current frame from the webcam onto the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get the image data from the canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Scan for QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
      });
      
      if (code && !processingLock.current) {
        // Prevent multiple processing of the same code
        if (code.data === lastProcessedData.current) return;
        
        processingLock.current = true;
        setIsProcessing(true);
        lastProcessedData.current = code.data;

        try {
          console.log("QR Code detected:", code.data);
          const parsedData = parseQRCodeData(code.data);
          
          if (parsedData.type !== 'unknown') {
            setScanning(false);
            onScanComplete(parsedData);
            setTimeout(onClose, 500);
          } else {
            toast({
              title: "Invalid QR Code",
              description: "The scanned QR code is not valid for this application.",
              variant: "destructive"
            });
          }
        } catch (err) {
          console.error("Error processing QR code:", err);
          toast({
            title: "Error",
            description: "Failed to process QR code. Please try again.",
            variant: "destructive"
          });
        } finally {
          // Reset processing state after timeout
          processingTimeoutRef.current = setTimeout(() => {
            setIsProcessing(false);
            processingLock.current = false;
            lastProcessedData.current = null;
          }, PROCESS_TIMEOUT);
        }
      }
    } catch (err) {
      console.error("Error during QR scanning:", err);
    }
  }, [scanning, isProcessing, onScanComplete, onClose, toast]);

  // Start scanning interval when camera is ready
  useEffect(() => {
    if (cameraPermission === 'granted' && scanning) {
      scanIntervalRef.current = setInterval(scanQRCode, SCAN_INTERVAL);
    }
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [cameraPermission, scanning, scanQRCode]);

  // Memoized video constraints
  const videoConstraints = useMemo(() => ({
    ...CAMERA_CONSTRAINTS,
    facingMode
  }), [facingMode]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden bg-white dark:bg-gray-900">
        <DialogHeader className="p-4 border-b flex justify-between items-center">
          <DialogTitle>Scan QR Code</DialogTitle>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
            className="h-8 w-8"
          >
            <SwitchCamera className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="relative">
          {cameraPermission === 'granted' ? (
            <>
              <div className="relative w-full aspect-square">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/png"
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                />
                
                {/* Optimized scanner UI with visual feedback */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-2/3 h-2/3 border-2 ${isProcessing ? 'border-green-500' : 'border-primary'} rounded-lg relative transition-colors duration-200`}>
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-current rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-current rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-current rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-current rounded-br-lg"></div>
                    {/* Scanning animation line */}
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-primary animate-scan"></div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Position the QR code within the frame to scan
                </p>
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : cameraPermission === 'denied' ? (
            <div className="p-8 flex flex-col items-center justify-center gap-4 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <h3 className="text-lg font-semibold">Camera Access Denied</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please allow camera access in your browser settings and try again.
              </p>
              <Button variant="default" onClick={onClose}>Close</Button>
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p>Requesting camera access...</p>
            </div>
          )}
          
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 flex items-center gap-2 text-red-800 dark:text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default React.memo(QRScanDialog);
