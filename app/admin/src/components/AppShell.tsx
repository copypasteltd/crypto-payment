import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  BookOpenCheck,
  Languages,
  LogOut,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  ReceiptText,
  ShieldCheck,
  Sun,
  UsersRound,
} from "lucide-react";
import i18n from "../i18n";
import type { AdminBootstrap } from "../lib/types";
import { usePreferences } from "../stores/preferences";
import { GlobalSearch } from "./GlobalSearch";
import { IconButton, StatusBadge } from "./ui";

const navGroups = [
  {
    key: "governance",
    items: [
      { key: "overview", to: "/", icon: Activity },
      { key: "accounts", to: "/accounts/users", icon: UsersRound },
      { key: "catalog", to: "/catalog/workshops", icon: BookOpenCheck },
    ],
  },
  {
    key: "operations",
    items: [
      { key: "runs", to: "/runs", icon: Activity },
      { key: "providers", to: "/providers", icon: Network },
      { key: "integrations", to: "/integrations/mcps", icon: PlugZap },
    ],
  },
  {
    key: "platform",
    items: [
      { key: "billing", to: "/billing/quotas", icon: ReceiptText },
      { key: "audit", to: "/audit", icon: ShieldCheck },
    ],
  },
] as const;

function routeTitle(pathname: string, t: (key: string) => string) {
  if (pathname.startsWith("/accounts")) return t("navigation:accounts");
  if (pathname.startsWith("/catalog")) return t("navigation:catalog");
  if (pathname.startsWith("/runs") || pathname.startsWith("/runtime")) return t("navigation:runs");
  if (pathname.startsWith("/providers")) return t("navigation:providers");
  if (pathname.startsWith("/integrations")) return t("navigation:integrations");
  if (pathname.startsWith("/billing")) return t("navigation:billing");
  if (pathname.startsWith("/audit") || pathname.startsWith("/settings")) return t("navigation:audit");
  return t("navigation:overview");
}

export function AppShell({ session, onLogout, children }: { session: AdminBootstrap; onLogout: () => void; children: ReactNode }) {
  const { t } = useTranslation(["common", "navigation"]);
  const location = useLocation();
  const preferences = usePreferences();

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  useEffect(() => {
    document.documentElement.lang = preferences.language;
    if (i18n.resolvedLanguage !== preferences.language) void i18n.changeLanguage(preferences.language);
  }, [preferences.language]);

  return (
    <div className={`admin-shell ${preferences.collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <img src="/assets/logo.svg" alt="" />
          <div><strong>{t("common:brand")}</strong><span>{t("common:adminConsole")}</span></div>
        </div>
        <nav className="sidebar-nav" aria-label={t("navigation:primary")}>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.key}>
              <p>{t(`navigation:${group.key}`)}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.key} to={item.to} end={item.to === "/"} title={preferences.collapsed ? t(`navigation:${item.key}`) : undefined}>
                    <Icon size={19} aria-hidden="true" />
                    <span>{t(`navigation:${item.key}`)}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-release"><span>{t("common:release")}</span><code>{session.system.release}</code></div>
          <button type="button" className="sidebar-collapse" onClick={preferences.toggleCollapsed}>
            {preferences.collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>{preferences.collapsed ? t("common:expand") : t("common:collapse")}</span>
          </button>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="topbar-title"><span>{t("common:admin")}</span><strong>{routeTitle(location.pathname, t)}</strong></div>
          <GlobalSearch />
          <div className="topbar-actions">
            <StatusBadge status={session.system.status} />
            <IconButton label={t("common:language")} onClick={() => {
              const next = preferences.language === "zh-CN" ? "en-US" : "zh-CN";
              preferences.setLanguage(next);
              void i18n.changeLanguage(next);
            }}><Languages size={18} /></IconButton>
            <IconButton label={preferences.theme === "dark" ? t("common:light") : t("common:dark")} onClick={preferences.toggleTheme}>
              {preferences.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </IconButton>
            <div className="admin-account">
              <span>{session.user.displayName.slice(0, 1).toUpperCase()}</span>
              <div><strong>{session.user.displayName}</strong><small>{session.user.email}</small></div>
            </div>
            <IconButton label={t("common:signOut")} onClick={onLogout}><LogOut size={18} /></IconButton>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
      <div className="viewport-blocker">
        <img src="/assets/logo.svg" alt="" />
        <h1>{t("common:adminConsole")}</h1>
        <p>{t("common:viewport")}</p>
      </div>
    </div>
  );
}
