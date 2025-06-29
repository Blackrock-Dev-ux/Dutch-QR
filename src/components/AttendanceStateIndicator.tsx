import React from 'react';
import { Card, CardContent } from './ui/card';
import { Clock, LogIn, LogOut } from 'lucide-react';

interface AttendanceStateIndicatorProps {
  currentState: 'not_checked_in' | 'first_checked_in' | 'first_checked_out' | 'second_checked_in' | 'second_checked_out';
}

const stateConfig = {
  not_checked_in: {
    message: 'Ready for First Check-In',
    nextAction: 'First Check-In',
    icon: LogIn,
    color: 'text-blue-500'
  },
  first_checked_in: {
    message: 'First Session Active',
    nextAction: 'First Check-Out',
    icon: Clock,
    color: 'text-green-500'
  },
  first_checked_out: {
    message: 'First Session Complete',
    nextAction: 'Second Check-In',
    icon: LogIn,
    color: 'text-orange-500'
  },
  second_checked_in: {
    message: 'Second Session Active',
    nextAction: 'Second Check-Out',
    icon: Clock,
    color: 'text-green-500'
  },
  second_checked_out: {
    message: 'All Sessions Complete',
    nextAction: 'Done for Today',
    icon: LogOut,
    color: 'text-purple-500'
  }
};

export const AttendanceStateIndicator: React.FC<AttendanceStateIndicatorProps> = ({ currentState }) => {
  const config = stateConfig[currentState];
  const Icon = config.icon;

  return (
    <Card className="w-full max-w-sm mx-auto mb-4">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{config.message}</p>
            <h3 className="text-lg font-semibold mt-1">Next: {config.nextAction}</h3>
          </div>
          <Icon className={`h-8 w-8 ${config.color}`} />
        </div>
      </CardContent>
    </Card>
  );
}; 