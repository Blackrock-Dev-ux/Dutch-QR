import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import AutomatedAttendanceBot from '@/components/AutomatedAttendanceBot';
import { 
  Bot, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  BarChart2,
  Settings,
  Bell
} from 'lucide-react';
import { getTodayAttendanceSummary } from '@/utils/attendanceUtils';

interface AttendanceSummary {
  totalEmployees: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  checkedOutCount: number;
  onTime: number;
  stillWorking: number;
  lateRate: string;
  absentRate: string;
  presentRate: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const data = await getTodayAttendanceSummary();
        setSummary(data);
      } catch (error) {
        console.error('Error fetching attendance summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
    
    // Refresh data every 30 seconds for more real-time updates
    const interval = setInterval(fetchSummary, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dutch Trails Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Welcome to your attendance management system
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Attendance</CardTitle>
              <Calendar className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary ? `${summary.presentCount}/${summary.totalEmployees}` : '0/0'}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Present / Total Employees
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.lateCount || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Employees arrived late
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.absentCount || 0}</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Employees not present
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <BarChart2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.presentRate || '0'}%</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Overall attendance rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dutch Trails BOT Section */}
          <div className="lg:col-span-2">
            <Card className="bg-white/50 dark:bg-black/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  Dutch Trails BOT
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AutomatedAttendanceBot />
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Section */}
          <div className="space-y-6">
            <Card className="bg-white/50 dark:bg-black/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-yellow-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  onClick={() => navigate('/attendance')}
                >
                  <span>View Attendance</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  onClick={() => navigate('/employees')}
                >
                  <span>Manage Employees</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  onClick={() => navigate('/reports')}
                >
                  <span>Generate Reports</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-white/50 dark:bg-black/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Attendance Summary Sent</p>
                    <p className="text-xs text-gray-500">Today, 18:00</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">New Employee Added</p>
                    <p className="text-xs text-gray-500">Yesterday, 15:30</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium">Late Arrival Alert</p>
                    <p className="text-xs text-gray-500">Yesterday, 09:15</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 