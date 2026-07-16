import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { adminApi, clearAdminCsrfToken, setAdminCsrfToken } from "../lib/api";
import { toast } from "../lib/toast";
import { AppShell } from "../components/AppShell";
import { LoginScreen } from "../components/LoginScreen";
import { ErrorState, LoadingState } from "../components/ui";
import { OverviewPage } from "../pages/OverviewPage";
import {
  AuditPage,
  CredentialsPage,
  LedgerPage,
  McpsPage,
  ProvidersPage,
  QuotasPage,
  RunsPage,
  SessionsPage,
  UsersPage,
  WorkshopsPage,
  WorkspacesPage,
} from "../pages/ListPages";
import {
  CredentialDetailPage,
  McpDetailPage,
  ProviderDetailPage,
  RunDetailPage,
  SessionDetailPage,
  UserDetailPage,
  WorkshopDetailPage,
  WorkspaceDetailPage,
} from "../pages/DetailPages";
import { RuntimePage } from "../pages/RuntimePage";
import { SettingsPage } from "../pages/SettingsPage";

export function App() {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const [authExpired, setAuthExpired] = useState(false);
  const session = useQuery({
    queryKey: ["admin-session"],
    queryFn: adminApi.session,
    retry: false,
    staleTime: 30_000,
    enabled: !authExpired,
  });
  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSuccess: () => toast.success(t("toast.logoutSucceeded")),
    onSettled: () => {
      clearAdminCsrfToken();
      queryClient.clear();
      setAuthExpired(true);
    },
  });

  useEffect(() => {
    const listener = () => {
      toast.warning(t("toast.sessionExpired"));
      clearAdminCsrfToken();
      void queryClient.cancelQueries({ queryKey: ["admin-session"] });
      queryClient.removeQueries({ queryKey: ["admin-session"] });
      setAuthExpired(true);
    };
    window.addEventListener("lingban-admin-auth-expired", listener);
    return () => window.removeEventListener("lingban-admin-auth-expired", listener);
  }, [queryClient, t]);

  if (session.isLoading) return <div className="app-loading"><img src="/assets/logo.svg" alt="" /><LoadingState label={t("validatingSession")} /></div>;
  if (authExpired || !session.data) {
    const status = (session.error as { status?: number } | null)?.status;
    if (session.error && status !== 401 && status !== 403) {
      return <div className="fatal-error"><ErrorState error={session.error} onRetry={() => void session.refetch()} /></div>;
    }
    return <LoginScreen onAuthenticated={(value) => { setAdminCsrfToken(value.csrfToken); queryClient.setQueryData(["admin-session"], value); setAuthExpired(false); }} />;
  }

  return (
    <AppShell session={session.data} onLogout={() => logout.mutate()}>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/accounts/users" element={<UsersPage />} />
        <Route path="/accounts/users/:userId" element={<UserDetailPage />} />
        <Route path="/accounts/workspaces" element={<WorkspacesPage />} />
        <Route path="/accounts/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
        <Route path="/catalog/workshops" element={<WorkshopsPage />} />
        <Route path="/catalog/workshops/:workshopId" element={<WorkshopDetailPage />} />
        <Route path="/catalog/sessions" element={<SessionsPage />} />
        <Route path="/catalog/sessions/:sessionId" element={<SessionDetailPage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/runs/:runId" element={<RunDetailPage />} />
        <Route path="/runtime" element={<RuntimePage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/providers/:providerId" element={<ProviderDetailPage />} />
        <Route path="/providers/:providerId/models/:modelId" element={<ProviderDetailPage />} />
        <Route path="/integrations/mcps" element={<McpsPage />} />
        <Route path="/integrations/mcps/:mcpId" element={<McpDetailPage />} />
        <Route path="/integrations/credentials" element={<CredentialsPage />} />
        <Route path="/integrations/credentials/:credentialId" element={<CredentialDetailPage />} />
        <Route path="/billing/quotas" element={<QuotasPage />} />
        <Route path="/billing/ledger" element={<LedgerPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
