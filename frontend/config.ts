// Configuration values for the frontend application
export const config = {
  // API base URL - set to empty string to use relative URLs
  apiBaseUrl: process.env.VITE_API_BASE_URL || '',
  
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Feature flags
  enableExperimentalFeatures: process.env.VITE_ENABLE_EXPERIMENTAL === 'true',
  
  // Clerk authentication configuration
  // Fill in your Clerk publishable key from your Clerk dashboard
  clerkPublishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY || '',
  
  // Application metadata
  appName: 'MYCO AI Dev Platform',
  appVersion: '1.0.0',
  
  // Query client defaults
  queryClient: {
    defaultStaleTime: 60000, // 1 minute
    defaultCacheTime: 300000, // 5 minutes
    retryCount: 3,
  },
  
  // File size limits
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Code editor settings
  editor: {
    defaultTheme: 'vs-dark',
    defaultFontSize: 14,
    defaultTabSize: 2,
  },
  
  // AI generation limits
  ai: {
    maxPromptLength: 32000,
    maxResponseLength: 8000,
    defaultModel: 'gpt-3.5-turbo',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
} as const;

export default config;