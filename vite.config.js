import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' hace que el juego funcione en GitHub Pages sin importar el nombre del repositorio.
export default defineConfig({
  plugins: [react()],
  base: './',
});
