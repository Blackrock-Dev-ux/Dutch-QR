import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ScannerOverlayProps {
  scanning: boolean;
  error: string | null;
}

export function ScannerOverlay({ scanning, error }: ScannerOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Scanner frame */}
      <div className="absolute inset-0 border-[3px] border-transparent">
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-primary" />
        <div className="absolute top-0 right-0 w-20 h-20 border-t-4 border-r-4 border-primary" />
        <div className="absolute bottom-0 left-0 w-20 h-20 border-b-4 border-l-4 border-primary" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-primary" />
      </div>

      {/* Scanning line animation */}
      <div
        className={cn(
          "absolute left-0 right-0 h-[2px] bg-primary transition-transform duration-1000",
          scanning ? "animate-scan-line" : "hidden"
        )}
      />

      {/* Loading indicator */}
      {scanning && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm font-medium">
            {error}
          </div>
          </div>
        )}
    </div>
  );
}

export default ScannerOverlay;
