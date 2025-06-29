import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import LoadingSpinner from '@/components/LoadingSpinner';
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary';

// Function to set up automatic report scheduling
const setupAutoReportScheduling = async () => {
  try {
    // Initialize any scheduled tasks or bot settings
    console.log('Initializing automatic report scheduling...');
    
    // Check if we have valid settings in localStorage
    const botSettings = localStorage.getItem('botSettings');
    if (!botSettings) {
      // Set default bot settings
      const defaultSettings = {
        isEnabled: false,
        adminNumbers: [],
        shareTime: '18:00',
        lastShared: null,
        retryAttempts: 0,
        notifyOnErrors: true
      };
      localStorage.setItem('botSettings', JSON.stringify(defaultSettings));
    }
    
    console.log('Automatic report scheduling initialized successfully');
  } catch (error) {
    console.error('Error setting up automatic report scheduling:', error);
    throw error;
  }
};

// Lazy load components
const Index = lazy(() => import('@/pages/index'));
const RosterManagement = lazy(() => import('@/pages/RosterManagement'));
const GatePass = lazy(() => import('@/pages/GatePass'));
const AttendanceBotDashboard = lazy(() => import('@/pages/AttendanceBotDashboard'));
const SplashScreen = lazy(() => import('@/components/SplashScreen'));

// Create a new QueryClient with better configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

const App: React.FC = () => {
  const [showSplash, setShowSplash] = React.useState<boolean>(true);
  const [isInitialized, setIsInitialized] = React.useState<boolean>(false);
  const [initError, setInitError] = React.useState<string | null>(null);
  
  // Set up automatic report scheduling when the app loads with improved error handling
  React.useEffect(() => {
    const initializeApp = async () => {
      try {
        await setupAutoReportScheduling();
        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing app:", error);
        
        // Provide more specific error messages
        let errorMessage = "Failed to initialize application";
        if (error instanceof Error) {
          if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage = "Network connection issue. Please check your internet connection.";
          } else if (error.message.includes('permission') || error.message.includes('auth')) {
            errorMessage = "Authentication error. Please refresh and try again.";
          } else {
            errorMessage = error.message;
          }
        }
        
        setInitError(errorMessage);
        setIsInitialized(true); // We still want to show the app even if there's an initialization error
      }
    };

    initializeApp();
  }, []);

  // Add the more responsive meta tag for viewport
  React.useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    document.getElementsByTagName('head')[0].appendChild(meta);
    
    return () => {
      document.getElementsByTagName('head')[0].removeChild(meta);
    };
  }, []);

  if (!isInitialized) {
    return <LoadingSpinner />;
  }

  // If there was an initialization error, show it but still let users access the app
  if (initError) {
    console.warn(`Initialization warning: ${initError}`);
  }

  const handleSplashFinished = () => {
    setShowSplash(false);
  };

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <div className="min-h-screen bg-background">
            {showSplash ? (
              <Suspense fallback={<LoadingSpinner />}>
                <SplashScreen onFinished={handleSplashFinished} />
              </Suspense>
            ) : (
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/roster/*" element={<RosterManagement />} />
                  <Route path="/gatepass/*" element={<GatePass />} />
                  <Route path="/bot-dashboard/*" element={<AttendanceBotDashboard />} />
                </Routes>
              </Suspense>
            )}
            <Toaster />
            <Sonner />
          </div>
        </Router>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
