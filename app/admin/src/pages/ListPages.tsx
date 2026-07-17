import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { NavLink, useNavigate } from "react-router-dom";
import { Gauge, KeyRound, Pencil, Plus, PlugZap } from "lucide-react";
import i18n from "../i18n";
import { readableTitle } from "../lib/display";
import type { JsonObject } from "../lib/types";
import type { DataColumn } from "../components/DataTable";
import { ResourceListPage } from "../components/ResourceListPage";
import { RowActions, type GovernanceActionSpec } from "../components/GovernanceAction";
import { CreateCredentialDialog, CreateMcpDialog, CreateProviderDialog, QuotaPolicyDialog } from "../components/CreateDialogs";
import { ProviderRowOperations } from "../components/ProviderOperations";
import { StatusBadge, formatDate } from "../components/ui";

function text(value: unknown, fallback = "-") { return value == null || value === "" ? fallback : String(value); }
function number(value: unknown) { return new Intl.NumberFormat(i18n.resolvedLanguage || "zh-CN").format(typeof value === "number" ? value : 0); }
function nested(row: JsonObject, key: string) { const value = row[key]; return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function localized(value: unknown) {
  const item = value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
  const english = i18n.resolvedLanguage?.startsWith("en");
  return text(english ? item.en ?? item.zh ?? value : item.zh ?? item.en ?? value);
}
function money(value: unknown) { return new Intl.NumberFormat(i18n.resolvedLanguage || "zh-CN", { style: "currency", currency: "USD" }).format(typeof value === "number" ? value : 0); }

function Primary({ title, id, meta }: { title: string; id: string; meta?: string }) { return <div className="primary-cell"><strong>{title}</strong><code>{id}</code>{meta ? <small>{meta}</small> : null}</div>; }
function ModuleTabs({ items }: { items: Array<{ to: string; label: string }> }) { return <nav className="module-tabs">{items.map((item) => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}</nav>; }
function HeaderButton({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) { return <button type="button" className="button primary" onClick={onClick}>{icon}{children}</button>; }

function actionSpec(t: TFunction, action: string, labelKey: string, tone?: "default" | "danger"): GovernanceActionSpec {
  return { action, label: t(`common:${labelKey}`), labelKey, tone };
}

function statusActions(type: string, status: string, t: TFunction): GovernanceActionSpec[] {
  const active = /active|ready|healthy|enabled/i.test(status);
  switch (type) {
    case "user": return active ? [actionSpec(t, "suspend", "actionsSuspend", "danger"), actionSpec(t, "force-logout", "actionsForceLogout", "danger")] : [actionSpec(t, "resume", "actionsResume")];
    case "workspace": return active ? [actionSpec(t, "suspend", "actionsSuspend", "danger")] : [actionSpec(t, "resume", "actionsResume")];
    case "workshop": return active ? [actionSpec(t, "unlist", "actionsUnlist", "danger"), actionSpec(t, "archive", "actionsArchive")] : [actionSpec(t, "list", "actionsList")];
    case "session": return status === "quarantined" ? [actionSpec(t, "release", "actionsRelease")] : [actionSpec(t, "quarantine", "actionsQuarantine", "danger")];
    case "run": return /FAILED|CANCELLED|TERMINATED/i.test(status) ? [actionSpec(t, "retry", "actionsRetry")] : [actionSpec(t, "cancel", "actionsCancel", "danger"), actionSpec(t, "terminate", "actionsTerminate", "danger")];
    case "provider": return active ? [actionSpec(t, "disable", "actionsDisable", "danger")] : [actionSpec(t, "enable", "actionsEnable")];
    case "mcp": return status === "quarantined" ? [actionSpec(t, "release", "actionsRelease")] : [actionSpec(t, "quarantine", "actionsQuarantine", "danger"), actionSpec(t, "disable", "actionsDisable")];
    case "credential": return [actionSpec(t, "disable", "actionsFreeze", "danger"), actionSpec(t, "revoke", "actionsRevoke", "danger")];
    default: return [];
  }
}

const actionsColumn = (type: string, id: (row: JsonObject) => string, status: (row: JsonObject) => string, t: TFunction): DataColumn<JsonObject> => ({ key: "actions", label: t("common:actions"), width: 150, render: (row) => <RowActions resourceType={type} resourceId={id(row)} actions={statusActions(type, status(row), t)} /> });

export function UsersPage() {
  const { t } = useTranslation(["accounts", "common"]);
  const columns: DataColumn<JsonObject>[] = [
    { key: "user", label: t("accounts:users"), render: (r) => <Primary title={text(r.displayName)} id={text(r.userId)} meta={text(r.email)} /> },
    { key: "status", label: t("common:status"), width: 130, render: (r) => <StatusBadge status={r.status} /> },
    { key: "workspaces", label: t("accounts:workspaces"), width: 100, render: (r) => number(r.workspaceCount) },
    { key: "runs", label: t("common:runs"), width: 90, render: (r) => number(r.runCount) },
    { key: "cost", label: t("accounts:monthlyCost"), width: 110, render: (r) => money(r.monthlyCostUsd) },
    { key: "login", label: t("accounts:lastLogin"), width: 180, render: (r) => formatDate(r.lastLoginAt) },
    actionsColumn("user", (r) => text(r.userId), (r) => text(r.status), t),
  ];
  return <><ModuleTabs items={[{ to: "/accounts/users", label: t("accounts:users") }, { to: "/accounts/workspaces", label: t("accounts:workspaces") }]} /><ResourceListPage queryKey="users" endpoint="/users" eyebrow={t("accounts:identityEyebrow")} title={t("accounts:users")} description={t("accounts:usersDescription")} columns={columns} rowKey={(r) => text(r.userId)} detailPath={(r) => `/accounts/users/${encodeURIComponent(text(r.userId))}`} statusOptions={["active", "suspended"]} /></>;
}

export function WorkspacesPage() {
  const { t } = useTranslation(["accounts", "common"]);
  const columns: DataColumn<JsonObject>[] = [
    { key: "workspace", label: t("accounts:workspaces"), render: (r) => <Primary title={text(r.name)} id={text(r.workspaceId)} meta={text(r.slug)} /> },
    { key: "type", label: t("common:type"), width: 110, render: (r) => text(r.type) },
    { key: "status", label: t("common:status"), width: 130, render: (r) => <StatusBadge status={r.status} /> },
    { key: "members", label: t("accounts:members"), width: 90, render: (r) => number(r.memberCount) },
    { key: "runs", label: t("accounts:activeRuns"), width: 110, render: (r) => number(r.activeRunCount) },
    { key: "cost", label: t("accounts:cost"), width: 110, render: (r) => money(r.costUsd) },
    { key: "updated", label: t("common:updatedAt"), width: 180, render: (r) => formatDate(r.updatedAt) },
    actionsColumn("workspace", (r) => text(r.workspaceId), (r) => text(r.status), t),
  ];
  return <><ModuleTabs items={[{ to: "/accounts/users", label: t("accounts:users") }, { to: "/accounts/workspaces", label: t("accounts:workspaces") }]} /><ResourceListPage queryKey="workspaces" endpoint="/workspaces" eyebrow={t("accounts:tenantEyebrow")} title={t("accounts:workspaces")} description={t("accounts:workspacesDescription")} columns={columns} rowKey={(r) => text(r.workspaceId)} detailPath={(r) => `/accounts/workspaces/${encodeURIComponent(text(r.workspaceId))}`} statusOptions={["active", "suspended"]} /></>;
}

export function WorkshopsPage() {
  const { t } = useTranslation(["catalog", "common"]);
  const columns: DataColumn<JsonObject>[] = [
    { key: "workshop", label: t("catalog:workshops"), render: (r) => <Primary title={localized(r.name)} id={text(r.workshopId)} meta={localized(r.category)} /> },
    { key: "status", label: t("catalog:catalogStatus"), width: 130, render: (r) => <StatusBadge status={r.governanceStatus ?? r.status} /> },
    { key: "services", label: t("common:services"), width: 100, render: (r) => number(r.serviceCount) },
    { key: "packages", label: t("common:packages"), width: 100, render: (r) => number(r.packageCount) },
    { key: "runs", label: t("common:runs"), width: 90, render: (r) => number(r.runCount) },
    { key: "updated", label: t("common:updatedAt"), width: 180, render: (r) => formatDate(r.updatedAt) },
    actionsColumn("workshop", (r) => text(r.workshopId), (r) => text(r.governanceStatus ?? r.status), t),
  ];
  return <><ModuleTabs items={[{ to: "/catalog/workshops", label: t("catalog:workshops") }, { to: "/catalog/sessions", label: t("catalog:sessions") }]} /><ResourceListPage queryKey="workshops" endpoint="/workshops" eyebrow={t("catalog:workshopEyebrow")} title={t("catalog:workshops")} description={t("catalog:workshopDescription")} columns={columns} rowKey={(r) => text(r.workshopId)} detailPath={(r) => `/catalog/workshops/${encodeURIComponent(text(r.workshopId))}`} statusOptions={["active", "hidden", "archived"]} /></>;
}

export function SessionsPage() {
  const { t } = useTranslation(["catalog", "common"]);
  const columns: DataColumn<JsonObject>[] = [
    { key: "session", label: t("catalog:sessions"), render: (r) => <Primary title={text(r.displayName ?? r.title ?? r.sessionVersionId)} id={text(r.sessionVersionId)} meta={text(r.taskVersionId)} /> },
    { key: "status", label: t("catalog:governanceStatus"), width: 135, render: (r) => <StatusBadge status={r.governanceStatus ?? r.status} /> },
    { key: "source", label: t("catalog:source"), width: 130, render: (r) => text(r.source ?? r.entrySurface) },
    { key: "mcp", label: "MCP", width: 80, render: (r) => Array.isArray(r.mcpRequirements) ? r.mcpRequirements.length : number(r.mcpCount) },
    { key: "runs", label: t("common:runs"), width: 90, render: (r) => number(r.runCount) },
    { key: "updated", label: t("common:updatedAt"), width: 180, render: (r) => formatDate(r.updatedAt ?? r.createdAt) },
    actionsColumn("session", (r) => text(r.sessionVersionId), (r) => text(r.governanceStatus ?? r.status), t),
  ];
  return <><ModuleTabs items={[{ to: "/catalog/workshops", label: t("catalog:workshops") }, { to: "/catalog/sessions", label: t("catalog:sessions") }]} /><ResourceListPage queryKey="sessions" endpoint="/sessions" eyebrow={t("catalog:sessionEyebrow")} title={t("catalog:sessions")} description={t("catalog:sessionDescription")} columns={columns} rowKey={(r) => text(r.sessionVersionId)} detailPath={(r) => `/catalog/sessions/${encodeURIComponent(text(r.sessionVersionId))}`} statusOptions={["active", "quarantined", "disabled"]} /></>;
}

export function RunsPage() {
  const { t } = useTranslation(["runs", "common"]);
  const columns: DataColumn<JsonObject>[] = [
    { key: "run", label: t("common:run"), render: (r) => { const run = nested(r, "run"); const id = text(run.runId); return <Primary title={readableTitle(run.title, `${t("common:run")} ${id}`)} id={id} meta={text(run.workspaceId)} />; } },
    { key: "status", label: t("common:status"), width: 135, render: (r) => <StatusBadge status={nested(r, "run").status} /> },
    { key: "stage", label: t("runs:stage"), width: 130, render: (r) => text(nested(r, "run").stage ?? nested(r, "run").statusReason) },
    { key: "provider", label: t("common:providerModel"), width: 170, render: (r) => { const p = nested(r, "provider"); return <div className="stacked-cell"><span>{text(p.displayName ?? p.providerId)}</span><code>{text(p.model)}</code></div>; } },
    { key: "files", label: t("runs:files"), width: 80, render: (r) => number(r.fileCount) },
    { key: "updated", label: t("common:updatedAt"), width: 180, render: (r) => formatDate(nested(r, "run").updatedAt) },
    actionsColumn("run", (r) => text(nested(r, "run").runId), (r) => text(nested(r, "run").status), t),
  ];
  return <><ModuleTabs items={[{ to: "/runs", label: t("runs:runs") }, { to: "/runtime", label: t("runs:runtime") }]} /><ResourceListPage queryKey="runs" endpoint="/runs" eyebrow={t("runs:eyebrow")} title={t("runs:runs")} description={t("runs:description")} columns={columns} rowKey={(r) => text(nested(r, "run").runId)} detailPath={(r) => `/runs/${encodeURIComponent(text(nested(r, "run").runId))}`} statusOptions={["CREATED", "STARTING", "RUNNING", "WAITING_INPUT", "WAITING_APPROVAL", "FAILED", "COMPLETED", "CANCELLED"]} /></>;
}

export function ProvidersPage() {
  const { t } = useTranslation(["providers", "common"]);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const columns: DataColumn<JsonObject>[] = [
    { key: "provider", label: t("common:provider"), render: (r) => <Primary title={text(r.displayName)} id={text(r.providerId)} meta={text(r.baseUrl)} /> },
    { key: "status", label: t("common:status"), width: 125, render: (r) => <StatusBadge status={r.governanceStatus} /> },
    { key: "health", label: t("providers:health"), width: 135, render: (r) => <StatusBadge status={nested(r, "lastHealthcheck").status ?? "not_checked"} /> },
    { key: "model", label: t("providers:defaultModel"), width: 150, render: (r) => <code>{text(r.defaultModel)}</code> },
    { key: "models", label: t("providers:modelCount"), width: 90, render: (r) => Array.isArray(r.models) ? r.models.length : 0 },
    { key: "bindings", label: t("providers:bindings"), width: 80, render: (r) => number(r.bindingCount) },
    { key: "updated", label: t("common:updatedAt"), width: 180, render: (r) => formatDate(r.updatedAt) },
    { key: "actions", label: t("common:actions"), width: 250, render: (r) => <ProviderRowOperations provider={r} governance={<RowActions resourceType="provider" resourceId={text(r.providerId)} actions={statusActions("provider", text(r.governanceStatus), t)} />} /> },
  ];
  return <><ResourceListPage queryKey="providers" endpoint="/providers" eyebrow={t("providers:eyebrow")} title={t("providers:title")} description={t("providers:description")} columns={columns} rowKey={(r) => text(r.providerId)} detailPath={(r) => `/providers/${encodeURIComponent(text(r.providerId))}`} statusOptions={["active", "disabled"]} headerActions={<HeaderButton icon={<Plus size={17} />} onClick={() => setCreating(true)}>{t("providers:create")}</HeaderButton>} />{creating ? <CreateProviderDialog onCreated={(provider) => navigate(`/providers/${encodeURIComponent(text(provider.providerId))}`)} onClose={() => setCreating(false)} /> : null}</>;
}

export function McpsPage() {
  const { t } = useTranslation(["integrations", "common"]);
  const [creating, setCreating] = useState(false);
  const columns: DataColumn<JsonObject>[] = [
    { key: "mcp", label: t("common:mcp"), render: (r) => <Primary title={text(r.displayName)} id={text(r.mcpId)} meta={`${text(r.source)} · ${text(r.transport)}`} /> },
    { key: "risk", label: t("integrations:risk"), width: 105, render: (r) => <StatusBadge status={r.riskLevel} /> },
    { key: "status", label: t("common:status"), width: 130, render: (r) => <StatusBadge status={r.governanceStatus} /> },
    { key: "health", label: t("integrations:health"), width: 130, render: (r) => <StatusBadge status={nested(r, "latestHealth").status ?? "not_checked"} /> },
    { key: "bindings", label: t("integrations:bindings"), width: 80, render: (r) => number(r.bindingCount) },
    { key: "calls", label: t("integrations:calls"), width: 90, render: (r) => number(r.callCount) },
    { key: "updated", label: t("common:updatedAt"), width: 180, render: (r) => formatDate(r.updatedAt) },
    actionsColumn("mcp", (r) => text(r.mcpId), (r) => text(r.governanceStatus), t),
  ];
  return <><ModuleTabs items={[{ to: "/integrations/mcps", label: t("integrations:mcps") }, { to: "/integrations/credentials", label: t("integrations:credentials") }]} /><ResourceListPage queryKey="mcps" endpoint="/mcps" eyebrow={t("integrations:mcpEyebrow")} title={t("integrations:mcps")} description={t("integrations:mcpDescription")} columns={columns} rowKey={(r) => text(r.mcpId)} detailPath={(r) => `/integrations/mcps/${encodeURIComponent(text(r.mcpId))}`} statusOptions={["active", "disabled", "quarantined"]} headerActions={<HeaderButton icon={<PlugZap size={17} />} onClick={() => setCreating(true)}>{t("integrations:registerMcp")}</HeaderButton>} />{creating ? <CreateMcpDialog onClose={() => setCreating(false)} /> : null}</>;
}

export function CredentialsPage() {
  const { t } = useTranslation(["integrations", "common"]);
  const [creating, setCreating] = useState(false);
  const columns: DataColumn<JsonObject>[] = [
    { key: "credential", label: t("integrations:credentials"), render: (r) => <Primary title={text(r.displayName)} id={text(r.credentialId)} meta={`${text(r.provider)} · ${text(r.secretKind)}`} /> },
    { key: "scope", label: t("integrations:scope"), width: 110, render: (r) => text(r.scope) },
    { key: "status", label: t("common:status"), width: 135, render: (r) => <StatusBadge status={r.governanceStatus ?? r.status} /> },
    { key: "broker", label: t("integrations:secretProvider"), width: 150, render: (r) => text(r.brokerKind) },
    { key: "version", label: t("integrations:version"), width: 75, render: (r) => number(r.secretVersion) },
    { key: "rotation", label: t("integrations:rotationDate"), width: 180, render: (r) => formatDate(r.rotationDueAt) },
    { key: "usage", label: t("integrations:materializations"), width: 100, render: (r) => number(r.materializationCount) },
    actionsColumn("credential", (r) => text(r.credentialId), (r) => text(r.governanceStatus ?? r.status), t),
  ];
  return <><ModuleTabs items={[{ to: "/integrations/mcps", label: t("integrations:mcps") }, { to: "/integrations/credentials", label: t("integrations:credentials") }]} /><ResourceListPage queryKey="credentials" endpoint="/credentials" eyebrow={t("integrations:credentialEyebrow")} title={t("integrations:credentials")} description={t("integrations:credentialDescription")} columns={columns} rowKey={(r) => text(r.credentialId)} detailPath={(r) => `/integrations/credentials/${encodeURIComponent(text(r.credentialId))}`} statusOptions={["active", "needs-rotation", "disabled", "revoked"]} headerActions={<HeaderButton icon={<KeyRound size={17} />} onClick={() => setCreating(true)}>{t("integrations:writeCredential")}</HeaderButton>} />{creating ? <CreateCredentialDialog onClose={() => setCreating(false)} /> : null}</>;
}

export function QuotasPage() {
  const { t } = useTranslation(["billing", "common"]);
  const [dialog, setDialog] = useState<{ initial?: JsonObject } | null>(null);
  const columns: DataColumn<JsonObject>[] = [
    { key: "policy", label: t("billing:quotaPolicy"), render: (r) => <Primary title={`${text(r.metric)} · ${text(r.windowType)}`} id={text(r.policyId)} meta={text(r.workspaceId)} /> },
    { key: "scope", label: t("billing:scope"), width: 150, render: (r) => `${text(r.scopeType)}:${text(r.scopeRefId)}` },
    { key: "status", label: t("common:status"), width: 120, render: (r) => <StatusBadge status={r.status} /> },
    { key: "limit", label: t("billing:limit"), width: 100, render: (r) => number(r.limitValue) },
    { key: "counter", label: t("billing:currentCount"), width: 110, render: (r) => { const counters = Array.isArray(r.counters) ? r.counters : []; return number((counters[0] as JsonObject | undefined)?.currentValue); } },
    { key: "overrides", label: t("billing:overrides"), width: 100, render: (r) => Array.isArray(r.overrides) ? r.overrides.length : 0 },
    { key: "updated", label: t("common:updatedAt"), width: 180, render: (r) => formatDate(r.updatedAt) },
    { key: "actions", label: t("common:actions"), width: 90, render: (r) => <button type="button" className="table-action" onClick={(event) => { event.stopPropagation(); setDialog({ initial: r }); }}><Pencil size={14} />{t("common:edit")}</button> },
  ];
  return <><ModuleTabs items={[{ to: "/billing/quotas", label: t("billing:quotas") }, { to: "/billing/ledger", label: t("billing:ledger") }]} /><ResourceListPage queryKey="quotas" endpoint="/quotas" eyebrow={t("billing:quotaEyebrow")} title={t("billing:quotas")} description={t("billing:quotaDescription")} columns={columns} rowKey={(r) => text(r.policyId)} statusOptions={["active", "disabled", "archived"]} headerActions={<HeaderButton icon={<Gauge size={17} />} onClick={() => setDialog({})}>{t("billing:createPolicy")}</HeaderButton>} />{dialog ? <QuotaPolicyDialog initial={dialog.initial} onClose={() => setDialog(null)} /> : null}</>;
}

export function LedgerPage() {
  const { t } = useTranslation(["billing", "common"]);
  const columns: DataColumn<JsonObject>[] = [
    { key: "ledger", label: t("billing:ledgerEntry"), render: (r) => <Primary title={text(r.costType ?? r.metric ?? t("common:usage"))} id={text(r.entryId ?? r.ledgerId)} meta={text(r.workspaceId)} /> },
    { key: "run", label: t("common:run"), width: 150, render: (r) => <code>{text(r.runId)}</code> },
    { key: "provider", label: t("common:providerModel"), width: 170, render: (r) => <div className="stacked-cell"><span>{text(r.providerId)}</span><code>{text(r.model)}</code></div> },
    { key: "quantity", label: t("billing:quantity"), width: 100, render: (r) => number(r.quantity) },
    { key: "amount", label: t("billing:amount"), width: 110, render: (r) => money(r.amountUsd) },
    { key: "status", label: t("common:status"), width: 120, render: (r) => <StatusBadge status={r.status ?? "recorded"} /> },
    { key: "time", label: t("billing:time"), width: 180, render: (r) => formatDate(r.occurredAt) },
  ];
  return <><ModuleTabs items={[{ to: "/billing/quotas", label: t("billing:quotas") }, { to: "/billing/ledger", label: t("billing:ledger") }]} /><ResourceListPage queryKey="ledger" endpoint="/ledger" eyebrow={t("billing:ledgerEyebrow")} title={t("billing:ledger")} description={t("billing:ledgerDescription")} columns={columns} rowKey={(r) => text(r.entryId ?? r.ledgerId)} /></>;
}

export function AuditPage() {
  const { t } = useTranslation(["audit", "common"]);
  const columns: DataColumn<JsonObject>[] = [
    { key: "event", label: t("audit:event"), render: (r) => <Primary title={`${text(r.action)} · ${text(r.resourceType)}`} id={text(r.eventId)} meta={text(r.resourceId)} /> },
    { key: "source", label: t("audit:source"), width: 110, render: (r) => text(r.source) },
    { key: "actor", label: t("audit:actor"), width: 180, render: (r) => text(r.actorEmail ?? r.actorUserId ?? "system") },
    { key: "outcome", label: t("audit:outcome"), width: 120, render: (r) => <StatusBadge status={r.outcome} /> },
    { key: "request", label: t("common:requestTrace"), width: 180, render: (r) => <div className="stacked-cell"><code>{text(r.requestId)}</code><code>{text(r.traceId)}</code></div> },
    { key: "time", label: t("audit:time"), width: 180, render: (r) => formatDate(r.occurredAt) },
  ];
  return <><ModuleTabs items={[{ to: "/audit", label: t("audit:events") }, { to: "/settings", label: t("audit:settings") }]} /><ResourceListPage queryKey="audit" endpoint="/audit" eyebrow={t("audit:eventEyebrow")} title={t("audit:events")} description={t("audit:eventDescription")} columns={columns} rowKey={(r) => text(r.eventId)} statusOptions={["success", "failed", "partial", "rejected"]} /></>;
}
