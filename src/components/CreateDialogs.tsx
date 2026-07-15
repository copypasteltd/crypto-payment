import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gauge, KeyRound, LoaderCircle, Network, PlugZap, Save, X } from "lucide-react";
import { adminRequest } from "../lib/api";
import type { JsonObject } from "../lib/types";
import { ErrorState, IconButton } from "./ui";

function Drawer({ title, eyebrow, icon, onClose, children }: { title: string; eyebrow: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation("common");
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <aside className="form-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header><div className="drawer-icon">{icon}</div><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><IconButton label={t("closeDialog")} onClick={onClose}><X size={19} /></IconButton></header>
        {children}
      </aside>
    </div>
  );
}

type ProviderForm = { displayName: string; description: string; baseUrl: string; defaultModel: string; models: string; healthcheckPath: string; enabled: boolean; reason: string };

export function CreateProviderDialog({ onClose, onCreated }: { onClose: () => void; onCreated?: (provider: JsonObject) => void }) {
  const { t } = useTranslation(["providers", "common"]);
  const queryClient = useQueryClient();
  const form = useForm<ProviderForm>({ defaultValues: { displayName: "", description: "", baseUrl: "", defaultModel: "", models: "", healthcheckPath: "/models", enabled: true, reason: "" } });
  const mutation = useMutation({
    mutationFn: (values: ProviderForm) => adminRequest<JsonObject>("/providers", { method: "POST", body: JSON.stringify({ input: { displayName: values.displayName, description: values.description || null, baseUrl: values.baseUrl, defaultModel: values.defaultModel, models: values.models.split(",").map((model) => model.trim()).filter(Boolean).map((model) => ({ model, label: null, enabled: true, isDefault: model === values.defaultModel, capabilities: {} })), healthcheckPath: values.healthcheckPath || null, enabled: values.enabled }, reason: values.reason }) }),
    onSuccess: async (provider) => { await queryClient.invalidateQueries({ queryKey: ["providers"] }); onCreated?.(provider); onClose(); },
  });
  return (
    <Drawer title={t("providers:create")} eyebrow={t("providers:createEyebrow")} icon={<Network size={21} />} onClose={onClose}>
      <form className="drawer-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <label className="field"><span>{t("providers:displayName")}</span><input {...form.register("displayName", { required: true })} /></label>
        <label className="field"><span>{t("providers:baseUrl")}</span><input type="url" placeholder="https://api.example.com/v1" {...form.register("baseUrl", { required: true })} /></label>
        <div className="form-grid"><label className="field"><span>{t("providers:defaultModel")}</span><input {...form.register("defaultModel", { required: true })} /></label><label className="field"><span>{t("providers:healthcheckPath")}</span><input {...form.register("healthcheckPath")} /></label></div>
        <label className="field"><span>{t("providers:models")}</span><input placeholder="model-a, model-b" {...form.register("models")} /><small>{t("providers:modelsHint")}</small></label>
        <label className="field"><span>{t("providers:descriptionField")}</span><textarea rows={3} {...form.register("description")} /></label>
        <label className="toggle-field"><input type="checkbox" {...form.register("enabled")} /><span>{t("providers:enableAfterCreate")}</span></label>
        <label className="field"><span>{t("providers:changeReason")}</span><textarea rows={3} {...form.register("reason", { required: true, minLength: 8 })} /></label>
        {mutation.error ? <ErrorState error={mutation.error} /> : null}
        <footer><button type="button" className="button secondary" onClick={onClose}>{t("common:cancel")}</button><button type="submit" className="button primary" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{t("providers:save")}</button></footer>
      </form>
    </Drawer>
  );
}

type McpForm = { workspaceId: string; mcpId: string; displayName: string; description: string; transport: "http" | "sse" | "websocket"; ref: string; riskLevel: "low" | "medium" | "high" | "critical"; approvalRequired: boolean; reason: string };

