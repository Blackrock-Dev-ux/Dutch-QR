import { Attendance } from '@/types';
import { format } from 'date-fns';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface ExportOptions {
  format: 'csv' | 'pdf' | 'xlsx' | 'json' | 'zip';
  includeHeaders: boolean;
  dateFormat: string;
  timeFormat: string;
  groupByDepartment: boolean;
  includeSummary: boolean;
  filterCriteria?: {
    startDate?: string;
    endDate?: string;
    department?: string;
    status?: string[];
  };
}

export interface ExportSummary {
  totalRecords: number;
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  onTimeCount: number;
  averageWorkingHours: number;
  departmentBreakdown: { [key: string]: number };
  exportDate: string;
  dateRange: string;
}

class AttendanceExportService {
  private defaultOptions: ExportOptions = {
    format: 'csv',
    includeHeaders: true,
    dateFormat: 'yyyy-MM-dd',
    timeFormat: 'HH:mm:ss',
    groupByDepartment: false,
    includeSummary: true
  };

  public async exportAttendanceData(
    records: Attendance[], 
    options: Partial<ExportOptions> = {}
  ): Promise<void> {
    const finalOptions = { ...this.defaultOptions, ...options };
    const filteredRecords = this.filterRecords(records, finalOptions.filterCriteria);

    switch (finalOptions.format) {
      case 'csv':
        this.exportToCSV(filteredRecords, finalOptions);
        break;
      case 'xlsx':
        await this.exportToExcel(filteredRecords, finalOptions);
        break;
      case 'json':
        this.exportToJSON(filteredRecords, finalOptions);
        break;
      case 'zip':
        await this.exportToZip(filteredRecords, finalOptions);
        break;
      default:
        throw new Error(`Unsupported export format: ${finalOptions.format}`);
    }
  }

