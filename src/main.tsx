
import React from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from "@/components/ui/tooltip";
import App from './App.tsx';
import './index.css';

// Add better viewport meta tag for mobile responsiveness
document.querySelector('meta[name="viewport"]')?.setAttribute(
  'content', 
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>
);
