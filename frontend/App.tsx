import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Dashboard from './components/Dashboard';
import IDEPage from './pages/IDEPage';
import ProjectSettings from './pages/ProjectSettings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Simple Auth Context
const AuthContext = createContext<{
  user: { email: string; id: string } | null;
  login: (email: string) => void;
  logout: () => void;
}>({
  user: null,
  login: () => {},
  logout: () => {}
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('myco_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (email: string) => {
    const userData = { email, id: 'user-' + Date.now() };
    setUser(userData);
    localStorage.setItem('myco_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('myco_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginPage() {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('demo@myco.dev');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      login(email);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">MYCO Platform</h1>
          <p className="text-muted-foreground mt-2">Enter your email to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-border rounded-md bg-background text-foreground"
              placeholder="Enter your email"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground py-3 rounded-md hover:bg-primary/90 font-medium"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useContext(AuthContext);
  
  if (!user) {
    return <LoginPage />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="dark">
          <AppInner />
          <Toaster />
        </div>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppInner() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ide/:projectId"
          element={
            <ProtectedRoute>
              <IDEPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/settings"
          element={
            <ProtectedRoute>
              <ProjectSettings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;