  private filterRecords(records: Attendance[], criteria?: ExportOptions['filterCriteria']): Attendance[] {
    if (!criteria) return records;

    return records.filter(record => {
      // Date filtering
      if (criteria.startDate || criteria.endDate) {
        const recordDate = new Date(record.date || record.first_check_in_time);
        
        if (criteria.startDate && recordDate < new Date(criteria.startDate)) {
          return false;
        }
        
        if (criteria.endDate) {
          const endDate = new Date(criteria.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (recordDate > endDate) {
            return false;
          }
        }
      }

      // Department filtering
      if (criteria.department && criteria.department !== 'all') {
        const recordDept = record.employee?.department?.toLowerCase().trim();
        const filterDept = criteria.department.toLowerCase().trim();
        if (recordDept !== filterDept) {
          return false;
        }
      }

      // Status filtering
      if (criteria.status && criteria.status.length > 0) {
        if (!criteria.status.includes(record.status || '')) {
          return false;
        }
      }

      return true;
    });
  }

  private generateSummary(records: Attendance[], options: ExportOptions): ExportSummary {
    const safeRecords = records || [];
    const totalRecords = safeRecords.length;
    const uniqueEmployees = new Set(safeRecords.map(r => r.employee_id || r.employee_name)).size;
    
    const presentCount = safeRecords.filter(r => r.status === 'present' || r.status === 'checked-out').length;
    const absentCount = totalRecords - presentCount;
    const lateCount = safeRecords.filter(r => (r.minutes_late || 0) > 0).length;
    const onTimeCount = totalRecords - lateCount;

    const totalWorkingHours = safeRecords.reduce((sum, record) => {
      return sum + (record.actual_hours || 0);
    }, 0);
    const averageWorkingHours = totalRecords > 0 ? totalWorkingHours / totalRecords : 0;

    const departmentBreakdown = safeRecords.reduce((acc, record) => {
      const dept = record.employee?.department || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const dates = records.map(r => new Date(r.date || r.first_check_in_time));
    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    return {
      totalRecords,
      totalEmployees: uniqueEmployees,
      presentCount,
      absentCount,
      lateCount,
      onTimeCount,
      averageWorkingHours,
      departmentBreakdown,
      exportDate: format(new Date(), options.dateFormat),
      dateRange: `${format(startDate, options.dateFormat)} - ${format(endDate, options.dateFormat)}`
    };
  }

  private exportToCSV(records: Attendance[], options: ExportOptions): void {
    const headers = [
      'Date',
      'Employee Name',
      'Department',
      'First Check-In',
      'First Check-Out',
      'Second Check-In',
      'Second Check-Out',
      'Break Duration (minutes)',
      'Working Duration (hours)',
      'Status',
      'Minutes Late',
      'Early Departure (minutes)',
      'Compliance Rate (%)'
    ];

    const rows = records.map(record => [
      record.date || format(new Date(record.first_check_in_time), options.dateFormat),
      record.employee_name || 'Unknown',
      record.employee?.department || 'Unassigned',
      record.first_check_in_time ? format(new Date(record.first_check_in_time), options.timeFormat) : '',
      record.first_check_out_time ? format(new Date(record.first_check_out_time), options.timeFormat) : '',
      record.second_check_in_time ? format(new Date(record.second_check_in_time), options.timeFormat) : '',
      record.second_check_out_time ? format(new Date(record.second_check_out_time), options.timeFormat) : '',
      record.break_duration || 0,
      record.actual_hours?.toFixed(2) || '0.00',
      record.status || '',
      record.minutes_late || 0,
      record.early_departure_minutes || 0,
      record.compliance_rate?.toFixed(1) || '0.0'
    ]);

    let csvContent = '';
    
    if (options.includeHeaders) {
      csvContent += headers.join(',') + '\n';
    }
    
    if (options.groupByDepartment) {
      const groupedRecords = this.groupRecordsByDepartment(records);
      for (const [department, deptRecords] of Object.entries(groupedRecords)) {
        csvContent += `\n"Department: ${department}"\n`;
        deptRecords.forEach((record, index) => {
          const row = rows[records.indexOf(record)];
          csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });
      }
    } else {
      rows.forEach(row => {
        csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
      });
    }

    if (options.includeSummary) {
      const summary = this.generateSummary(records, options);
      csvContent += '\n"Summary Report"\n';
      csvContent += `"Total Records","${summary.totalRecords}"\n`;
      csvContent += `"Total Employees","${summary.totalEmployees}"\n`;
      csvContent += `"Present Count","${summary.presentCount}"\n`;
      csvContent += `"Late Count","${summary.lateCount}"\n`;
      csvContent += `"Average Working Hours","${summary.averageWorkingHours.toFixed(2)}"\n`;
      csvContent += `"Export Date","${summary.exportDate}"\n`;
      csvContent += `"Date Range","${summary.dateRange}"\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = this.generateFilename('csv', options);
    saveAs(blob, filename);
  }

  private async exportToExcel(records: Attendance[], options: ExportOptions): Promise<void> {
    // Note: This is a simplified implementation. For production, you'd want to use a library like SheetJS
    const csvData = this.prepareCSVData(records, options);
    const blob = new Blob([csvData], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const filename = this.generateFilename('xlsx', options);
    saveAs(blob, filename);
  }

  private exportToJSON(records: Attendance[], options: ExportOptions): void {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalRecords: records.length,
        dateRange: options.filterCriteria ? 
          `${options.filterCriteria.startDate || 'N/A'} - ${options.filterCriteria.endDate || 'N/A'}` : 
          'All dates',
        department: options.filterCriteria?.department || 'All departments'
      },
      summary: options.includeSummary ? this.generateSummary(records, options) : null,
      records: records.map(record => ({
        ...record,
        formatted_first_check_in: record.first_check_in_time ? 
          format(new Date(record.first_check_in_time), `${options.dateFormat} ${options.timeFormat}`) : null,
        formatted_first_check_out: record.first_check_out_time ? 
          format(new Date(record.first_check_out_time), `${options.dateFormat} ${options.timeFormat}`) : null,
        formatted_second_check_in: record.second_check_in_time ? 
          format(new Date(record.second_check_in_time), `${options.dateFormat} ${options.timeFormat}`) : null,
        formatted_second_check_out: record.second_check_out_time ? 
          format(new Date(record.second_check_out_time), `${options.dateFormat} ${options.timeFormat}`) : null,
      }))
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const filename = this.generateFilename('json', options);
    saveAs(blob, filename);
  }

  private async exportToZip(records: Attendance[], options: ExportOptions): Promise<void> {
    const zip = new JSZip();

    // Add CSV file
    const csvData = this.prepareCSVData(records, options);
    zip.file(`attendance_data.csv`, csvData);

    // Add JSON file
    const jsonData = this.prepareJSONData(records, options);
    zip.file(`attendance_data.json`, jsonData);

    // Add summary report
    if (options.includeSummary) {
      const summary = this.generateSummary(records, options);
      const summaryText = this.formatSummaryAsText(summary);
      zip.file(`summary_report.txt`, summaryText);
    }

    // Add department-wise files if grouping is enabled
    if (options.groupByDepartment) {
      const groupedRecords = this.groupRecordsByDepartment(records);
      const deptFolder = zip.folder('departments');
      
      for (const [department, deptRecords] of Object.entries(groupedRecords)) {
        const deptCSV = this.prepareCSVData(deptRecords, options);
        deptFolder?.file(`${department.replace(/[^a-zA-Z0-9]/g, '_')}.csv`, deptCSV);
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const filename = this.generateFilename('zip', options);
    saveAs(content, filename);
  }

  private prepareCSVData(records: Attendance[], options: ExportOptions): string {
    // Simplified CSV preparation - you can expand this
    const headers = ['Date', 'Employee', 'Department', 'Check-In', 'Check-Out', 'Status'];
    const rows = records.map(record => [
      record.date || format(new Date(record.first_check_in_time), options.dateFormat),
      record.employee_name || 'Unknown',
      record.employee?.department || 'Unassigned',
      record.first_check_in_time ? format(new Date(record.first_check_in_time), options.timeFormat) : '',
      record.first_check_out_time ? format(new Date(record.first_check_out_time), options.timeFormat) : '',
      record.status || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
  }

  private prepareJSONData(records: Attendance[], options: ExportOptions): string {
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalRecords: records.length
      },
      records
    };
    return JSON.stringify(exportData, null, 2);
  }

  private formatSummaryAsText(summary: ExportSummary): string {
    return `
ATTENDANCE SUMMARY REPORT
========================

Export Date: ${summary.exportDate}
Date Range: ${summary.dateRange}

OVERVIEW
--------
Total Records: ${summary.totalRecords}
Total Employees: ${summary.totalEmployees}
Present Count: ${summary.presentCount}
Absent Count: ${summary.absentCount}
Late Count: ${summary.lateCount}
On Time Count: ${summary.onTimeCount}
Average Working Hours: ${summary.averageWorkingHours.toFixed(2)}

DEPARTMENT BREAKDOWN
-------------------
${Object.entries(summary.departmentBreakdown)
  .map(([dept, count]) => `${dept}: ${count}`)
  .join('\n')}
    `.trim();
  }

  private groupRecordsByDepartment(records: Attendance[]): { [key: string]: Attendance[] } {
    return (records || []).reduce((groups, record) => {
      const department = record.employee?.department || 'Unassigned';
      if (!groups[department]) {
        groups[department] = [];
      }
      groups[department].push(record);
      return groups;
    }, {} as { [key: string]: Attendance[] });
  }

  private generateFilename(format: string, options: ExportOptions): string {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const department = options.filterCriteria?.department && options.filterCriteria.department !== 'all' 
      ? `_${options.filterCriteria.department}` 
      : '';
    
    return `attendance_export${department}_${timestamp}.${format}`;
  }
}

// Export singleton instance
export const attendanceExportService = new AttendanceExportService();

// Export types and service
export default attendanceExportService;