export function CreateMcpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(["integrations", "common"]);
  const queryClient = useQueryClient();
  const form = useForm<McpForm>({ defaultValues: { workspaceId: "", mcpId: "", displayName: "", description: "", transport: "sse", ref: "", riskLevel: "medium", approvalRequired: true, reason: "" } });
  const mutation = useMutation({
    mutationFn: (values: McpForm) => adminRequest<JsonObject>("/mcps", { method: "POST", body: JSON.stringify({ workspaceId: values.workspaceId || undefined, input: { mcpId: values.mcpId, displayName: values.displayName, description: values.description || null, source: "third-party", transport: values.transport, ref: values.ref, status: "active", riskLevel: values.riskLevel, defaultCredentialId: null, defaultNetworkPolicyRef: null, approvalRequired: values.approvalRequired, tags: [] }, reason: values.reason }) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["mcps"] }); onClose(); },
  });
  return (
    <Drawer title={t("integrations:registerThirdPartyMcp")} eyebrow={t("integrations:registryEyebrow")} icon={<PlugZap size={21} />} onClose={onClose}>
      <form className="drawer-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="form-grid"><label className="field"><span>{t("integrations:mcpId")}</span><input className="mono" {...form.register("mcpId", { required: true })} /></label><label className="field"><span>{t("integrations:displayName")}</span><input {...form.register("displayName", { required: true })} /></label></div>
        <label className="field"><span>{t("integrations:targetWorkspace")}</span><input className="mono" placeholder={t("integrations:currentWorkspaceHint")} {...form.register("workspaceId")} /></label>
        <div className="form-grid"><label className="field"><span>{t("integrations:transport")}</span><select {...form.register("transport")}><option value="sse">{t("integrations:transportSse")}</option><option value="http">{t("integrations:transportHttp")}</option><option value="websocket">{t("integrations:transportWebsocket")}</option></select></label><label className="field"><span>{t("integrations:riskLevel")}</span><select {...form.register("riskLevel")}><option value="low">{t("common:statusValues.low")}</option><option value="medium">{t("common:statusValues.medium")}</option><option value="high">{t("common:statusValues.high")}</option><option value="critical">{t("common:statusValues.critical")}</option></select></label></div>
        <label className="field"><span>{t("integrations:endpoint")}</span><input type="url" {...form.register("ref", { required: true })} /></label>
        <label className="field"><span>{t("integrations:descriptionField")}</span><textarea rows={3} {...form.register("description")} /></label>
        <label className="toggle-field"><input type="checkbox" {...form.register("approvalRequired")} /><span>{t("integrations:requireApproval")}</span></label>
        <label className="field"><span>{t("integrations:registrationReason")}</span><textarea rows={3} {...form.register("reason", { required: true, minLength: 8 })} /></label>
        {mutation.error ? <ErrorState error={mutation.error} /> : null}
        <footer><button type="button" className="button secondary" onClick={onClose}>{t("common:cancel")}</button><button type="submit" className="button primary" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{t("integrations:registerMcp")}</button></footer>
      </form>
    </Drawer>
  );
}

type CredentialForm = { workspaceId: string; scope: "workspace" | "user"; displayName: string; provider: string; secretKind: "api-key" | "access-token" | "oauth-token" | "json-file" | "browser-storage-state" | "session-cookie"; mountMode: "env" | "file"; envName: string; secretValue: string; notes: string; reason: string };

