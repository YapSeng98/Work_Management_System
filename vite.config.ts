import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  // GitHub Pages serves the site from /<repo>/, so production builds need that prefix.
  base: command === 'build' || isPreview ? '/Work_Management_System/' : '/',
}))
