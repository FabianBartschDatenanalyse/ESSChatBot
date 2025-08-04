import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// 🧪 Lade .env-Datei vor dem Teststart
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