export function CreateCredentialDialog({ onClose, onCreated, initialProvider = "openai" }: { onClose: () => void; onCreated?: (credential: JsonObject) => void; initialProvider?: string }) {
  const { t } = useTranslation(["integrations", "common"]);
  const queryClient = useQueryClient();
  const form = useForm<CredentialForm>({ defaultValues: { workspaceId: "", scope: "workspace", displayName: "", provider: initialProvider, secretKind: "api-key", mountMode: "env", envName: "OPENAI_API_KEY", secretValue: "", notes: "", reason: "" } });
  const mutation = useMutation({
    mutationFn: (values: CredentialForm) => adminRequest<JsonObject>("/credentials", { method: "POST", body: JSON.stringify({ workspaceId: values.workspaceId || undefined, input: { scope: values.scope, displayName: values.displayName, provider: values.provider, secretKind: values.secretKind, mountMode: values.mountMode, secretValue: values.secretValue, secretRef: null, envName: values.mountMode === "env" ? values.envName : undefined, notes: values.notes || null }, reason: values.reason }) }),
    onSuccess: async (credential) => { form.reset(); await queryClient.invalidateQueries({ queryKey: ["credentials"] }); onCreated?.(credential); onClose(); },
  });
  useEffect(() => () => form.reset({ ...form.getValues(), secretValue: "" }), [form]);
  return (
    <Drawer title={t("integrations:writePrivateCredential")} eyebrow={t("integrations:credentialBroker")} icon={<KeyRound size={21} />} onClose={onClose}>
      <form className="drawer-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <label className="field"><span>{t("integrations:targetWorkspace")}</span><input className="mono" placeholder={t("integrations:currentWorkspaceHint")} {...form.register("workspaceId")} /></label>
        <div className="form-grid"><label className="field"><span>{t("integrations:name")}</span><input {...form.register("displayName", { required: true })} /></label><label className="field"><span>{t("integrations:provider")}</span><input {...form.register("provider", { required: true })} /></label></div>
        <div className="form-grid"><label className="field"><span>{t("integrations:scope")}</span><select {...form.register("scope")}><option value="workspace">{t("integrations:scopeWorkspace")}</option><option value="user">{t("integrations:scopeUser")}</option></select></label><label className="field"><span>{t("integrations:secretType")}</span><select {...form.register("secretKind")}><option value="api-key">{t("integrations:secretApiKey")}</option><option value="access-token">{t("integrations:secretAccessToken")}</option><option value="oauth-token">{t("integrations:secretOauthToken")}</option><option value="json-file">{t("integrations:secretJsonFile")}</option><option value="browser-storage-state">{t("integrations:secretBrowserState")}</option><option value="session-cookie">{t("integrations:secretSessionCookie")}</option></select></label></div>
        <div className="form-grid"><label className="field"><span>{t("integrations:mountMode")}</span><select {...form.register("mountMode")}><option value="env">{t("integrations:mountEnvironment")}</option><option value="file">{t("integrations:mountFile")}</option></select></label><label className="field"><span>{t("integrations:envName")}</span><input className="mono" {...form.register("envName")} /></label></div>
        <label className="field secret-field"><span>{t("integrations:secret")}</span><textarea rows={5} autoComplete="new-password" spellCheck={false} {...form.register("secretValue", { required: true })} /><small>{t("integrations:secretHint")}</small></label>
        <label className="field"><span>{t("integrations:notes")}</span><textarea rows={2} {...form.register("notes")} /></label>
        <label className="field"><span>{t("integrations:writeReason")}</span><textarea rows={3} {...form.register("reason", { required: true, minLength: 8 })} /></label>
        {mutation.error ? <ErrorState error={mutation.error} /> : null}
        <footer><button type="button" className="button secondary" onClick={onClose}>{t("common:cancel")}</button><button type="submit" className="button primary" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{t("integrations:encryptedWrite")}</button></footer>
      </form>
    </Drawer>
  );
}

type QuotaForm = {
  workspaceId: string;
  scopeType: "user" | "workspace" | "workspace-context" | "service" | "task-version" | "session-version" | "package" | "entry-surface";
  scopeRefId: string;
  metric: "active_runs" | "daily_runs" | "browser_minutes" | "model_tokens" | "image_credits" | "mcp_calls" | "storage_bytes" | "download_bytes" | "audit_exports" | "replays" | "ws_connections";
  windowType: "instant" | "daily" | "monthly";
  limitValue: number;
  softLimitValue: number | null;
  hardLimitValue: number | null;
  actionOnSoftLimit: "warn" | "require_approval";
  actionOnHardLimit: "block" | "require_override";
  status: "active" | "disabled" | "archived";
  enabled: boolean;
  priority: number;
  notes: string;
  reason: string;
};

