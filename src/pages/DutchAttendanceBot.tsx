import React from 'react';
import AutomatedAttendanceBot from '@/components/AutomatedAttendanceBot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Settings, Bell, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const DutchAttendanceBot: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Bot className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dutch Trails BOT</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Automated attendance reporting and management system
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active BOT</CardTitle>
              <Bot className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Enabled</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Automated reporting is active
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Report</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18:00</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Daily automated report
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admin Numbers</CardTitle>
              <Users className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Configured admin numbers
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notifications</CardTitle>
              <Bell className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Enabled</div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Error notifications active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main BOT Card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <AutomatedAttendanceBot />
          </div>
          
          {/* Additional Info Card */}
          <Card className="bg-white/50 dark:bg-black/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-600" />
                About Dutch Trails BOT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Features</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Automated daily attendance reports</li>
                  <li>Customizable sharing schedule</li>
                  <li>Multiple admin support</li>
                  <li>Error notifications</li>
                  <li>Retry mechanism for failed sends</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">How It Works</h3>
                <ol className="list-decimal list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>Configure admin numbers</li>
                  <li>Set sharing time</li>
                  <li>Enable automated sharing</li>
                  <li>Receive daily reports via WhatsApp</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Requirements</h3>
                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <li>WhatsApp Web access</li>
                  <li>Valid admin phone numbers</li>
                  <li>Browser pop-ups enabled</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DutchAttendanceBot; 