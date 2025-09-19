module.exports = {
  // Test environment setup
  projects: [
    // Backend tests (Encore.ts)
    {
      displayName: 'backend',
      testMatch: ['<rootDir>/tests/backend/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/backend/setup.ts'],
      collectCoverageFrom: [
        'backend/**/*.ts',
        '!backend/**/*.d.ts',
        '!backend/**/node_modules/**',
        '!backend/**/dist/**'
      ],
      coverageDirectory: '<rootDir>/coverage/backend',
      coverageReporters: ['text', 'lcov', 'html', 'json'],
      coverageThreshold: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: 'backend/tsconfig.json'
        }]
      },
      moduleNameMapping: {
        '^~backend/(.*)$': '<rootDir>/backend/$1'
      },
      testTimeout: 30000
    },
    
    // Frontend tests (React/Vite)
    {
      displayName: 'frontend',
      testMatch: ['<rootDir>/tests/frontend/**/*.test.{ts,tsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/tests/frontend/setup.ts'],
      collectCoverageFrom: [
        'frontend/**/*.{ts,tsx}',
        '!frontend/**/*.d.ts',
        '!frontend/**/node_modules/**',
        '!frontend/**/dist/**',
        '!frontend/index.html',
        '!frontend/main.tsx'
      ],
      coverageDirectory: '<rootDir>/coverage/frontend',
      coverageReporters: ['text', 'lcov', 'html', 'json'],
      coverageThreshold: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85
        }
      },
      transform: {
        '^.+\\.tsx?$': ['ts-jest', {
          tsconfig: 'frontend/tsconfig.json'
        }]
      },
      moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/frontend/$1',
        '^~backend/(.*)$': '<rootDir>/backend/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
      },
      testTimeout: 10000
    },

    // Integration tests
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/**/integration/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts'],
      collectCoverageFrom: [
        'backend/**/*.ts',
        'frontend/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/dist/**'
      ],
      coverageDirectory: '<rootDir>/coverage/integration',
      coverageReporters: ['text', 'lcov', 'html', 'json'],
      testTimeout: 60000,
      maxWorkers: 2 // Limit parallel execution for integration tests
    }
  ],

  // Global configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json', 'text-summary'],
  
  // Combined coverage thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Test result processors
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/test-results',
      outputName: 'jest-results.xml',
      ancestorSeparator: ' › ',
      uniqueOutputName: 'false',
      suiteNameTemplate: '{displayName} - {filepath}',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}'
    }],
    ['jest-html-reporters', {
      publicPath: '<rootDir>/test-results',
      filename: 'jest-report.html',
      expand: true
    }]
  ],

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Verbose output for CI
  verbose: process.env.CI === 'true',

  // Watch mode settings
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Error handling
  bail: process.env.CI === 'true' ? 1 : 0,
  forceExit: true,

  // Timing
  slowTestThreshold: 5
};