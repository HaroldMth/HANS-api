import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // allows network access
    port: 5173, // your dev server port (adjust if different)
    strictPort: true,
    allowedHosts: ['af6faf4dd0ba.ngrok-free.app'], // add your ngrok URL here
    // OR allow all hosts during dev with: allowedHosts: 'all'
  },
});
