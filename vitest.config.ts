import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc'; // Assuming SWC is used, as per package.json
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true, // Enables global APIs (describe, test, expect, etc.)
    environment: 'jsdom', // Simulates a browser environment
    setupFiles: './vitest.setup.ts', // Optional: for setup files
    alias: {
      '@': path.resolve(__dirname, './src'), // Match a common alias for src
    },
  },
});
