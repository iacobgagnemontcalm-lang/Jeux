import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths so the build works whether it's served from the domain
  // root (Netlify/Firebase) or a sub-path like /Jeux/ (GitHub Pages).
  base: './',
  plugins: [react()],
});
