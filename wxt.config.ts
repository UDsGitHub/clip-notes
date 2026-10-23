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
    // The store's summary (at most 132 characters; docs/store/listing.md).
    description:
      "Take notes in Chrome's side panel and clip text from any page with a right-click. Private: your notes never leave your device.",
    // CSS light-dark(), which the whole palette is built on, landed in 123.
    minimum_chrome_version: '123',
    permissions: ['sidePanel', 'contextMenus', 'storage'],
    action: {
      default_title: 'Open Clip Notes',
    },
  },
});
