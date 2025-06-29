import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Employee } from '@/types';
import { Download } from 'lucide-react';
import { generateEmployeeQR } from '@/utils/qrCodeUtils';

interface QRCodeGeneratorProps {
  employee: Employee;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ employee }) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleDownload = () => {
    if (!qrRef.current) return;
    
    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;
    
    // Create a canvas from the SVG
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${employee.name.replace(/\s+/g, '_')}_QRCode.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      
      toast({
        title: 'QR Code Downloaded',
        description: `QR code for ${employee.name} has been downloaded.`,
      });
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Generate QR code data using the standardized format with system identifier
  const qrCodeData = generateEmployeeQR({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    department: employee.department
  });

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Employee QR Code</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div ref={qrRef} className="bg-white p-4 rounded-md mb-4">
          <QRCodeSVG
            value={qrCodeData}
            size={200}
            bgColor={"#ffffff"}
            fgColor={"#000000"}
            level={"H"}
            includeMargin={true}
          />
        </div>
        
        <div className="text-center mb-4">
          <h3 className="font-bold text-lg">{employee.name}</h3>
          <p className="text-muted-foreground">{employee.department}</p>
          <p className="text-sm text-muted-foreground">{employee.position}</p>
        </div>
        
        <Button onClick={handleDownload} className="w-full flex items-center justify-center gap-2">
          <Download className="h-4 w-4" />
          Download QR Code
        </Button>
      </CardContent>
    </Card>
  );
};

export default QRCodeGenerator;
