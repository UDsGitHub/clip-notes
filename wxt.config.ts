import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// Permissions are deliberately minimal (README "Permissions"). Adding one is a product decision:
// existing users get a re-approval prompt, and the store review gets longer.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Clip Notes',
    description: 'Take simple notes in your browser.',
    // CSS light-dark(), which the whole palette is built on, landed in 123.
    minimum_chrome_version: '123',
    permissions: ['sidePanel', 'contextMenus', 'storage'],
    action: {
      default_title: 'Open Clip Notes',
    },
  },
});
