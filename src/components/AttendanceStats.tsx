import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, LogOut, UserX, Clock, Timer, AlertTriangle, Briefcase, Share2, Loader2, CheckCircle2, BarChart2, RefreshCcw } from 'lucide-react';
import { getTodayAttendanceSummary, autoShareAttendanceSummary } from '@/utils/attendanceUtils';
import { toast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface DetailedStats {
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
}

interface PresenceBreakdown {
  currentlyPresent: number;
  lateButPresent: number;
  checkedOut: number;
  onTimeArrivals: number;
  absent: number;
}

interface AttendanceData {
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
  detailed: DetailedStats;
  presenceBreakdown: PresenceBreakdown;
}

const AttendanceStats: React.FC = () => {
  const [activeView, setActiveView] = useState<'standard' | 'detailed' | 'rates'>('standard');
  const [sharing, setSharing] = useState(false);
  const [stats, setStats] = useState<AttendanceData>({
    totalEmployees: 0,
    presentCount: 0,
    lateCount: 0,
    absentCount: 0,
    checkedOutCount: 0,
    onTime: 0,
    stillWorking: 0,
    currentPresenceRate: '0.0',
    totalPresentRate: '0.0',
    onTimeRate: '0.0',
    lateRate: '0.0',
    absentRate: '0.0',
    detailed: {
      onTime: 0,
      lateArrivals: 0,
      veryLate: 0,
      halfDay: 0,
      earlyDepartures: 0,
      overtime: 0,
      regularHours: 0,
      attendanceRate: '0.0',
      efficiencyRate: '0.0',
      punctualityRate: '0.0'
    },
    presenceBreakdown: {
      currentlyPresent: 0,
      lateButPresent: 0,
      checkedOut: 0,
      onTimeArrivals: 0,
      absent: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [lastPresentCount, setLastPresentCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshStats = useCallback(async () => {
      try {
      setLoading(true);
        const data = await getTodayAttendanceSummary();
      setStats(data);
        setLastPresentCount(data.presentCount);
      } catch (error) {
        console.error('Error fetching attendance stats:', error);
      toast({
        title: "Error",
        description: "Failed to update attendance statistics",
        variant: "destructive",
      });
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    refreshStats();

    const interval = setInterval(refreshStats, 30 * 1000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        () => {
          refreshStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const whatsappUrl = await autoShareAttendanceSummary();
      
      if (!whatsappUrl) {
        toast({
          title: "Sharing Failed",
          description: "Please check your WhatsApp settings and try again.",
          variant: "destructive",
        });
        return;
      }

      window.open(whatsappUrl, '_blank');
      
      toast({
        title: "Report Ready",
        description: "WhatsApp has been opened with the detailed report.",
      });
    } catch (error) {
      toast({
        title: "Sharing Failed",
        description: "An error occurred while preparing the report.",
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading attendance statistics...</p>
        </div>
      </div>
    );
  }

  const standardCards = [
    {
      title: 'Total Employees',
      value: stats?.totalEmployees || 0,
      icon: Users,
      description: 'Active employees in system',
      color: 'text-blue-600'
    },
    {
      title: 'Present Today',
      value: (stats?.presentCount || 0) + (stats?.checkedOutCount || 0),
      icon: UserCheck,
      description: `Present Rate: ${stats?.totalPresentRate || '0.0'}%`,
      color: 'text-green-600',
      highlight: stats?.presentCount > lastPresentCount
    },
    {
      title: 'Checked Out',
      value: stats?.checkedOutCount || 0,
      icon: LogOut,
      description: `Still Working: ${stats?.stillWorking || 0}`,
      color: 'text-orange-600'
    },
    {
      title: 'Absent Today',
      value: stats?.absentCount || 0,
      icon: UserX,
      description: `Absent Rate: ${stats?.absentRate || '0.0'}%`,
      color: `text-${stats?.absentCount ? 'red' : 'gray'}-600`
    }
  ];

  const detailedCards = [
    {
      title: 'On Time',
      value: stats?.presenceBreakdown.onTimeArrivals || 0,
      icon: Clock,
      description: `Punctuality Rate: ${stats?.onTimeRate || '0.0'}%`,
      color: 'text-green-600'
    },
    {
      title: 'Late But Present',
      value: stats?.presenceBreakdown.lateButPresent || 0,
      icon: AlertTriangle,
      description: `Late Rate: ${stats?.lateRate || '0.0'}%`,
      color: 'text-yellow-600'
    },
    {
      title: 'Currently Present',
      value: stats?.presenceBreakdown.currentlyPresent || 0,
      icon: Briefcase,
      description: `Current Rate: ${stats?.currentPresenceRate || '0.0'}%`,
      color: 'text-blue-600'
    },
    {
      title: 'Total Present',
      value: (stats?.presenceBreakdown.currentlyPresent || 0) + 
             (stats?.presenceBreakdown.lateButPresent || 0) + 
             (stats?.presenceBreakdown.checkedOut || 0),
      icon: Users,
      description: `Total Rate: ${stats?.totalPresentRate || '0.0'}%`,
      color: 'text-green-600'
    }
  ];

  const rateCards = [
    {
      title: 'Attendance Rate',
      value: `${stats?.totalPresentRate || '0.0'}%`,
      icon: Users,
      description: `${(stats?.presenceBreakdown.currentlyPresent || 0) + 
                    (stats?.presenceBreakdown.lateButPresent || 0) + 
                    (stats?.presenceBreakdown.checkedOut || 0)} of ${stats?.totalEmployees || 0}`,
      color: 'text-blue-600'
    },
    {
      title: 'Punctuality Rate',
      value: `${stats?.onTimeRate || '0.0'}%`,
      icon: Clock,
      description: `${stats?.presenceBreakdown.onTimeArrivals || 0} arrived on time`,
      color: 'text-green-600'
    },
    {
      title: 'Current Presence',
      value: `${stats?.currentPresenceRate || '0.0'}%`,
      icon: UserCheck,
      description: `${stats?.presenceBreakdown.currentlyPresent || 0} currently in office`,
      color: 'text-orange-600'
    },
    {
      title: 'Efficiency Rate',
      value: `${stats?.detailed.efficiencyRate || '0.0'}%`,
      icon: Briefcase,
      description: `Based on working hours`,
      color: 'text-purple-600'
    }
  ];

  const currentCards = {
    standard: standardCards,
    detailed: detailedCards,
    rates: rateCards
  }[activeView];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Today's Attendance</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="flex items-center gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeView} onValueChange={(value: any) => setActiveView(value)}>
        <TabsList>
          <TabsTrigger value="standard">Standard View</TabsTrigger>
          <TabsTrigger value="detailed">Detailed View</TabsTrigger>
          <TabsTrigger value="rates">Rates & Percentages</TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                <UserCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((stats?.presentCount || 0) + (stats?.checkedOutCount || 0))}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {stats?.totalEmployees || 0} total employees
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.lateCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.lateRate || '0'}% of present employees
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
                <LogOut className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.checkedOutCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {((stats?.checkedOutCount || 0) / (stats?.totalEmployees || 1) * 100).toFixed(1)}% completion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Absent</CardTitle>
                <UserX className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.absentCount || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.absentRate || '0'}% absence rate
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On Time Arrivals</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.detailed.onTime || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.onTimeRate || '0'}% punctuality rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Working Overtime</CardTitle>
                <Clock className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.detailed.overtime || 0}</div>
                <p className="text-xs text-muted-foreground">
                  employees working >8 hours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Early Departures</CardTitle>
                <LogOut className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.detailed.earlyDepartures || 0}</div>
                <p className="text-xs text-muted-foreground">
                  left before shift end
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Rate</CardTitle>
                <BarChart2 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalPresentRate || '0'}%</div>
                <p className="text-xs text-muted-foreground">
                  overall attendance rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Efficiency Rate</CardTitle>
                <Timer className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.detailed.efficiencyRate || '0'}%</div>
                <p className="text-xs text-muted-foreground">
                  based on punctuality and presence
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Current Presence</CardTitle>
                <Users className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.currentPresenceRate || '0'}%</div>
                <p className="text-xs text-muted-foreground">
                  currently in office
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-2"
        >
          {sharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4" />
          )}
          Share Report
        </Button>
      </div>
    </div>
  );
};

export default AttendanceStats; 