import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { QrCode, Edit, Trash2, MoreVertical, Search, FileArchive, Download } from 'lucide-react';
import { Employee } from '@/types';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import QRCodeGenerator from './QRCodeGenerator';
import { useToast } from '@/components/ui/use-toast';
import { downloadAllQRCodes } from '@/utils/qrCodeUtils';

interface EmployeeTableProps {
  employees: Employee[];
  onDelete: (id: string) => void;
  onEdit: (employee: Employee) => void;
  loading?: boolean;
}

const EmployeeTable: React.FC<EmployeeTableProps> = ({ 
  employees, 
  onDelete, 
  onEdit,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const { toast } = useToast();
  
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleQRCode = (employee: Employee) => {
    setSelectedEmployee(employee);
  };

  const handleEdit = (employee: Employee) => {
    onEdit(employee);
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const handleDownloadAllQRCodes = async () => {
    if (employees.length === 0) {
      toast({
        title: "No employees",
        description: "There are no employees to generate QR codes for.",
        variant: "destructive"
      });
      return;
    }

    setIsDownloadingAll(true);
    try {
      await downloadAllQRCodes(employees);
      toast({
        title: "Download Complete",
        description: "All QR codes have been downloaded as a zip file.",
      });
    } catch (error) {
      console.error("Error downloading QR codes:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download QR codes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search employees..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
          variant="outline" 
          className="w-full sm:w-auto gap-2 border-primary/20 text-primary hover:text-primary/90 hover:bg-primary/5"
          onClick={handleDownloadAllQRCodes}
          disabled={isDownloadingAll || employees.length === 0}
        >
          {isDownloadingAll ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-primary border-r-transparent rounded-full"></div>
              <span>Preparing Download...</span>
            </>
          ) : (
            <>
              <FileArchive className="h-4 w-4" />
              <span>Download All QR Codes</span>
            </>
          )}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Join Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  No employees found
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.position}</TableCell>
                  <TableCell>
                    <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                      {employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{employee.join_date ? new Date(employee.join_date).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Dialog>
                          <DialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleQRCode(employee);
                              }}
                            >
                              <QrCode className="mr-2 h-4 w-4" />
                              <span>Generate QR</span>
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Employee QR Code</DialogTitle>
                              <DialogDescription>
                                Scan this QR code for attendance tracking.
                              </DialogDescription>
                            </DialogHeader>
                            {selectedEmployee && <QRCodeGenerator employee={selectedEmployee} />}
                          </DialogContent>
                        </Dialog>
                        
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleEdit(employee);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                        
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            handleDeleteClick(employee.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the employee
              and all related attendance records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeTable;
