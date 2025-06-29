import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { Attendance, Employee } from '@/types';
import { calculateWorkingTime } from '@/utils/attendanceUtils';

// Dynamic font size calculation based on record count
const calculateFontSizes = (recordCount: number) => {
  // Base sizes for less than 15 records
  let sizes = {
    header: 24,
    title: 16,
    tableHeader: 10,
    employeeName: 10,
    employeeDept: 8,
    tableCell: 9,
    timeValue: 9,
    timeLabel: 7,
    durationValue: 9,
    statusText: 8,
    footer: 8
  };

  // Adjust sizes based on record count
  if (recordCount > 15 && recordCount <= 25) {
    sizes = {
      ...sizes,
      header: 22,
      title: 14,
      tableHeader: 9,
      employeeName: 9,
      employeeDept: 7,
      tableCell: 8,
      timeValue: 8,
      timeLabel: 6,
      durationValue: 8,
      statusText: 7,
      footer: 7
    };
  } else if (recordCount > 25 && recordCount <= 35) {
    sizes = {
      ...sizes,
      header: 20,
      title: 12,
      tableHeader: 8,
      employeeName: 8,
      employeeDept: 6,
      tableCell: 7,
      timeValue: 7,
      timeLabel: 5,
      durationValue: 7,
      statusText: 6,
      footer: 6
    };
  } else if (recordCount > 35) {
    sizes = {
      ...sizes,
      header: 18,
      title: 10,
      tableHeader: 7,
      employeeName: 7,
      employeeDept: 5,
      tableCell: 6,
      timeValue: 6,
      timeLabel: 4,
      durationValue: 6,
      statusText: 5,
      footer: 5
    };
  }

  return sizes;
};

