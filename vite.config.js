import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Permite imports como: import { Badge } from '@/components/ui'
      // em vez de: import { Badge } from '../../components/ui'
      '@': resolve(__dirname, './src'),
    },
  },
});
