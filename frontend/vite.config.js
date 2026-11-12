import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.DEALDESK_API || 'http://localhost:4000';

// Local dev: the UI talks to the API through this proxy (same origin, no CORS needed).
// Production build: VITE_API_URL points the UI at the deployed API instead.
const proxy = {
  '/api': API,
  '/socket.io': { target: API, ws: true },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 5173, proxy },
});
