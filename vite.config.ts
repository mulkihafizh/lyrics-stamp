import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { localMusicPlugin } from './vite-plugin-music.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), localMusicPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
