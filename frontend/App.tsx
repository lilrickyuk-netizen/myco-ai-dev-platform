import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { clerkPublishableKey } from './config';
import Dashboard from './pages/Dashboard';
import IDEPage from './pages/IDEPage';
import ProjectSettings from './pages/ProjectSettings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  if (!clerkPublishableKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Configuration Required</h1>
          <p className="text-muted-foreground">
            Please set your Clerk publishable key in the config.ts file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <QueryClientProvider client={queryClient}>
        <div className="dark">
          <AppInner />
          <Toaster />
        </div>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function AppInner() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <SignedIn>
              <Dashboard />
            </SignedIn>
          }
        />
        <Route
          path="/ide/:projectId"
          element={
            <SignedIn>
              <IDEPage />
            </SignedIn>
          }
        />
        <Route
          path="/projects/:projectId/settings"
          element={
            <SignedIn>
              <ProjectSettings />
            </SignedIn>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </Router>
  );
}

export default App;