const createStyles = (recordCount: number) => {
  const sizes = calculateFontSizes(recordCount);
  
  return StyleSheet.create({
    page: {
      padding: recordCount > 25 ? 20 : 30,
      backgroundColor: '#ffffff',
      fontFamily: 'Helvetica'
    },
    headerContainer: {
      marginBottom: recordCount > 25 ? 10 : 20,
      borderBottom: 1,
      borderBottomColor: '#2c3e50',
      paddingBottom: recordCount > 25 ? 10 : 15
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    companyInfo: {
      flex: 1
    },
    companyName: {
      fontSize: sizes.header,
      color: '#2c3e50',
      fontWeight: 'bold',
      marginBottom: 2
    },
    title: {
      fontSize: sizes.title,
      color: '#34495e'
    },
    reportInfo: {
      flex: 1,
      alignItems: 'flex-end'
    },
    dateRange: {
      fontSize: sizes.tableCell,
      color: '#7f8c8d',
      marginBottom: 2
    },
    reportMeta: {
      fontSize: sizes.timeLabel,
      color: '#95a5a6'
    },
    tableContainer: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#e0e0e0',
      borderRadius: 4,
      overflow: 'hidden'
    },
    table: {
      width: '100%'
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#2c3e50',
      padding: recordCount > 25 ? '6 4' : '8 6',
      borderBottomWidth: 1,
      borderBottomColor: '#34495e'
    },
    tableHeaderCell: {
      color: '#ffffff',
      fontSize: sizes.tableHeader,
      fontWeight: 'bold',
      textTransform: 'uppercase'
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#ecf0f1',
      minHeight: recordCount > 25 ? 25 : 35,
      padding: recordCount > 25 ? '4 4' : '6 6',
      alignItems: 'center'
    },
    tableRowEven: {
      backgroundColor: '#f8f9fa'
    },
    employeeCell: {
      flexDirection: 'column',
      justifyContent: 'center'
    },
    employeeName: {
      fontSize: sizes.employeeName,
      color: '#2c3e50',
      fontWeight: 'bold'
    },
    employeeDept: {
      fontSize: sizes.employeeDept,
      color: '#7f8c8d'
    },
    timeCell: {
      flexDirection: 'column',
      alignItems: 'center'
    },
    timeValue: {
      fontSize: sizes.timeValue,
      color: '#2c3e50'
    },
    timeLabel: {
      fontSize: sizes.timeLabel,
      color: '#95a5a6',
      textTransform: 'uppercase'
    },
    durationCell: {
      alignItems: 'center',
      backgroundColor: '#f5f6fa',
      borderRadius: 2,
      padding: 2
    },
    durationValue: {
      fontSize: sizes.durationValue,
      color: '#2c3e50',
      fontWeight: 'bold'
    },
    statusBadge: {
      borderRadius: recordCount > 25 ? 8 : 12,
      padding: recordCount > 25 ? '2 4' : '3 6',
      fontSize: sizes.statusText,
      textAlign: 'center',
      textTransform: 'uppercase'
    },
    statusPresent: {
      backgroundColor: '#e8f5e9',
      color: '#2e7d32'
    },
    statusLate: {
      backgroundColor: '#fff3e0',
      color: '#f57c00'
    },
    statusAbsent: {
      backgroundColor: '#ffebee',
      color: '#c62828'
    },
    footer: {
      position: 'absolute',
      bottom: recordCount > 25 ? 15 : 20,
      left: recordCount > 25 ? 20 : 30,
      right: recordCount > 25 ? 20 : 30,
      borderTopWidth: 1,
      borderTopColor: '#ecf0f1',
      paddingTop: recordCount > 25 ? 8 : 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    footerText: {
      fontSize: sizes.footer,
      color: '#95a5a6'
    }
  });
};

interface EnhancedAttendanceReportProps {
  attendanceRecords: Attendance[];
  absentEmployees: Employee[];
  startDate: Date;
  endDate: Date;
}

const EnhancedAttendanceReport: React.FC<EnhancedAttendanceReportProps> = ({
  attendanceRecords,
  startDate,
  endDate
}) => {
  // Create styles based on record count
  const styles = createStyles(attendanceRecords.length);

  const getStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return styles.statusPresent;
      case 'late':
        return styles.statusLate;
      case 'absent':
        return styles.statusAbsent;
      default:
        return {};
    }
  };

  const formatBreakDuration = (duration: string | null) => {
    if (!duration) return '-';
    return duration;
  };

  const formatWorkingHours = (record: Attendance | null) => {
    if (!record) return '-';
    return calculateWorkingTime(record);
  };

  const formatTimeWithLabel = (time: string | null | undefined, label: string) => {
    if (!time) {
      return (
        <View style={styles.timeCell}>
          <Text style={styles.timeValue}>-</Text>
          <Text style={styles.timeLabel}>{label}</Text>
        </View>
      );
    }
    return (
      <View style={styles.timeCell}>
        <Text style={styles.timeValue}>{format(new Date(time), 'HH:mm')}</Text>
        <Text style={styles.timeLabel}>{label}</Text>
      </View>
    );
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Compact Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerTop}>
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>Dutch Activity</Text>
              <Text style={styles.title}>Attendance Report</Text>
            </View>
            <View style={styles.reportInfo}>
              <Text style={styles.dateRange}>
                {format(startDate, 'MMMM d, yyyy')}
                {startDate.toDateString() !== endDate.toDateString() && 
                  ` - ${format(endDate, 'MMMM d, yyyy')}`}
              </Text>
              <Text style={styles.reportMeta}>
                Generated: {format(new Date(), 'MMM d, yyyy HH:mm')}
              </Text>
            </View>
          </View>
        </View>

        {/* Optimized Table */}
        <View style={styles.tableContainer}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Employee</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>First Shift</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Second Shift</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Break</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Hours</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>Late</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Status</Text>
            </View>

            {attendanceRecords.map((record, index) => (
              <View key={index} style={[
                styles.tableRow,
                index % 2 === 0 && styles.tableRowEven
              ]}>
                <View style={[styles.employeeCell, { flex: 1.5 }]}>
                  <Text style={styles.employeeName}>
                    {record.employee_name || 'Unknown'}
                  </Text>
                  <Text style={styles.employeeDept}>
                    {record.employee?.department || '-'}
                  </Text>
                </View>

                <View style={[{ flex: 0.8, flexDirection: 'row', justifyContent: 'space-between' }]}>
                  {formatTimeWithLabel(record.check_in_time, 'In')}
                  {formatTimeWithLabel(record.check_out_time, 'Out')}
                </View>

                <View style={[{ flex: 0.8, flexDirection: 'row', justifyContent: 'space-between' }]}>
                  {formatTimeWithLabel(record.second_check_in_time, 'In')}
                  {formatTimeWithLabel(record.second_check_out_time, 'Out')}
                </View>

                <View style={[styles.durationCell, { flex: 0.5 }]}>
                  <Text style={styles.durationValue}>
                    {formatBreakDuration(record.break_duration)}
                  </Text>
                </View>

                <View style={[styles.durationCell, { flex: 0.5 }]}>
                  <Text style={styles.durationValue}>
                    {formatWorkingHours(record)}
                  </Text>
                </View>

                <View style={[{ flex: 0.4, alignItems: 'center' }]}>
                  <Text style={[
                    styles.timeValue,
                    record.minutes_late && record.minutes_late !== '0h 0m' ? { color: '#e74c3c' } : {}
                  ]}>
                    {record.minutes_late && record.minutes_late !== '0h 0m' ? record.minutes_late : '-'}
                  </Text>
                </View>

                <View style={[{ flex: 0.6, alignItems: 'center' }]}>
                  <Text style={[
                    styles.statusBadge,
                    getStatusStyle(record.status)
                  ]}>
                    {record.status || '-'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Compact Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Dutch Activity QR Attendance System</Text>
          <Text style={styles.footerText}>{format(new Date(), 'yyyy-MM-dd HH:mm')}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default EnhancedAttendanceReport;