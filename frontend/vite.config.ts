import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-tanstack': ['@tanstack/react-query'],
          'vendor-ui': [
            '@radix-ui/react-avatar', 
            '@radix-ui/react-dialog', 
            '@radix-ui/react-popover', 
            '@radix-ui/react-separator', 
            '@radix-ui/react-slot', 
            'lucide-react', 
            'class-variance-authority', 
            'clsx', 
            'tailwind-merge'
          ],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod', 'react-select', 'react-day-picker'],
          'vendor-utils': ['date-fns', 'axios', 'sonner', 'zustand']
        }
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
