import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import AutomatedAttendanceBot from '@/components/AutomatedAttendanceBot';
import { Bot, Settings, Clock, Users, Calendar, Bell } from 'lucide-react';

const AttendanceBotDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8 text-purple-600" />
            Dutch Attendance BOT
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated attendance monitoring and reporting system
          </p>
        </div>
        <Button variant="outline" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Quick Stats */}
        <Card className="col-span-1 bg-purple-50 dark:bg-purple-900/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Today's Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold">98%</p>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Reports Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* BOT Status */}
        <Card className="col-span-1 bg-green-50 dark:bg-green-900/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bot className="h-4 w-4 text-green-600" />
              BOT Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Active</span>
                <Switch defaultChecked />
              </div>
              <p className="text-sm text-muted-foreground">
                Next report in: 2h 15m
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card className="col-span-1 bg-blue-50 dark:bg-blue-900/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Recipients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-bold">8</p>
                <p className="text-sm text-muted-foreground">Active Admins</p>
              </div>
              <Button variant="outline" size="sm" className="w-full">
                Manage
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Schedule */}
        <Card className="col-span-1 bg-orange-50 dark:bg-orange-900/20">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Auto-share</span>
                <Switch defaultChecked />
              </div>
              <Input type="time" defaultValue="18:00" className="w-full" />
            </div>
          </CardContent>
        </Card>

        {/* BOT Configuration Tabs */}
        <Card className="col-span-1 md:col-span-4">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 w-full md:w-[400px]">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="mt-6">
                <AutomatedAttendanceBot />
              </TabsContent>
              
              <TabsContent value="settings" className="mt-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Notification Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notification Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Daily Summary</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Late Alerts</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Absence Alerts</Label>
                        <Switch defaultChecked />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Report Settings */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Report Settings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Report Format</Label>
                        <select 
                          className="w-full p-2 border rounded-md"
                          aria-label="Select report format"
                        >
                          <option>Detailed</option>
                          <option>Summary</option>
                          <option>Compact</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Time Zone</Label>
                        <select 
                          className="w-full p-2 border rounded-md"
                          aria-label="Select time zone"
                        >
                          <option>Asia/Colombo (GMT+5:30)</option>
                          <option>UTC</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="logs" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Logs</CardTitle>
                    <CardDescription>Recent BOT activities and reports</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">Daily Report Sent</p>
                            <p className="text-sm text-muted-foreground">Today at 6:00 PM</p>
                          </div>
                          <Button variant="ghost" size="sm">View</Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AttendanceBotDashboard; 