import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bot, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const AttendanceBotCard: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-black/20 overflow-hidden">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <Bot className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Attendance BOT</CardTitle>
              <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                Automated reporting system
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => navigate('/bot')}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Features</h3>
            <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              <li className="flex items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mr-2"></span>
                WhatsApp Integration
              </li>
              <li className="flex items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mr-2"></span>
                Automated Reports
              </li>
              <li className="flex items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mr-2"></span>
                Real-time Updates
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</h3>
            <div className="flex items-center space-x-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Active</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Next report scheduled for 18:00
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button 
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => navigate('/bot')}
          >
            Configure BOT
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceBotCard; 