declare module 'react-qr-scanner' {
  import { Component } from 'react';

  interface QrScannerProps {
    delay?: number;
    onError?: (error: Error) => void;
    onScan?: (data: string | null) => void;
    style?: React.CSSProperties;
    constraints?: MediaTrackConstraints;
    className?: string;
  }

  export default class QrScanner extends Component<QrScannerProps> {}
} 