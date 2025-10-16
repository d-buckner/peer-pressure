import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [
        { browser: 'chromium' }
      ]
    },
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '*.config.js',
        '*.config.ts'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
