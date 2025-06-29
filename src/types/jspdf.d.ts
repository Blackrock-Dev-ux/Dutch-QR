import { jsPDF } from 'jspdf';

interface AutoTableOptions {
  startY?: number;
  head?: any[][];
  body?: any[][];
  theme?: string;
  headStyles?: {
    fillColor?: number[];
    [key: string]: any;
  };
  styles?: {
    fontSize?: number;
    [key: string]: any;
  };
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => void;
  }
} 