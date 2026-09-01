import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import fs from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

function getAllHtmlFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || {};

  files.forEach(function(file) {
    const fullPath = join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        arrayOfFiles = getAllHtmlFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.html')) {
      let relativePath = fullPath.replace(import.meta.dirname, '').replace(/\\/g, '/').substring(1);
      let key = relativePath.replace('.html', '').replace(/\//g, '_');
      if (key === 'index') key = 'main';
      arrayOfFiles[key] = resolve(import.meta.dirname, fullPath);
    }
  });

  return arrayOfFiles;
}

const htmlInputs = getAllHtmlFiles(import.meta.dirname);

export default defineConfig({
  root: './',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/offline.html'
      },
      manifest: {
        name: 'EduShare',
        short_name: 'EduShare',
        description: 'Nền tảng chia sẻ tài liệu học tập',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: htmlInputs
    }
  },
  server: {
    port: 3001,
    open: true
  }
});
