import { brand } from '@repo/config/brand';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { port: 5173, strictPort: true },
  build: { manifest: true },
  plugins: [
    {
      name: 'brand-title',
      transformIndexHtml: (html) => html.replace('%APP_TITLE%', brand.pos.name),
    },
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: brand.pos.name,
        short_name: brand.pos.name,
        description: 'Billing, kitchen and back office',
        lang: 'en-IN',
        display: 'standalone',
        start_url: '/',
        background_color: '#f6f1e8',
        theme_color: '#1f1a17',
      },
    }),
  ],
});
