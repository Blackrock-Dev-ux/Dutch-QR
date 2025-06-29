import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX, Play, TestTube } from 'lucide-react';
import { attendanceSpeechService } from '@/utils/speechUtils';
import { useToast } from '@/components/ui/use-toast';

interface VoiceSettingsProps {
  className?: string;
}

export const VoiceSettings: React.FC<VoiceSettingsProps> = ({ className }) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [rate, setRate] = useState([1.0]);
  const [pitch, setPitch] = useState([1.0]);
  const [volume, setVolume] = useState([0.8]);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const voices = attendanceSpeechService.getAvailableVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoice) {
        setSelectedVoice(voices[0].name);
      }
    };

    loadVoices();
    
    // Handle voice loading completion
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('attendanceVoiceSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setIsEnabled(settings.enabled ?? true);
        setSelectedVoice(settings.voice ?? '');
        setRate([settings.rate ?? 1.0]);
        setPitch([settings.pitch ?? 1.0]);
        setVolume([settings.volume ?? 0.8]);
      } catch (error) {
        console.warn('Failed to load voice settings:', error);
      }
    }
  }, [selectedVoice]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const settings = {
      enabled: isEnabled,
      voice: selectedVoice,
      rate: rate[0],
      pitch: pitch[0],
      volume: volume[0]
    };
    localStorage.setItem('attendanceVoiceSettings', JSON.stringify(settings));
  }, [isEnabled, selectedVoice, rate, pitch, volume]);

  const handleTestVoice = async () => {
    if (!attendanceSpeechService.isSupported()) {
      toast({
        title: 'Not Supported',
        description: 'Speech synthesis is not supported in this browser',
        variant: 'destructive'
      });
      return;
    }

    setIsTestingVoice(true);
    try {
      const voice = availableVoices.find(v => v.name === selectedVoice);
      await attendanceSpeechService.speak(
        'This is a test of the voice announcement system. Check-in successful for John Doe. You are on time.',
        {
          voice,
          rate: rate[0],
          pitch: pitch[0],
          volume: volume[0]
        }
      );
      toast({
        title: 'Voice Test',
        description: 'Voice test completed successfully',
      });
    } catch (error) {
      console.error('Voice test failed:', error);
      toast({
        title: 'Voice Test Failed',
        description: 'Could not play voice test',
        variant: 'destructive'
      });
    } finally {
      setIsTestingVoice(false);
    }
  };

  const handleStopSpeech = () => {
    attendanceSpeechService.stop();
    setIsTestingVoice(false);
  };

  const resetToDefaults = () => {
    setIsEnabled(true);
    setRate([1.0]);
    setPitch([1.0]);
    setVolume([0.8]);
    if (availableVoices.length > 0) {
      setSelectedVoice(availableVoices[0].name);
    }
    toast({
      title: 'Settings Reset',
      description: 'Voice settings have been reset to defaults'
    });
  };

  if (!attendanceSpeechService.isSupported()) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VolumeX className="h-5 w-5" />
            Voice Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <VolumeX className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Voice notifications are not supported in this browser.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          Voice Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <Label htmlFor="voice-enabled" className="text-sm font-medium">
            Enable Voice Feedback
          </Label>
          <Switch
            id="voice-enabled"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        {isEnabled && (
          <>
            {/* Voice Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Voice</Label>
              <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speech Rate */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Speech Rate: {rate[0].toFixed(1)}x
              </Label>
              <Slider
                value={rate}
                onValueChange={setRate}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Pitch */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Pitch: {pitch[0].toFixed(1)}
              </Label>
              <Slider
                value={pitch}
                onValueChange={setPitch}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Volume: {Math.round(volume[0] * 100)}%
              </Label>
              <Slider
                value={volume}
                onValueChange={setVolume}
                min={0.1}
                max={1.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Test and Control Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleTestVoice}
                disabled={isTestingVoice}
                className="flex-1"
              >
                {isTestingVoice ? (
                  <>
                    <TestTube className="mr-2 h-4 w-4 animate-pulse" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Test Voice
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleStopSpeech}
                variant="outline"
                disabled={!isTestingVoice}
              >
                Stop
              </Button>
              
              <Button
                onClick={resetToDefaults}
                variant="outline"
              >
                Reset
              </Button>
            </div>
          </>
        )}

        {/* Information */}
        <div className="text-sm text-muted-foreground pt-4 border-t">
          <p>
            Voice notifications will announce attendance results after QR code scanning,
            including employee name, timing status, and compliance information.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceSettings;
