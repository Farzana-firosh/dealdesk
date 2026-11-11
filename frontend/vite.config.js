import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.DEALDESK_API || 'http://localhost:4000';

// The UI talks to the API through this proxy, so the backend needs no CORS setup.
const proxy = {
  '/api': API,
  '/socket.io': { target: API, ws: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
});
