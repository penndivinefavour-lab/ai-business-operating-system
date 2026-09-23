// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Node.js built-in modules that should not be transformed
    deps: {
      optimizer: {
        ssr: {
          include: ['node:sqlite'],
        },
      },
    },
  },
});
