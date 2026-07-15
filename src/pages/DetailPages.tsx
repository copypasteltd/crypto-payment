import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, KeyRound, ListRestart, LoaderCircle, Play, RefreshCw, RotateCw, ShieldAlert } from "lucide-react";
import { adminRequest } from "../lib/api";
import i18n from "../i18n";
import type { JsonObject, JsonValue } from "../lib/types";
import { GovernanceActionDialog, type GovernanceActionSpec } from "../components/GovernanceAction";
import { ErrorState, IconButton, LoadingState, PageHeader, Panel, RecordView, StatusBadge, formatDate } from "../components/ui";

type DetailKind = "user" | "workspace" | "workshop" | "session" | "run" | "mcp" | "credential";

const configs: Record<DetailKind, { endpoint: string; mainKey: string; idKey: string; actions: GovernanceActionSpec[] }> = {
  user: { endpoint: "/users", mainKey: "user", idKey: "userId", actions: [{ action: "suspend", label: "Suspend account", labelKey: "actionsSuspendAccount", tone: "danger" }, { action: "force-logout", label: "Force logout", labelKey: "actionsForceLogout", tone: "danger" }, { action: "resume", label: "Resume account", labelKey: "actionsResumeAccount" }] },
  workspace: { endpoint: "/workspaces", mainKey: "workspace", idKey: "workspaceId", actions: [{ action: "suspend", label: "Suspend workspace", labelKey: "actionsSuspendWorkspace", tone: "danger" }, { action: "resume", label: "Resume workspace", labelKey: "actionsResumeWorkspace" }] },
  workshop: { endpoint: "/workshops", mainKey: "workshop", idKey: "workshopId", actions: [{ action: "unlist", label: "Unlist", labelKey: "actionsUnlist", tone: "danger" }, { action: "list", label: "List", labelKey: "actionsList" }, { action: "archive", label: "Archive", labelKey: "actionsArchive" }] },
  session: { endpoint: "/sessions", mainKey: "session", idKey: "sessionVersionId", actions: [{ action: "quarantine", label: "Quarantine", labelKey: "actionsQuarantine", tone: "danger" }, { action: "release", label: "Release", labelKey: "actionsRelease" }] },
  run: { endpoint: "/runs", mainKey: "run", idKey: "runId", actions: [{ action: "cancel", label: "Cancel run", labelKey: "actionsCancelRun", tone: "danger" }, { action: "retry", label: "Retry", labelKey: "actionsRetry" }, { action: "terminate", label: "Force terminate", labelKey: "actionsTerminateRun", tone: "danger" }] },
  mcp: { endpoint: "/mcps", mainKey: "mcp", idKey: "mcpId", actions: [{ action: "quarantine", label: "Quarantine MCP", labelKey: "actionsQuarantineMcp", tone: "danger" }, { action: "release", label: "Release", labelKey: "actionsRelease" }, { action: "disable", label: "Disable", labelKey: "actionsDisable" }] },
  credential: { endpoint: "/credentials", mainKey: "credential", idKey: "credentialId", actions: [{ action: "disable", label: "Freeze credential", labelKey: "actionsFreezeCredential", tone: "danger" }, { action: "revoke", label: "Revoke credential", labelKey: "actionsRevokeCredential", tone: "danger" }] },
};

function asObject(value: JsonValue | undefined) { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {}; }
function titleOf(record: JsonObject, id: string) {
  const name = record.displayName ?? record.title ?? record.name;
  if (name && typeof name === "object" && !Array.isArray(name)) {
    const localizedName = name as JsonObject;
    return String(i18n.resolvedLanguage?.startsWith("en") ? localizedName.en ?? localizedName.zh ?? id : localizedName.zh ?? localizedName.en ?? id);
  }
  return String(name ?? record.email ?? id);
}
function countOf(value: JsonValue | undefined) { return Array.isArray(value) ? value.length : value && typeof value === "object" ? Object.keys(value).length : value == null ? 0 : 1; }

function RotateCredential({ credentialId, onClose }: { credentialId: string; onClose: () => void }) {
  const { t } = useTranslation(["integrations", "common"]);
  const queryClient = useQueryClient();
  const [secretValue, setSecretValue] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => adminRequest<JsonObject>(`/credentials/${encodeURIComponent(credentialId)}/rotate`, { method: "POST", body: JSON.stringify({ input: { secretValue, secretRef: null, note: reason }, reason }) }),
    onSuccess: async () => { setSecretValue(""); await queryClient.invalidateQueries(); },
  });
  return <div className="modal-backdrop"><section className="modal"><header className="modal-header"><div className="modal-icon warning"><KeyRound size={20} /></div><div><p className="eyebrow">{t("integrations:credentialBroker")}</p><h2>{t("integrations:rotateTitle")}</h2><code>{credentialId}</code></div><IconButton label={t("common:closeDialog")} onClick={() => { setSecretValue(""); onClose(); }}><ArrowLeft size={18} /></IconButton></header><div className="modal-body"><label className="field"><span>{t("integrations:newSecret")}</span><textarea rows={6} value={secretValue} onChange={(event) => setSecretValue(event.target.value)} autoComplete="new-password" spellCheck={false} /></label><label className="field"><span>{t("integrations:rotateReason")}</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label>{mutation.error ? <ErrorState error={mutation.error} /> : null}{mutation.isSuccess ? <div className="operation-success"><Check size={18} />{t("integrations:rotateSuccess")}</div> : null}</div><footer className="modal-footer"><button className="button secondary" type="button" onClick={onClose}>{t("common:close")}</button><button className="button primary" type="button" disabled={secretValue.length < 1 || reason.trim().length < 8 || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <LoaderCircle className="spin" size={17} /> : <RotateCw size={17} />}{t("integrations:executeRotate")}</button></footer></section></div>;
}

