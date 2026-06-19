import path from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
      includeAssets: ['favicon.jpeg', 'icon_black.jpeg', 'icon_white.jpeg'],
      manifest: {
        name: 'Tire İletişim Merkezi',
        short_name: 'Tire İletişim',
        description: 'Vatandaş talepleri ve kurum içi iş takibi için belediye iletişim merkezi.',
        theme_color: '#123B63',
        background_color: '#EEF3F8',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon.jpeg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          icons: ['lucide-react'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
})
