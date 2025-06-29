import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { Roster } from '@/integrations/supabase/types';
import { RosterService } from './RosterService';

export class RosterReportService {
  static async generateRosterReport(rosterId: string): Promise<string> {
    try {
      const roster = await RosterService.getRosterById(rosterId);
      if (!roster) {
        throw new Error('Roster not found');
      }

      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Roster Report', 105, 15, { align: 'center' });
      
      // Add basic info
      doc.setFontSize(12);
      doc.text(`Report Generated: ${format(new Date(), 'PPpp')}`, 20, 30);
      doc.text(`Employee ID: ${roster.employee_id}`, 20, 40);
      doc.text(`Department: ${roster.department}`, 20, 50);
      doc.text(`Position: ${roster.position}`, 20, 60);
      
      // Add dates and status
      doc.text(`Start Date: ${format(new Date(roster.start_date), 'PP')}`, 20, 70);
      doc.text(`End Date: ${format(new Date(roster.end_date), 'PP')}`, 20, 80);
      doc.text(`Status: ${roster.status}`, 20, 90);
      
      // Add assignment and completion times if available
      if (roster.assignment_time) {
        doc.text(`Assigned: ${format(new Date(roster.assignment_time), 'PPpp')}`, 20, 100);
      }
      if (roster.completion_time) {
        doc.text(`Completed: ${format(new Date(roster.completion_time), 'PPpp')}`, 20, 110);
      }

      // Add shift pattern table
      const tableData = roster.shift_pattern.map(shift => [
        format(new Date(shift.date), 'PP'),
        shift.shift.charAt(0).toUpperCase() + shift.shift.slice(1)
      ]);

      doc.autoTable({
        startY: roster.completion_time ? 120 : 100,
        head: [['Date', 'Shift']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 10 },
      });

      // Save the PDF
      const pdfBase64 = doc.output('datauristring');
      return pdfBase64;
    } catch (error) {
      console.error('Error generating roster report:', error);
      throw error;
    }
  }

  static getWhatsAppShareLink(rosterId: string, employeeName: string): string {
    const message = encodeURIComponent(
      `*Roster Report*\n` +
      `Employee: ${employeeName}\n` +
      `View the complete report here: ${window.location.origin}/roster/${rosterId}`
    );
    return `https://wa.me/?text=${message}`;
  }

  static async markRosterAsCompleted(rosterId: string): Promise<void> {
    try {
      await RosterService.updateRoster(rosterId, {
        status: 'completed',
        completion_time: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking roster as completed:', error);
      throw error;
    }
  }
} 