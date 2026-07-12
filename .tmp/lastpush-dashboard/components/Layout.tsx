import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Globe, Server, CreditCard,
  LogOut, Plus, Search, Terminal, HelpCircle,
  Menu, X, ShoppingBag
} from 'lucide-react';
import { useAuth } from '../App.tsx';
import { Button } from './ui/Common.tsx';
import { useI18n } from '../i18n.tsx';
import { WalletButton } from './WalletButton.tsx';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    { icon: LayoutDashboard, label: t('nav.overview'), path: '/dashboard' },
    { icon: Globe, label: t('nav.domains'), path: '/domains' },
    { icon: ShoppingBag, label: t('nav.orders'), path: '/orders' },
    { icon: Server, label: t('nav.sites'), path: '/sites' },
    { icon: CreditCard, label: t('nav.billing'), path: '/billing' },
  ];

  if (!user) {
    // Public Layout
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
        <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
          <div className="container flex h-14 max-w-7xl mx-auto items-center justify-between px-4">
            <Link to="/" className="flex items-center space-x-2 font-bold text-xl tracking-tight">
              <Terminal className="w-6 h-6 text-indigo-500" />
              <span>{t('app.name')}</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/docs" className="text-sm text-zinc-400 hover:text-white transition-colors">{t('nav.docs')}</Link>
              <select
                className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 rounded-md px-2 py-1"
                value={locale}
                onChange={(e) => setLocale(e.target.value as typeof locale)}
                aria-label={t('layout.language')}
              >
                <option value="en">EN</option>
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁體中文</option>
                <option value="ru">RU</option>
                <option value="fr">FR</option>
              </select>
              <Link to="/login">
                <Button variant="ghost" size="sm">{t('nav.signin')}</Button>
              </Link>
              <Link to="/login">
                <Button size="sm">{t('nav.getstarted')}</Button>
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }

  // Dashboard Layout
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-zinc-950 border-r border-zinc-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center px-6 border-b border-zinc-800">
          <Link to="/dashboard" className="flex items-center space-x-2 font-bold text-xl tracking-tight">
            <Terminal className="w-6 h-6 text-indigo-500" />
            <span>{t('app.name')}</span>
          </Link>
        </div>

        <div className="p-4 space-y-1">
          <div className="mb-6 px-2">
            <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                {user.handle ? user.handle[0].toUpperCase() : 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{user.handle || t('layout.user')}</p>
                <p className="text-xs text-zinc-500 truncate">{user.email || user.walletAddress}</p>
              </div>
            </div>
          </div>

          {navItems.map((item) => (
            <Link key={item.path} to={item.path}>
              <button className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(item.path) ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}>
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            </Link>
          ))}
        </div>

        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
            <WalletButton
              className="w-full"
              size="sm"
              connectLabel={t('layout.wallet.connect')}
              disconnectLabel={t('layout.wallet.disconnect')}
            />
          </div>
          <Link to="/support">
            <button className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors">
              <HelpCircle className="w-4 h-4" />
              <span>{t('nav.support')}</span>
            </button>
          </Link>
          <button onClick={logout} className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors mt-1">
            <LogOut className="w-4 h-4" />
            <span>{t('nav.signout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="h-14 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur sticky top-0 z-40 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-zinc-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
            <div className="hidden md:flex items-center text-sm text-zinc-500">
              <span className="hover:text-zinc-300 cursor-pointer" onClick={() => navigate('/dashboard')}>{t('nav.dashboard')}</span>
              {location.pathname !== '/dashboard' && (
                <>
                  <span className="mx-2">/</span>
                  <span className="text-zinc-200 capitalize">{location.pathname.split('/')[1]}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="hidden md:block bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 rounded-md px-2 py-1"
              value={locale}
              onChange={(e) => setLocale(e.target.value as typeof locale)}
              aria-label={t('layout.language')}
            >
              <option value="en">EN</option>
              <option value="zh-CN">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="ru">RU</option>
              <option value="fr">FR</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => navigate('/domains/search')}>
              <Search className="w-4 h-4 mr-2" />
              {t('nav.finddomain')}
            </Button>
            <Button size="sm" onClick={() => navigate('/sites/new')}>
              <Plus className="w-4 h-4 mr-2" />
              {t('nav.newsite')}
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-6xl mx-auto w-full animate-in fade-in duration-500">
          {children}
        </main>
      </div>
    </div>
  );
};
