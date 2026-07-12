import React, { createContext, useContext, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { Home } from './pages/Home.tsx';
import { Login } from './pages/Login.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { DomainList, DomainDetail } from './pages/DomainManager.tsx';
import { SiteList, SiteDetail, NewSite } from './pages/SiteManager.tsx';
import { Billing } from './pages/Billing.tsx';
import { OrderNew } from './pages/OrderNew.tsx';
import { OrderDetail } from './pages/OrderDetail.tsx';
import { Orders } from './pages/Orders.tsx';
import { I18nProvider } from './i18n.tsx';
import { useI18n } from './i18n.tsx';
import { User } from './types.ts';
import { api } from './api.ts';

// Wagmi imports
import { WagmiProvider, createConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum, bsc } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { http } from 'viem';
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

const supportedChains = [mainnet, polygon, optimism, arbitrum, bsc].filter(Boolean);
const transports = supportedChains.reduce<Record<number, ReturnType<typeof http>>>((acc, chain) => {
  acc[chain.id] = http();
  return acc;
}, {});

const config = createConfig({
  chains: supportedChains,
  transports,
  connectors: [injected()],
  ssr: false,
});

const queryClient = new QueryClient();

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  setSession: (token: string, user: User) => void;
  updateUser: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session and load current user
  useEffect(() => {
    const storedToken = localStorage.getItem('lastpush_token');
    const storedUser = localStorage.getItem('lastpush_user');
    if (storedToken) {
      setToken(storedToken);
      if (storedUser) setUser(JSON.parse(storedUser));
      api.get<User>('/users/me')
        .then((data) => {
          setUser(data);
          localStorage.setItem('lastpush_user', JSON.stringify(data));
        })
        .catch(() => {
          setToken(null);
          setUser(null);
          localStorage.removeItem('lastpush_token');
          localStorage.removeItem('lastpush_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const setSession = (sessionToken: string, userData: User) => {
    setToken(sessionToken);
    setUser(userData);
    localStorage.setItem('lastpush_token', sessionToken);
    localStorage.setItem('lastpush_user', JSON.stringify(userData));
  };

  const updateUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem('lastpush_user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('lastpush_token');
    localStorage.removeItem('lastpush_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, setSession, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Protected Route Wrapper ---
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) {
    return <div className="p-6 text-zinc-400">{t('layout.loading')}</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  useEffect(() => {
    if (window.location.pathname === '/login' && window.location.search) {
      window.location.hash = `/login${window.location.search}`;
      return;
    }
    if (window.location.hash.startsWith('#/login') && window.location.search) {
      const hashPath = window.location.hash.replace(/^#/, '');
      if (!hashPath.includes('?')) {
        window.location.replace(`${window.location.origin}/#${hashPath}${window.location.search}`);
      }
    }
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <I18nProvider>
            <Router>
              <Layout>
                <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                
                {/* Protected Routes */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                
                <Route path="/domains" element={<ProtectedRoute><DomainList /></ProtectedRoute>} />
                <Route path="/domains/search" element={<Navigate to="/" />} />
                <Route path="/domains/:name" element={<ProtectedRoute><DomainDetail /></ProtectedRoute>} />
                
                <Route path="/sites" element={<ProtectedRoute><SiteList /></ProtectedRoute>} />
                <Route path="/sites/new" element={<ProtectedRoute><NewSite /></ProtectedRoute>} />
                <Route path="/sites/:id" element={<ProtectedRoute><SiteDetail /></ProtectedRoute>} />
                
                <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                <Route path="/orders/new" element={<ProtectedRoute><OrderNew /></ProtectedRoute>} />
                <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </Layout>
            </Router>
          </I18nProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;
