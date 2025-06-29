// Voice-to-Speech Utility for Attendance Feedback
export interface SpeechOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export class AttendanceSpeechService {
  private synth: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private defaultOptions: SpeechOptions = {
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
    lang: 'en-US'
  };

  constructor() {
    this.synth = window.speechSynthesis;
    this.loadVoices();
    
    // Handle voice loading asynchronously
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  private loadVoices(): void {
    this.voices = this.synth.getVoices();
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices.filter(voice => voice.lang.startsWith('en'));
  }

  public async speak(text: string, options: Partial<SpeechOptions> = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }

      // Cancel any ongoing speech
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const finalOptions = { ...this.defaultOptions, ...options };

      // Set voice
      if (finalOptions.voice) {
        utterance.voice = finalOptions.voice;
      } else {
        // Use default English voice
        const englishVoice = this.voices.find(voice => 
          voice.lang.startsWith('en') && voice.default
        ) || this.voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }

      utterance.rate = finalOptions.rate!;
      utterance.pitch = finalOptions.pitch!;
      utterance.volume = finalOptions.volume!;
      utterance.lang = finalOptions.lang!;

      utterance.onend = () => resolve();
      utterance.onerror = (error) => reject(error);

      this.synth.speak(utterance);
    });
  }

  private getStoredSettings(): SpeechOptions {
    try {
      const stored = localStorage.getItem('attendanceVoiceSettings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (!settings.enabled) {
          return {}; // Return empty options if disabled
        }
        
        const voice = this.voices.find(v => v.name === settings.voice);
        return {
          voice,
          rate: settings.rate || 1.0,
          pitch: settings.pitch || 1.0,
          volume: settings.volume || 0.8
        };
      }
    } catch (error) {
      console.warn('Failed to load voice settings:', error);
    }
    return this.defaultOptions;
  }

  public async speakAttendanceResult(attendanceResult: any): Promise<void> {
    // Check if voice is enabled
    try {
      const stored = localStorage.getItem('attendanceVoiceSettings');
      if (stored) {
        const settings = JSON.parse(stored);
        if (!settings.enabled) {
          return; // Don't speak if disabled
        }
      }
    } catch (error) {
      console.warn('Failed to check voice settings:', error);
    }
    const {
      action,
      employeeName,
      isLate,
      lateMinutes,
      earlyDepartureMinutes,
      actualHours,
      expectedHours,
      complianceRate
    } = attendanceResult;

    let message = '';

    // Format action name
    const actionText = action.split('_').map((word: string) => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Create dynamic message based on attendance result
    if (action === 'first_check_in') {
      message = `${actionText} successful for ${employeeName}.`;
      if (isLate && lateMinutes > 0) {
        message += ` You are ${lateMinutes} minutes late.`;
      } else {
        message += ` You are on time.`;
      }
    } else if (action === 'first_check_out') {
      message = `${actionText} successful for ${employeeName}.`;
      if (actualHours && expectedHours) {
        message += ` You worked ${actualHours.toFixed(1)} hours today.`;
      }
    } else if (action === 'second_check_in') {
      message = `Welcome back, ${employeeName}. Second check-in successful.`;
    } else if (action === 'second_check_out') {
      message = `${actionText} successful for ${employeeName}.`;
      if (actualHours && expectedHours) {
        const completionPercentage = (actualHours / expectedHours * 100).toFixed(0);
        message += ` Total working time: ${actualHours.toFixed(1)} hours. You completed ${completionPercentage}% of expected work hours.`;
      }
    }

    // Add compliance information for final check-out
    if ((action === 'first_check_out' || action === 'second_check_out') && complianceRate !== undefined) {
      if (complianceRate >= 90) {
        message += ` Excellent performance with ${complianceRate.toFixed(0)}% compliance rate.`;
      } else if (complianceRate >= 70) {
        message += ` Good performance with ${complianceRate.toFixed(0)}% compliance rate.`;
      } else {
        message += ` Your compliance rate is ${complianceRate.toFixed(0)}%. Please improve your attendance.`;
      }
    }

    try {
      const options = this.getStoredSettings();
      await this.speak(message, options);
    } catch (error) {
      console.warn('Speech synthesis failed:', error);
    }
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  public isSupported(): boolean {
    return 'speechSynthesis' in window;
  }
}

// Create singleton instance
export const attendanceSpeechService = new AttendanceSpeechService();

// Helper function for quick announcements
export const announceAttendance = async (attendanceResult: any): Promise<void> => {
  if (attendanceSpeechService.isSupported()) {
    await attendanceSpeechService.speakAttendanceResult(attendanceResult);
  }
};
