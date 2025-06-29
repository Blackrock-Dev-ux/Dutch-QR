import React from 'react';
import AttendanceBotCard from '@/components/AttendanceBotCard';
import AttendanceStats from '@/components/AttendanceStats';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Dutch Trails Management System
          </h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Streamline your attendance tracking and employee management with our integrated solutions
          </p>
        </div>

        {/* Attendance Stats */}
        <div className="mb-8">
          <AttendanceStats />
        </div>

        {/* Main Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Roster Management Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-black/20">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Roster Management</CardTitle>
                    <CardDescription className="text-sm">
                      Manage employee attendance
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => navigate('/roster')}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure and monitor the attendance roster with QR code tracking
                  </p>
                </div>
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate('/roster')}
                >
                  View Roster
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Gate Pass System Card */}
          <Card className="group hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-black/20">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <svg 
                      className="h-6 w-6 text-green-600 dark:text-green-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div>
                    <CardTitle className="text-xl">Gate Pass System</CardTitle>
                    <CardDescription className="text-sm">
                      Manage access control
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => navigate('/gate-pass')}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Configure and monitor the gate pass system with QR code verification
                  </p>
                </div>
                <Button 
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate('/gate-pass')}
                >
                  Manage Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Attendance BOT Card */}
          <AttendanceBotCard />
        </div>
      </div>
    </div>
  );
};

export default Home; 