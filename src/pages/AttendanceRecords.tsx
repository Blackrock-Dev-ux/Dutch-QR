import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AttendanceTable from '@/components/AttendanceTable';
import AttendanceSummaryShare from '@/components/AttendanceSummaryShare';
import AutomatedAttendanceBot from '@/components/AutomatedAttendanceBot';
import EnhancedAttendanceReport from '@/components/EnhancedAttendanceReport';
import AbsentEmployeeReport from '@/components/AbsentEmployeeReport';
import AbsentEmployeeDownload from '@/components/AbsentEmployeeDownload';
import PresentEmployeeReport from '@/components/PresentEmployeeReport';

const AttendanceRecords: React.FC = () => {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Attendance Records</h1>
      
      <Tabs defaultValue="present" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="present">Present Employees</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced Report</TabsTrigger>
          <TabsTrigger value="records">Basic Records</TabsTrigger>
          <TabsTrigger value="absent">Absent Report</TabsTrigger>
          <TabsTrigger value="absent-download">Download Absent</TabsTrigger>
          <TabsTrigger value="share">Manual Share</TabsTrigger>
          <TabsTrigger value="bot">Automated BOT</TabsTrigger>
        </TabsList>
        
        <TabsContent value="present">
          <PresentEmployeeReport />
        </TabsContent>
        
        <TabsContent value="enhanced">
          <EnhancedAttendanceReport />
        </TabsContent>
        
        <TabsContent value="records">
          <AttendanceTable />
        </TabsContent>

        <TabsContent value="absent">
          <AbsentEmployeeReport />
        </TabsContent>

        <TabsContent value="absent-download">
          <AbsentEmployeeDownload />
        </TabsContent>
        
        <TabsContent value="share">
          <AttendanceSummaryShare />
        </TabsContent>

        <TabsContent value="bot">
          <AutomatedAttendanceBot />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttendanceRecords; 