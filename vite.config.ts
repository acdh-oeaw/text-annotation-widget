import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import autoprefixer from 'autoprefixer'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  css: {
    postcss: {
      plugins: [autoprefixer()],
    },
  },
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      process: 'process/browser',
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      vue: 'vue/dist/vue.esm-bundler.js',
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'TextAnnotationEditor',
      formats: ['iife'],
      fileName: (format) => `text-annotation.${format}.js`,
    },
    rollupOptions: {
      external: ['bootstrap'],
      output: {
        globals: {
          vue: 'Vue',
          bootstrap: 'bootstrap',
        },
      },
    },
  },
  define: {
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})
