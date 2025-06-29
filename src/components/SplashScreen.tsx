
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, CheckCircle, Clock, Calendar } from 'lucide-react';

const SplashScreen: React.FC<{ onFinished: () => void }> = ({ onFinished }) => {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // Simulate loading process
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => onFinished(), 500); // Give a small delay before transitioning
            return 100;
          }
          return prev + 5;
        });
      }, 50);
      
      return () => clearInterval(interval);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [onFinished]);
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 text-white z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center p-8 max-w-md"
      >
        <motion.div 
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <motion.div
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
              className="w-24 h-24 rounded-full border-4 border-white/30 border-t-white"
            />
            <Users size={32} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
        </motion.div>
        
        <motion.h1 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold mb-2"
        >
          Attendance System
        </motion.h1>
        
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-white/80 mb-8"
        >
          Track and manage employee attendance with ease
        </motion.p>
        
        <div className="flex justify-center space-x-6 mb-8">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col items-center"
          >
            <div className="bg-white/20 p-3 rounded-full mb-2">
              <CheckCircle size={20} />
            </div>
            <span className="text-sm">Check-in</span>
          </motion.div>
          
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col items-center"
          >
            <div className="bg-white/20 p-3 rounded-full mb-2">
              <Clock size={20} />
            </div>
            <span className="text-sm">Tracking</span>
          </motion.div>
          
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="flex flex-col items-center"
          >
            <div className="bg-white/20 p-3 rounded-full mb-2">
              <Calendar size={20} />
            </div>
            <span className="text-sm">Reports</span>
          </motion.div>
        </div>
        
        <div className="w-full bg-white/20 rounded-full h-2 mb-2">
          <motion.div 
            className="h-2 rounded-full bg-white"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-white/70">Loading resources... {progress}%</p>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
