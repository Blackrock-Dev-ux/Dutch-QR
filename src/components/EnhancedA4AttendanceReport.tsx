import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { Attendance, Employee } from '@/types';
import { calculateWorkingTime } from '@/utils/attendanceUtils';

// A4 Page dimensions in points (72 DPI)
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

// Create A4-optimized styles
const createA4Styles = () => {
  return StyleSheet.create({
    page: {
      size: 'A4',
      padding: 40,
      backgroundColor: '#ffffff',
      fontFamily: 'Helvetica',
      fontSize: 9,
      lineHeight: 1.4
    },
    
    // Header Section
    header: {
      marginBottom: 25,
      borderBottom: 2,
      borderBottomColor: '#2c3e50',
      paddingBottom: 15
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10
    },
    companySection: {
      flex: 2
    },
    companyName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#2c3e50',
      marginBottom: 3
    },
    companySubtitle: {
      fontSize: 11,
      color: '#7f8c8d',
      marginBottom: 2
    },
    reportTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#34495e',
      marginTop: 8
    },
    
    // Report Info Section
    reportInfo: {
      flex: 1,
      alignItems: 'flex-end'
    },
    reportDate: {
      fontSize: 10,
      color: '#2c3e50',
      marginBottom: 3
    },
    reportPeriod: {
      fontSize: 9,
      color: '#7f8c8d',
      marginBottom: 2
    },
    generatedTime: {
      fontSize: 8,
      color: '#95a5a6',
      fontStyle: 'italic'
    },
    
    // Summary Section
    summarySection: {
      marginBottom: 20,
      padding: 12,
      backgroundColor: '#f8f9fa',
      borderRadius: 4,
      border: 1,
      borderColor: '#e9ecef'
    },
    summaryTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#2c3e50',
      marginBottom: 8,
      textAlign: 'center'
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 4
    },
    summaryItem: {
      alignItems: 'center',
      flex: 1
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#2c3e50'
    },
    summaryLabel: {
      fontSize: 8,
      color: '#7f8c8d',
      textAlign: 'center'
    },
    
    // Department Section
    departmentSection: {
      marginBottom: 15,
      pageBreakInside: false
    },
    departmentHeader: {
      backgroundColor: '#3498db',
      padding: 8,
      marginBottom: 2,
      borderRadius: 3
    },
    departmentTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#ffffff',
      textAlign: 'center'
    },
    departmentStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: '#ecf0f1',
      padding: 6,
      marginBottom: 8,
      borderRadius: 2
    },
    departmentStat: {
      alignItems: 'center'
    },
    departmentStatValue: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#2c3e50'
    },
    departmentStatLabel: {
      fontSize: 7,
      color: '#7f8c8d'
    },
    
    // Table Styles
    table: {
      width: '100%',
      marginBottom: 10
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#34495e',
      padding: 6,
      borderRadius: 2
    },
    tableHeaderCell: {
      color: '#ffffff',
      fontSize: 8,
      fontWeight: 'bold',
      textAlign: 'center',
      paddingHorizontal: 2
    },
    tableRow: {
      flexDirection: 'row',
      borderBottom: 0.5,
      borderBottomColor: '#bdc3c7',
      paddingVertical: 4,
      minHeight: 20
    },
    tableRowEven: {
      backgroundColor: '#f8f9fa'
    },
    tableCell: {
      fontSize: 8,
      color: '#2c3e50',
      paddingHorizontal: 2,
      textAlign: 'center',
      justifyContent: 'center'
    },
    
    // Employee Cell
    employeeCell: {
      paddingHorizontal: 3,
      justifyContent: 'center'
    },
    employeeName: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#2c3e50',
      marginBottom: 1
    },
    employeePosition: {
      fontSize: 7,
      color: '#7f8c8d',
      fontStyle: 'italic'
    },
    
    // Time Cells
    timeCell: {
      alignItems: 'center',
      paddingHorizontal: 2
    },
    timeValue: {
      fontSize: 8,
      color: '#2c3e50',
      fontWeight: 'bold'
    },
    timeLabel: {
      fontSize: 6,
      color: '#95a5a6',
      marginTop: 1
    },
    
    // Status and Duration Cells
    statusCell: {
      alignItems: 'center',
      paddingHorizontal: 2
    },
    statusBadge: {
      fontSize: 7,
      fontWeight: 'bold',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 2,
      textAlign: 'center'
    },
    statusPresent: {
      backgroundColor: '#d5f4e6',
      color: '#27ae60'
    },
    statusLate: {
      backgroundColor: '#ffeaa7',
      color: '#e17055'
    },
    statusAbsent: {
      backgroundColor: '#fab1a0',
      color: '#d63031'
    },
    statusCompleted: {
      backgroundColor: '#a8e6cf',
      color: '#00b894'
    },
    
    durationCell: {
      alignItems: 'center',
      paddingHorizontal: 2
    },
    durationValue: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#2c3e50'
    },
    durationLabel: {
      fontSize: 6,
      color: '#95a5a6'
    },
    
    lateCell: {
      alignItems: 'center',
      paddingHorizontal: 2
    },
    lateValue: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#e74c3c'
    },
    onTimeValue: {
      fontSize: 8,
      color: '#27ae60'
    },
    
    // Footer
    footer: {
      position: 'absolute',
      bottom: 30,
      left: 40,
      right: 40,
      borderTop: 1,
      borderTopColor: '#bdc3c7',
      paddingTop: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    footerText: {
      fontSize: 8,
      color: '#7f8c8d'
    },
    footerBrand: {
      fontSize: 8,
      fontWeight: 'bold',
      color: '#3498db'
    },
    
    // Page Break
    pageBreak: {
      pageBreakBefore: true
    }
  });
};