export function DetailPage({ kind }: { kind: DetailKind }) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id || params.userId || params.workspaceId || params.workshopId || params.sessionId || params.runId || params.mcpId || params.credentialId || "";
  const config = configs[kind];
  const query = useQuery({ queryKey: [kind, id], queryFn: () => adminRequest<JsonObject>(`${config.endpoint}/${encodeURIComponent(id)}`), enabled: Boolean(id) });
  const [tab, setTab] = useState("overview");
  const [action, setAction] = useState<GovernanceActionSpec | null>(null);
  const [rotating, setRotating] = useState(false);
  const directMutation = useMutation({ mutationFn: (path: string) => adminRequest<JsonObject>(path, { method: "POST", body: JSON.stringify({ input: {}, reason: "Manual Admin diagnostic request" }) }), onSuccess: () => void query.refetch() });
  const data = query.data ?? {};
  const record = asObject(data[config.mainKey]) || {};
  const sections = useMemo(() => Object.keys(data).filter((key) => key !== config.mainKey && key !== "governanceStatus"), [data, config.mainKey]);
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const status = record.governanceStatus ?? data.governanceStatus ?? record.status ?? "active";
  const title = titleOf(record, id);
  return (
    <div className="page-stack detail-page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={16} />{t("backToList")}</button>
      <PageHeader eyebrow={t(`detailEyebrows.${kind}`)} title={title} description={id} actions={<>
        <StatusBadge status={status} />
        {kind === "mcp" ? <button className="button secondary" type="button" onClick={() => directMutation.mutate(`/mcps/${encodeURIComponent(id)}/probe`)} disabled={directMutation.isPending}><Play size={17} />{t("probe")}</button> : null}
        {kind === "mcp" ? <button className="button secondary" type="button" onClick={() => directMutation.mutate(`/mcps/${encodeURIComponent(id)}/tool-sync`)} disabled={directMutation.isPending}><ListRestart size={17} />{t("syncTools")}</button> : null}
        {kind === "credential" ? <button className="button secondary" type="button" onClick={() => setRotating(true)}><RotateCw size={17} />{t("rotate")}</button> : null}
        <IconButton label={t("refreshDetail")} onClick={() => void query.refetch()}><RefreshCw size={18} className={query.isFetching ? "spin" : ""} /></IconButton>
      </>} />
      {directMutation.error ? <ErrorState error={directMutation.error} /> : null}
      {directMutation.isSuccess ? <div className="operation-success"><Check size={18} />{t("operationComplete")}</div> : null}
      <section className="relation-rail" aria-label={t("details")}>
        <div className="relation-origin"><span>{t(`resourceTypes.${kind}`)}</span><strong>{title}</strong><code>{id}</code></div>
        {sections.slice(0, 6).map((key) => <button type="button" key={key} onClick={() => setTab(key)}><span>{countOf(data[key])}</span><strong>{key}</strong></button>)}
      </section>
      <Panel className="detail-overview">
        <div className="detail-summary"><div><span>{t("stableId")}</span><code>{id}</code></div><div><span>{t("status")}</span><StatusBadge status={status} /></div><div><span>{t("updatedAt")}</span><strong>{formatDate(record.updatedAt ?? record.createdAt)}</strong></div><div><span>{t("type")}</span><strong>{t(`resourceTypes.${kind}`)}</strong></div></div>
        <RecordView value={record} />
      </Panel>
      <nav className="detail-tabs">
        <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>{t("overview")}</button>
        {sections.map((key) => <button type="button" key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{key}<span>{countOf(data[key])}</span></button>)}
      </nav>
      {tab !== "overview" ? <Panel title={tab} meta={t("relatedRecords", { count: countOf(data[tab]) })}><RecordView value={data[tab]} /></Panel> : null}
      <Panel title={t("governanceActions")} meta={t("governanceMeta")} className="danger-zone">
        <div className="governance-buttons">{config.actions.map((item) => <button type="button" key={item.action} className={`button ${item.tone === "danger" ? "danger" : "secondary"}`} onClick={() => setAction(item)}><ShieldAlert size={16} />{item.labelKey ? t(item.labelKey) : item.label}</button>)}</div>
      </Panel>
      {action ? <GovernanceActionDialog resourceType={kind} resourceId={id} spec={action} onClose={() => setAction(null)} /> : null}
      {rotating ? <RotateCredential credentialId={id} onClose={() => setRotating(false)} /> : null}
    </div>
  );
}

export const UserDetailPage = () => <DetailPage kind="user" />;
export const WorkspaceDetailPage = () => <DetailPage kind="workspace" />;
export const WorkshopDetailPage = () => <DetailPage kind="workshop" />;
export const SessionDetailPage = () => <DetailPage kind="session" />;
export const RunDetailPage = () => <DetailPage kind="run" />;
export const McpDetailPage = () => <DetailPage kind="mcp" />;
export const CredentialDetailPage = () => <DetailPage kind="credential" />;
export { ProviderDetailPage } from "./ProviderDetailPage";
