/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/frontend/setup.ts'],

    // File patterns
    include: [
      'tests/frontend/**/*.test.{ts,tsx}',
      'frontend/**/*.test.{ts,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '**/*.d.ts'
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/frontend-vitest',
      include: [
        'frontend/**/*.{ts,tsx}'
      ],
      exclude: [
        'frontend/**/*.d.ts',
        'frontend/**/node_modules/**',
        'frontend/**/dist/**',
        'frontend/index.html',
        'frontend/main.tsx',
        'frontend/**/*.test.{ts,tsx}',
        'frontend/**/*.spec.{ts,tsx}'
      ],
      thresholds: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85
      },
      all: true,
      clean: true
    },

    // Reporting
    reporters: ['default', 'json', 'html'],
    outputFile: {
      json: './test-results/vitest-results.json',
      html: './test-results/vitest-report.html'
    },

    // Performance
    testTimeout: 10000,
    hookTimeout: 10000,
    maxConcurrency: 8,

    // Watch mode
    watch: false,

    // Pool options
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 2
      }
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'frontend'),
      '~backend': path.resolve(__dirname, 'backend')
    }
  },

  // Build configuration for tests
  esbuild: {
    target: 'node14'
  }
});