interface EnhancedA4AttendanceReportProps {
  attendanceRecords: Attendance[];
  absentEmployees?: Employee[];
  startDate: Date;
  endDate: Date;
}

const EnhancedA4AttendanceReport: React.FC<EnhancedA4AttendanceReportProps> = ({
  attendanceRecords,
  absentEmployees = [],
  startDate,
  endDate
}) => {
  const styles = createA4Styles();

  // Group records by department with null safety
  const recordsByDepartment = (attendanceRecords || []).reduce((acc, record) => {
    const department = record.employee?.department || 'Unassigned';
    if (!acc[department]) {
      acc[department] = [];
    }
    acc[department].push(record);
    return acc;
  }, {} as Record<string, Attendance[]>);

  // Calculate overall statistics
  const totalRecords = attendanceRecords.length;
  const presentCount = attendanceRecords.filter(r => r.status === 'present' || r.status === 'completed').length;
  const lateCount = attendanceRecords.filter(r => r.minutes_late && r.minutes_late !== '0h 0m').length;
  const onTimeCount = presentCount - lateCount;
  const absentCount = absentEmployees.length;

  // Helper functions
  const formatTime = (timeString: string | null | undefined) => {
    if (!timeString) return '-';
    try {
      const date = new Date(timeString);
      return format(date, 'HH:mm');
    } catch {
      return '-';
    }
  };

  const formatBreakDuration = (minutes: number | undefined) => {
    if (!minutes || minutes === 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatWorkingHours = (record: Attendance) => {
    if (record.working_duration && record.working_duration !== '0h 0m') {
      return record.working_duration;
    }
    return calculateWorkingTime(record) || '-';
  };

  const getStatusStyle = (status: string | undefined) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return styles.statusPresent;
      case 'completed':
        return styles.statusCompleted;
      case 'late':
        return styles.statusLate;
      case 'absent':
        return styles.statusAbsent;
      default:
        return styles.statusPresent;
    }
  };

  const getStatusText = (record: Attendance) => {
    if (record.minutes_late && record.minutes_late !== '0h 0m') {
      return 'LATE';
    }
    return record.status?.toUpperCase() || 'PRESENT';
  };

  // Calculate department statistics
  const getDepartmentStats = (records: Attendance[]) => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present' || r.status === 'completed').length;
    const late = records.filter(r => r.minutes_late && r.minutes_late !== '0h 0m').length;
    const onTime = present - late;
    
    return { total, present, late, onTime };
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.companySection}>
              <Text style={styles.companyName}>Dutch Activity</Text>
              <Text style={styles.companySubtitle}>QR Attendance Management System</Text>
              <Text style={styles.reportTitle}>Attendance Report</Text>
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.reportDate}>
                {format(new Date(), 'MMMM d, yyyy')}
              </Text>
              <Text style={styles.reportPeriod}>
                Period: {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
              </Text>
              <Text style={styles.generatedTime}>
                Generated: {format(new Date(), 'HH:mm')}
              </Text>
            </View>
          </View>
        </View>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Overall Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalRecords}</Text>
              <Text style={styles.summaryLabel}>Total Records</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#27ae60' }]}>{onTimeCount}</Text>
              <Text style={styles.summaryLabel}>On Time</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#e17055' }]}>{lateCount}</Text>
              <Text style={styles.summaryLabel}>Late Arrivals</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#d63031' }]}>{absentCount}</Text>
              <Text style={styles.summaryLabel}>Absent</Text>
            </View>
          </View>
        </View>

        {/* Department-wise Records */}
        {Object.entries(recordsByDepartment).map(([department, records], deptIndex) => {
          const deptStats = getDepartmentStats(records);
          const isNewPage = deptIndex > 0 && deptIndex % 2 === 0; // New page every 2 departments
          
          return (
            <View key={department} style={[styles.departmentSection, isNewPage && styles.pageBreak]}>
              {/* Department Header */}
              <View style={styles.departmentHeader}>
                <Text style={styles.departmentTitle}>
                  {department} Department ({deptStats.total} employees)
                </Text>
              </View>
              
              {/* Department Statistics */}
              <View style={styles.departmentStats}>
                <View style={styles.departmentStat}>
                  <Text style={styles.departmentStatValue}>{deptStats.present}</Text>
                  <Text style={styles.departmentStatLabel}>Present</Text>
                </View>
                <View style={styles.departmentStat}>
                  <Text style={[styles.departmentStatValue, { color: '#27ae60' }]}>{deptStats.onTime}</Text>
                  <Text style={styles.departmentStatLabel}>On Time</Text>
                </View>
                <View style={styles.departmentStat}>
                  <Text style={[styles.departmentStatValue, { color: '#e17055' }]}>{deptStats.late}</Text>
                  <Text style={styles.departmentStatLabel}>Late</Text>
                </View>
              </View>

              {/* Department Table */}
              <View style={styles.table}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Employee</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>First Shift</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Second Shift</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Break</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Hours</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Late</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Status</Text>
                </View>

                {/* Table Rows */}
                {records.map((record, index) => (
                  <View key={record.id} style={[
                    styles.tableRow,
                    index % 2 === 0 && styles.tableRowEven
                  ]}>
                    {/* Employee Info */}
                    <View style={[styles.employeeCell, { flex: 2 }]}>
                      <Text style={styles.employeeName}>
                        {record.employee_name || 'Unknown Employee'}
                      </Text>
                      <Text style={styles.employeePosition}>
                        {record.employee?.position || 'Staff'}
                      </Text>
                    </View>

                    {/* First Shift */}
                    <View style={[styles.timeCell, { flex: 1.2 }]}>
                      <Text style={styles.timeValue}>
                        {formatTime(record.first_check_in_time)} - {formatTime(record.first_check_out_time)}
                      </Text>
                    </View>

                    {/* Second Shift */}
                    <View style={[styles.timeCell, { flex: 1.2 }]}>
                      <Text style={styles.timeValue}>
                        {formatTime(record.second_check_in_time)} - {formatTime(record.second_check_out_time)}
                      </Text>
                    </View>

                    {/* Break Duration */}
                    <View style={[styles.durationCell, { flex: 0.8 }]}>
                      <Text style={styles.durationValue}>
                        {formatBreakDuration(record.break_duration)}
                      </Text>
                    </View>

                    {/* Working Hours */}
                    <View style={[styles.durationCell, { flex: 0.8 }]}>
                      <Text style={styles.durationValue}>
                        {formatWorkingHours(record)}
                      </Text>
                    </View>

                    {/* Late Duration */}
                    <View style={[styles.lateCell, { flex: 0.8 }]}>
                      <Text style={
                        record.minutes_late && record.minutes_late !== '0h 0m' 
                          ? styles.lateValue 
                          : styles.onTimeValue
                      }>
                        {record.minutes_late && record.minutes_late !== '0h 0m' 
                          ? record.minutes_late 
                          : 'On Time'
                        }
                      </Text>
                    </View>

                    {/* Status */}
                    <View style={[styles.statusCell, { flex: 0.8 }]}>
                      <Text style={[styles.statusBadge, getStatusStyle(record.status)]}>
                        {getStatusText(record)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Dutch Activity QR Attendance System</Text>
          <Text style={styles.footerText}>
            Page 1 • Generated on {format(new Date(), 'yyyy-MM-dd HH:mm')}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default EnhancedA4AttendanceReport;

