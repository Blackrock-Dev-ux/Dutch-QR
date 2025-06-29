import React from 'react';
import { Document, Page, Text, View, PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { FileDown, Share2, MessageCircle } from 'lucide-react';
import { getTodayAttendanceSummary } from '@/utils/attendanceUtils';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Employee {
  id: string;
  name: string;
  department: string;
  contact: string;
}

interface AttendanceSummary {
  totalEmployees: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  checkedOutCount: number;
  onTime: number;
  stillWorking: number;
  currentPresenceRate: string;
  totalPresentRate: string;
  onTimeRate: string;
  lateRate: string;
  absentRate: string;
  detailed: {
    onTime: number;
    lateArrivals: number;
    veryLate: number;
    halfDay: number;
    earlyDepartures: number;
    overtime: number;
    regularHours: number;
    attendanceRate: string;
    efficiencyRate: string;
    punctualityRate: string;
  };
  presenceBreakdown: {
    currentlyPresent: number;
    lateButPresent: number;
    checkedOut: number;
    onTimeArrivals: number;
    absent: number;
  };
}

interface PDFProps {
  absentEmployees: Employee[];
  summary: AttendanceSummary;
}

// Define styles for PDF
const styles = {
  page: {
    padding: 30,
    backgroundColor: '#ffffff'
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#1a1a1a',
    textDecoration: 'underline'
  },
  section: {
    margin: 10,
    padding: 10
  },
  subHeader: {
    fontSize: 18,
    marginBottom: 10,
    color: '#333333'
  },
  table: {
    display: 'table',
    width: '100%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 10
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    minHeight: 25,
    alignItems: 'center'
  },
  tableHeader: {
    backgroundColor: '#f0f0f0'
  },
  tableCell: {
    flex: 1,
    padding: 5,
    fontSize: 12
  },
  summaryText: {
    fontSize: 14,
    marginTop: 20,
    color: '#666666'
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 12,
    textAlign: 'center',
    color: '#666666'
  }
} as const;

// PDF Document Component
const AbsentEmployeePDF: React.FC<PDFProps> = ({ absentEmployees, summary }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Absent Employees Report</Text>
      
      <View style={styles.section}>
        <Text style={styles.subHeader}>Date: {new Date().toLocaleDateString()}</Text>
        
        {/* Summary Section */}
        <View style={[styles.section, { marginBottom: 20 }]}>
          <Text>Total Employees: {summary.totalEmployees}</Text>
          <Text>Total Absent: {summary.absentCount}</Text>
          <Text>Absence Rate: {summary.absentRate}%</Text>
        </View>

        {/* Absent Employees Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.tableCell}>Employee ID</Text>
            <Text style={styles.tableCell}>Name</Text>
            <Text style={styles.tableCell}>Department</Text>
            <Text style={styles.tableCell}>Contact</Text>
          </View>
          
          {absentEmployees.map((employee: Employee, index: number) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.tableCell}>{employee.id}</Text>
              <Text style={styles.tableCell}>{employee.name}</Text>
              <Text style={styles.tableCell}>{employee.department}</Text>
              <Text style={styles.tableCell}>{employee.contact}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.summaryText}>
          This report was generated automatically by the attendance system.
        </Text>
      </View>

      <Text style={styles.footer}>
        Generated on {new Date().toLocaleString()}
      </Text>
    </Page>
  </Document>
);

// Main Component
const AbsentEmployeeReport: React.FC = () => {
  const [loading, setLoading] = React.useState(false);
  const [absentEmployees, setAbsentEmployees] = React.useState<Employee[]>([]);
  const [summary, setSummary] = React.useState<AttendanceSummary | null>(null);
  const [whatsappNumber, setWhatsappNumber] = React.useState('');
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const fetchAbsentEmployees = async () => {
    setLoading(true);
    try {
      // Get today's attendance summary
      const todaySummary = await getTodayAttendanceSummary() as AttendanceSummary;
      setSummary(todaySummary);

      // Get all active employees
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, department, contact')
        .eq('status', 'active');

      // Get today's attendance records
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id')
        .eq('date', today);

      // Find employees who are absent (no attendance record for today)
      const presentEmployeeIds = attendance?.map(record => record.employee_id) || [];
      const absentEmployeesList = (employees || []).filter(
        (employee: Employee) => !presentEmployeeIds.includes(employee.id)
      ) as Employee[];

      setAbsentEmployees(absentEmployeesList);
    } catch (error) {
      console.error('Error fetching absent employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateWhatsAppMessage = () => {
    if (!summary || absentEmployees.length === 0) return '';

    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const message = `🏢 *ABSENT EMPLOYEES REPORT*
📅 ${dateStr}

📊 *Summary*
• Total Employees: ${summary.totalEmployees}
• Absent Today: ${summary.absentCount}
• Absence Rate: ${summary.absentRate}%

👥 *Absent Employees List*
${absentEmployees.map((emp, index) => 
  `${index + 1}. ${emp.name} (${emp.department})`
).join('\n')}

🤖 Generated by Attendance System`;

    return encodeURIComponent(message);
  };

  const handleWhatsAppShare = () => {
    const message = generateWhatsAppMessage();
    if (!message) return;

    // Format WhatsApp number
    let formattedNumber = whatsappNumber.trim().replace(/\D/g, '');
    formattedNumber = formattedNumber.startsWith('0') 
      ? '94' + formattedNumber.substring(1)
      : formattedNumber.startsWith('94') 
        ? formattedNumber 
        : '94' + formattedNumber;

    // Create WhatsApp URL
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedNumber}&text=${message}`;
    window.open(whatsappUrl, '_blank');
    setIsDialogOpen(false);
  };

  React.useEffect(() => {
    fetchAbsentEmployees();
  }, []);

  if (!summary || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Absent Employees Report</h2>
        <div className="flex gap-2">
          <PDFDownloadLink
            document={<AbsentEmployeePDF absentEmployees={absentEmployees} summary={summary} />}
            fileName={`absent-employees-${new Date().toISOString().split('T')[0]}.pdf`}
          >
            {({ loading: pdfLoading }) => (
              <Button disabled={pdfLoading}>
                <FileDown className="mr-2 h-4 w-4" />
                {pdfLoading ? 'Generating PDF...' : 'Download PDF'}
              </Button>
            )}
          </PDFDownloadLink>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Share2 className="mr-2 h-4 w-4" />
                Share via WhatsApp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share Absent Employees Report</DialogTitle>
                <DialogDescription>
                  Enter the WhatsApp number to share the report with.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Number</Label>
                  <Input
                    id="whatsapp"
                    placeholder="Enter WhatsApp number (e.g., 94771234567)"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Include country code (e.g., 94 for Sri Lanka)
                  </p>
                </div>
                <Button 
                  onClick={handleWhatsAppShare}
                  disabled={!whatsappNumber || whatsappNumber.length < 10}
                  className="w-full"
                >
                  Share Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-muted p-4 rounded-lg">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-muted-foreground">Total Employees</p>
            <p className="text-2xl font-bold">{summary.totalEmployees}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Absent Today</p>
            <p className="text-2xl font-bold text-red-600">{summary.absentCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Absence Rate</p>
            <p className="text-2xl font-bold">{summary.absentRate}%</p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="p-3 text-left">Employee ID</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Contact</th>
            </tr>
          </thead>
          <tbody>
            {absentEmployees.map((employee) => (
              <tr key={employee.id} className="border-b">
                <td className="p-3">{employee.id}</td>
                <td className="p-3">{employee.name}</td>
                <td className="p-3">{employee.department}</td>
                <td className="p-3">{employee.contact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AbsentEmployeeReport; 