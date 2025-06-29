
import React from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TimeSelectorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const TimeSelector: React.FC<TimeSelectorProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  // Handle time input change - ensure valid format
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value;
    onChange(timeValue);
  };

  // Handle direct time selection
  const handleQuickTimeSelect = (hours: number, minutes: number) => {
    // Format hours and minutes with leading zeros
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    onChange(`${formattedHours}:${formattedMinutes}`);
  };

  // Common time buttons
  const timePresets = [
    { label: 'Now', onClick: () => {
      const now = new Date();
      handleQuickTimeSelect(now.getHours(), now.getMinutes());
    }},
    { label: '+1h', onClick: () => {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      handleQuickTimeSelect(now.getHours(), now.getMinutes());
    }},
    { label: '+2h', onClick: () => {
      const now = new Date();
      now.setHours(now.getHours() + 2);
      handleQuickTimeSelect(now.getHours(), now.getMinutes());
    }},
    { label: '+4h', onClick: () => {
      const now = new Date();
      now.setHours(now.getHours() + 4);
      handleQuickTimeSelect(now.getHours(), now.getMinutes());
    }},
  ];

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center">
        <div className="relative flex-grow">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            <Clock className="w-4 h-4" />
          </div>
          <Input
            id={id}
            type="time"
            value={value}
            onChange={handleTimeChange}
            disabled={disabled}
            className="pl-9"
          />
        </div>
      </div>
      
      <div className="flex mt-2 space-x-2">
        {timePresets.map((preset, index) => (
          <button
            key={index}
            type="button"
            onClick={preset.onClick}
            disabled={disabled}
            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
};
