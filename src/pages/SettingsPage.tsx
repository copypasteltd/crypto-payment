import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import { Bell, Database, Flag, HeartPulse, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { adminRequest } from "../lib/api";
import { toast } from "../lib/toast";
import type { JsonObject } from "../lib/types";
import { ErrorState, LoadingState, PageHeader, Panel, RecordView, StatusBadge, formatDate } from "../components/ui";

type SettingKey = "feature-flags" | "notifications" | "retention";
type SystemData = JsonObject & { settings: JsonObject[]; featureFlags: JsonObject; notifications: JsonObject; retention: JsonObject; adminAccounts: JsonObject[]; release: string; checkedAt: string };

function SettingEditor({ settingKey, title, description, icon, initial, system }: { settingKey: SettingKey; title: string; description: string; icon: React.ReactNode; initial: JsonObject; system: SystemData }) {
  const { t } = useTranslation(["audit", "common"]);
  const queryClient = useQueryClient();
  const [value, setValue] = useState(() => JSON.stringify(initial, null, 2));
  const [reason, setReason] = useState("");
  useEffect(() => setValue(JSON.stringify(initial, null, 2)), [initial]);
  const current = system.settings.find((item) => item.key === settingKey);
  const mutation = useMutation({
    mutationFn: () => adminRequest<JsonObject>(`/settings/${settingKey}`, { method: "PUT", body: JSON.stringify({ value: JSON.parse(value), expectedVersion: typeof current?.version === "number" ? current.version : null, reason }) }),
    onSuccess: async () => { toast.success(t("audit:configSaved"), { description: title }); setReason(""); await queryClient.invalidateQueries({ queryKey: ["system"] }); },
  });
  let valid = true;
  try { JSON.parse(value); } catch { valid = false; }
  return (
    <Panel title={title} meta={description} actions={<div className="settings-icon">{icon}</div>}>
      <label className="field">
        <span>{t("audit:versionedConfig")}</span>
        <textarea className="config-editor" rows={10} aria-invalid={!valid} value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} />
        <small className={!valid ? "field-error-text" : undefined}>{valid ? t("audit:currentVersion", { version: String(current?.version ?? 0) }) : t("common:validation.invalidJson")}</small>
      </label>
      <label className="field"><span>{t("audit:changeReason")}</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      {mutation.error ? <ErrorState error={mutation.error} /> : null}
      {mutation.isSuccess ? <div className="operation-success"><ShieldCheck size={17} />{t("audit:configSaved")}</div> : null}
      <div className="panel-form-actions">
        <button type="button" className="button primary" data-ready={valid && reason.trim().length >= 8} disabled={mutation.isPending} onClick={() => { if (!valid) { toast.warning(t("common:validation.invalidJson")); return; } if (reason.trim().length < 8) { toast.warning(t("common:toast.reasonRequired"), { description: t("common:validation.minLength", { count: 8 }) }); return; } mutation.mutate(); }}>
          {mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
          {t("audit:saveChanges")}
        </button>
      </div>
    </Panel>
  );
}

export function SettingsPage() {
  const { t } = useTranslation(["audit", "common"]);
  const query = useQuery({ queryKey: ["system"], queryFn: () => adminRequest<SystemData>("/system") });
  const [tab, setTab] = useState<"health" | "configuration" | "policies" | "admins">("health");
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data!;
  return (
    <div className="page-stack">
      <nav className="module-tabs"><NavLink to="/audit">{t("audit:events")}</NavLink><NavLink to="/settings">{t("audit:settings")}</NavLink></nav>
      <PageHeader eyebrow={t("audit:pageEyebrow")} title={t("audit:pageTitle")} description={`${t("common:release")} ${data.release} · ${formatDate(data.checkedAt)}`} />
      <nav className="settings-tabs">
        <button className={tab === "health" ? "active" : ""} onClick={() => setTab("health")}><HeartPulse size={17} />{t("audit:health")}</button>
        <button className={tab === "configuration" ? "active" : ""} onClick={() => setTab("configuration")}><Database size={17} />{t("audit:configuration")}</button>
        <button className={tab === "policies" ? "active" : ""} onClick={() => setTab("policies")}><Flag size={17} />{t("audit:policies")}</button>
        <button className={tab === "admins" ? "active" : ""} onClick={() => setTab("admins")}><ShieldCheck size={17} />{t("audit:admins")}</button>
      </nav>
      {tab === "health" ? (
        <div className="settings-grid">
          <Panel title={t("audit:readiness")} meta={t("audit:storageAndCore")}><RecordView value={data.readiness} /></Panel>
          <Panel title={t("audit:runtime")} meta={t("audit:workerBridge")}><RecordView value={data.runtime} /></Panel>
        </div>
      ) : null}
      {tab === "configuration" ? <Panel title={t("audit:effectiveConfiguration")} meta={t("audit:sensitiveRemoved")}><RecordView value={data.configuration} /></Panel> : null}
      {tab === "policies" ? (
        <div className="settings-grid">
          <SettingEditor settingKey="feature-flags" title={t("audit:featureFlags")} description={t("audit:featureFlagsDescription")} icon={<Flag size={18} />} initial={data.featureFlags} system={data} />
          <SettingEditor settingKey="notifications" title={t("audit:notifications")} description={t("audit:notificationsDescription")} icon={<Bell size={18} />} initial={data.notifications} system={data} />
          <SettingEditor settingKey="retention" title={t("audit:retention")} description={t("audit:retentionDescription")} icon={<Database size={18} />} initial={data.retention} system={data} />
        </div>
      ) : null}
      {tab === "admins" ? (
        <Panel title={t("audit:adminAccounts")} meta={t("audit:adminAccountsMeta")}>
          <div className="admin-account-list">
            {data.adminAccounts.map((account) => (
              <div key={String(account.email)}>
                <span className="account-avatar">{String(account.displayName ?? account.email).slice(0, 1)}</span>
                <div><strong>{String(account.displayName)}</strong><code>{String(account.email)}</code><small>{t("audit:lastLogin")}: {formatDate(account.lastLoginAt)}</small></div>
                <StatusBadge status={account.status} />
                <span className="mfa-state">{t("audit:mfa")}: {String(account.mfa)}</span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