function quotaDefaults(initial?: JsonObject): QuotaForm {
  const numberOr = (value: unknown, fallback: number) => typeof value === "number" ? value : fallback;
  const nullableNumber = (value: unknown) => typeof value === "number" ? value : null;
  return {
    workspaceId: String(initial?.workspaceId ?? ""),
    scopeType: (initial?.scopeType as QuotaForm["scopeType"]) ?? "workspace",
    scopeRefId: String(initial?.scopeRefId ?? ""),
    metric: (initial?.metric as QuotaForm["metric"]) ?? "daily_runs",
    windowType: (initial?.windowType as QuotaForm["windowType"]) ?? "daily",
    limitValue: numberOr(initial?.limitValue, 100),
    softLimitValue: nullableNumber(initial?.softLimitValue),
    hardLimitValue: nullableNumber(initial?.hardLimitValue),
    actionOnSoftLimit: (initial?.actionOnSoftLimit as QuotaForm["actionOnSoftLimit"]) ?? "warn",
    actionOnHardLimit: (initial?.actionOnHardLimit as QuotaForm["actionOnHardLimit"]) ?? "block",
    status: (initial?.status as QuotaForm["status"]) ?? "active",
    enabled: initial?.enabled !== false,
    priority: numberOr(initial?.priority, 100),
    notes: String(initial?.notes ?? ""),
    reason: "",
  };
}

