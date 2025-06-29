
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QrCode, Users, FileText, Clock, ArrowRight, FileSpreadsheet } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-16">
          <div className="inline-block p-3 bg-white/50 backdrop-blur-sm rounded-lg mb-6 shadow-lg">
            <QrCode className="h-12 w-12 text-primary animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            QR Attendance System
          </h1>
          <p className="mt-6 text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Streamline your employee attendance tracking with our intuitive QR code-based system.
            Modern, efficient, and designed for today's workplace.
          </p>
          <Button 
            onClick={onGetStarted} 
            size="lg" 
            className="mt-10 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0 shadow-lg group transition-all duration-300"
          >
            Get Started <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <Card className="bg-white/70 backdrop-blur-sm hover:shadow-lg transition-all overflow-hidden border-none hover:-translate-y-1 duration-300">
            <div className="h-2 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
            <CardContent className="p-8">
              <div className="bg-blue-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-5">
                <QrCode className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">QR-Based Check-in</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Employees can check in and out quickly by simply scanning their unique QR code.
                No more time cards or manual entries needed.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm hover:shadow-lg transition-all overflow-hidden border-none hover:-translate-y-1 duration-300">
            <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-400"></div>
            <CardContent className="p-8">
              <div className="bg-purple-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-5">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Detailed Reports</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Access comprehensive attendance reports and analytics to gain insights
                into employee attendance patterns and optimize workforce management.
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-white/70 backdrop-blur-sm hover:shadow-lg transition-all overflow-hidden border-none hover:-translate-y-1 duration-300">
            <div className="h-2 bg-gradient-to-r from-pink-500 to-orange-400"></div>
            <CardContent className="p-8">
              <div className="bg-pink-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-5">
                <Clock className="h-6 w-6 text-pink-600" />
              </div>
              <h3 className="text-xl font-bold mb-3">Real-time Tracking</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor employee attendance in real-time. Get instant notifications
                for late arrivals, absences, or shifts that need coverage.
              </p>
            </CardContent>
          </Card>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 mb-20 shadow-lg">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2 mb-8 md:mb-0 md:pr-10">
              <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Employee Management Made Simple
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg leading-relaxed">
                Our system makes it easy to manage your workforce with features like bulk employee imports,
                department organization, and custom reports - saving you time and reducing overhead.
              </p>
              <div className="space-y-4">
                {[
                  'Easy employee onboarding',
                  'Bulk import from CSV or Excel',
                  'Department management',
                  'Attendance history tracking',
                  'Custom reporting tools'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <div className="rounded-full bg-green-100 p-1 mr-3">
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl transform rotate-3"></div>
                <div className="relative bg-white p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center border-b pb-4 mb-6">
                    <div className="bg-blue-100 p-3 rounded-full">
                      <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <h4 className="font-semibold">Bulk Employee Import</h4>
                      <p className="text-sm text-gray-500">Add multiple employees at once</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gray-100 p-3 rounded flex items-center">
                      <div className="w-4 h-4 bg-green-500 rounded-full mr-3"></div>
                      <div className="text-sm">Upload_Employees.csv</div>
                    </div>
                    <div className="bg-gray-100 p-3 rounded flex items-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full mr-3"></div>
                      <div className="text-sm">New_Department_Staff.xlsx</div>
                    </div>
                    <div className="mt-4 bg-blue-50 p-3 rounded text-sm text-blue-800">
                      Imported 24 employees successfully
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Ready to Get Started?</h2>
          <Button 
            onClick={onGetStarted} 
            size="lg" 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0 shadow-lg group"
          >
            Start Using QR Attendance <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
            Streamline your attendance process today
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
