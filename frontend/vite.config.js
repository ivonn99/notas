import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 127.0.0.1 evita en Windows que `localhost` resuelva a IPv6 y el proxy no llegue al API
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
  // `npm run preview` también debe enrutar /api al backend (igual que `npm run dev`)
  preview: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
})
