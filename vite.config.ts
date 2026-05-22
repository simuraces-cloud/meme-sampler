import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Use relative base so the build works on any subpath (e.g. GitHub Pages).
export default defineConfig({
  plugins: [react()],
  base: './',
})
