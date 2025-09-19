// Clerk publishable key for authentication
// Get this from your Clerk dashboard at https://clerk.com
export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_c3RpcnJpbmctcGVyY2gtMTUuY2xlcmsuYWNjb3VudHMuZGV2JA";

// API configuration
export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: 30000,
};

// Feature flags
export const features = {
  enableCollaboration: true,
  enableAIAssistant: true,
  enableAdvancedTemplates: true,
  enableDeployment: true,
  enableAgents: true,
};

// Editor configuration
export const editorConfig = {
  theme: 'vs-dark',
  fontSize: 14,
  lineNumbers: 'on' as const,
  minimap: { enabled: true },
  wordWrap: 'on' as const,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  quickSuggestions: true,
  suggestOnTriggerCharacters: true,
  tabSize: 2,
  insertSpaces: true,
};

// Terminal configuration
export const terminalConfig = {
  cursorBlink: true,
  cursorStyle: 'block' as const,
  fontFamily: 'Monaco, Menlo, monospace',
  fontSize: 13,
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    selection: '#264f78',
  },
};
