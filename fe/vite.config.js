import { defineConfig } from 'vite';
import { resolve, join } from 'path';
import fs from 'fs';

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
