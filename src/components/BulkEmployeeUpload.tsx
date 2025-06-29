
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, FilePlus, FileWarning, CheckCircle, FileSpreadsheet, Info } from 'lucide-react';
import { bulkImportEmployees } from '@/utils/employeeUtils';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const BulkEmployeeUpload: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check if the file is CSV or XLSX
      const isValidFile = 
        selectedFile.name.endsWith('.csv') || 
        selectedFile.name.endsWith('.xlsx');
      
      if (!isValidFile) {
        toast({
          title: 'Invalid File Format',
          description: 'Please select a CSV or XLSX file.',
          variant: 'destructive',
        });
        return;
      }
      
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Check if the file is CSV or XLSX
      const isValidFile = 
        droppedFile.name.endsWith('.csv') || 
        droppedFile.name.endsWith('.xlsx');
      
      if (!isValidFile) {
        toast({
          title: 'Invalid File Format',
          description: 'Please select a CSV or XLSX file.',
          variant: 'destructive',
        });
        return;
      }
      
      setFile(droppedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Process the file
      const importResult = await bulkImportEmployees(file, (progress) => {
        setUploadProgress(progress);
      });
      
      setResult(importResult);
      
      if (importResult.failed === 0) {
        toast({
          title: 'Upload Successful',
          description: `${importResult.success} employees were imported successfully.`,
        });
      } else {
        toast({
          title: 'Upload Completed with Errors',
          description: `${importResult.success} succeeded, ${importResult.failed} failed.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: 'There was an error processing your file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Bulk Employee Upload
        </CardTitle>
        <CardDescription>
          Import multiple employees at once using a CSV or Excel file.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {!isUploading && !result && (
          <>
            <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <Info className="h-4 w-4" />
              <AlertTitle>File Format</AlertTitle>
              <AlertDescription className="text-sm">
                Your file should include these columns: First Name, Last Name, Email, Department, Position, Phone (optional), Join Date (optional), Status (optional)
              </AlertDescription>
            </Alert>
            
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => document.getElementById('file-upload')?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <UploadCloud className="h-12 w-12 mx-auto text-primary/70" />
              <p className="mt-4 text-sm font-medium">
                Drag and drop your file here, or click to browse
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Supported formats: CSV, XLSX
              </p>
              <Input 
                id="file-upload" 
                type="file" 
                accept=".csv,.xlsx" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </div>
          </>
        )}
        
        {file && !isUploading && !result && (
          <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
            <div className="flex items-center space-x-3">
              <FilePlus className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button onClick={handleUpload}>
              Import
            </Button>
          </div>
        )}
        
        {isUploading && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}
        
        {result && (
          <div className="space-y-4">
            <div className="bg-primary/10 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-medium">Upload Complete</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-primary/5 p-3 rounded text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{result.total}</p>
                </div>
                <div className="bg-green-500/5 p-3 rounded text-center">
                  <p className="text-sm text-muted-foreground">Successful</p>
                  <p className="text-xl font-bold text-green-600">{result.success}</p>
                </div>
                <div className="bg-red-500/5 p-3 rounded text-center">
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-xl font-bold text-red-600">{result.failed}</p>
                </div>
              </div>
            </div>
            
            {result.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
                <div className="flex items-center space-x-2 mb-2">
                  <FileWarning className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="font-medium text-red-800 dark:text-red-300">Errors</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                    {result.errors.slice(0, 5).map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more errors</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-2">
              <Button onClick={() => {
                setFile(null);
                setResult(null);
              }} variant="outline">
                Upload Another File
              </Button>
              <Button onClick={onComplete}>
                Done
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BulkEmployeeUpload;