export function QuotaPolicyDialog({ initial, onClose }: { initial?: JsonObject; onClose: () => void }) {
  const { t } = useTranslation(["billing", "common"]);
  const queryClient = useQueryClient();
  const form = useForm<QuotaForm>({ defaultValues: quotaDefaults(initial) });
  const policyId = typeof initial?.policyId === "string" ? initial.policyId : null;
  const mutation = useMutation({
    mutationFn: (values: QuotaForm) => {
      const input = {
        scopeType: values.scopeType,
        scopeRefId: values.scopeRefId,
        metric: values.metric,
        windowType: values.windowType,
        limitValue: values.limitValue,
        softLimitValue: Number.isFinite(values.softLimitValue) ? values.softLimitValue : null,
        hardLimitValue: Number.isFinite(values.hardLimitValue) ? values.hardLimitValue : null,
        actionOnSoftLimit: values.actionOnSoftLimit,
        actionOnHardLimit: values.actionOnHardLimit,
        status: values.status,
        enabled: values.enabled,
        priority: values.priority,
        notes: values.notes.trim() || null,
      };
      return adminRequest<JsonObject>(policyId ? `/quotas/${encodeURIComponent(policyId)}` : "/quotas", {
        method: policyId ? "PATCH" : "POST",
        body: JSON.stringify({ workspaceId: values.workspaceId || undefined, input, reason: values.reason }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quotas"] });
      onClose();
    },
  });
  return (
    <Drawer title={policyId ? t("billing:editPolicyTitle") : t("billing:createPolicyTitle")} eyebrow={t("billing:governanceEyebrow")} icon={<Gauge size={21} />} onClose={onClose}>
      <form className="drawer-form" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <label className="field"><span>{t("billing:targetWorkspace")}</span><input className="mono" readOnly={Boolean(policyId)} {...form.register("workspaceId", { required: true })} /></label>
        <div className="form-grid"><label className="field"><span>{t("billing:scopeType")}</span><select {...form.register("scopeType")}><option value="workspace">{t("billing:scopeWorkspace")}</option><option value="user">{t("billing:scopeUser")}</option><option value="workspace-context">{t("billing:scopeWorkspaceContext")}</option><option value="service">{t("billing:scopeService")}</option><option value="task-version">{t("billing:scopeTaskVersion")}</option><option value="session-version">{t("billing:scopeSessionVersion")}</option><option value="package">{t("billing:scopePackage")}</option><option value="entry-surface">{t("billing:scopeEntrySurface")}</option></select></label><label className="field"><span>{t("billing:scopeObject")}</span><input className="mono" {...form.register("scopeRefId", { required: true })} /></label></div>
        <div className="form-grid"><label className="field"><span>{t("billing:metric")}</span><select {...form.register("metric")}><option value="active_runs">{t("billing:metricActiveRuns")}</option><option value="daily_runs">{t("billing:metricDailyRuns")}</option><option value="browser_minutes">{t("billing:metricBrowserMinutes")}</option><option value="model_tokens">{t("billing:metricModelTokens")}</option><option value="image_credits">{t("billing:metricImageCredits")}</option><option value="mcp_calls">{t("billing:metricMcpCalls")}</option><option value="storage_bytes">{t("billing:metricStorageBytes")}</option><option value="download_bytes">{t("billing:metricDownloadBytes")}</option><option value="audit_exports">{t("billing:metricAuditExports")}</option><option value="replays">{t("billing:metricReplays")}</option><option value="ws_connections">{t("billing:metricRealtimeConnections")}</option></select></label><label className="field"><span>{t("billing:window")}</span><select {...form.register("windowType")}><option value="instant">{t("billing:windowInstant")}</option><option value="daily">{t("billing:windowDaily")}</option><option value="monthly">{t("billing:windowMonthly")}</option></select></label></div>
        <div className="form-grid three"><label className="field"><span>{t("billing:standardLimit")}</span><input type="number" min="0" step="any" {...form.register("limitValue", { required: true, valueAsNumber: true, min: 0 })} /></label><label className="field"><span>{t("billing:softLimit")}</span><input type="number" min="0" step="any" {...form.register("softLimitValue", { setValueAs: (value) => value === "" ? null : Number(value) })} /></label><label className="field"><span>{t("billing:hardLimit")}</span><input type="number" min="0" step="any" {...form.register("hardLimitValue", { setValueAs: (value) => value === "" ? null : Number(value) })} /></label></div>
        <div className="form-grid"><label className="field"><span>{t("billing:softAction")}</span><select {...form.register("actionOnSoftLimit")}><option value="warn">{t("billing:actionWarn")}</option><option value="require_approval">{t("billing:actionRequireApproval")}</option></select></label><label className="field"><span>{t("billing:hardAction")}</span><select {...form.register("actionOnHardLimit")}><option value="block">{t("billing:actionBlock")}</option><option value="require_override">{t("billing:actionRequireOverride")}</option></select></label></div>
        <div className="form-grid three"><label className="field"><span>{t("common:status")}</span><select {...form.register("status")}><option value="active">{t("common:statusValues.active")}</option><option value="disabled">{t("common:statusValues.disabled")}</option><option value="archived">{t("common:statusValues.archived")}</option></select></label><label className="field"><span>{t("billing:priority")}</span><input type="number" {...form.register("priority", { valueAsNumber: true })} /></label><label className="toggle-field compact"><input type="checkbox" {...form.register("enabled")} /><span>{t("billing:policyEnabled")}</span></label></div>
        <label className="field"><span>{t("billing:policyNotes")}</span><textarea rows={2} {...form.register("notes")} /></label>
        <label className="field"><span>{t("billing:changeReason")}</span><textarea rows={3} {...form.register("reason", { required: true, minLength: 8 })} /></label>
        {mutation.error ? <ErrorState error={mutation.error} /> : null}
        <footer><button type="button" className="button secondary" onClick={onClose}>{t("common:cancel")}</button><button type="submit" className="button primary" disabled={mutation.isPending}>{mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{policyId ? t("billing:savePolicy") : t("billing:submitCreatePolicy")}</button></footer>
      </form>
    </Drawer>
  );
}
