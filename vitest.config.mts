import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Tests live beside nothing in src/app. A test file inside the routable app
    // directory fails `next build` with an error naming neither the file nor
    // the cause, while every other check stays green (sops.md §7).
    include: ['tests/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
});
