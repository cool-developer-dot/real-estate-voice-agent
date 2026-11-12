import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'module';

var require = createRequire(import.meta.url);
var module = { exports: {} };

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5000, allowedHosts: true },
});
