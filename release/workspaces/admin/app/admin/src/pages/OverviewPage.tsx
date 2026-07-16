import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, ArrowUpRight, Boxes, CircleDollarSign, Network, PlugZap, RefreshCw, UsersRound } from "lucide-react";
import { adminRequest } from "../lib/api";
import type { JsonObject } from "../lib/types";
import { DataTable, type DataColumn } from "../components/DataTable";
import { ErrorState, IconButton, LoadingState, PageHeader, Panel, StatusBadge, formatDate } from "../components/ui";

type Overview = JsonObject & {
  generatedAt: string;
  health: JsonObject;
  metrics: JsonObject;
  anomalies: JsonObject[];
  recentAdminEvents: JsonObject[];
};

const routeByType: Record<string, string> = {
  user: "/accounts/users",
  workspace: "/accounts/workspaces",
  workshop: "/catalog/workshops",
  session: "/catalog/sessions",
  run: "/runs",
  provider: "/providers",
  mcp: "/integrations/mcps",
  credential: "/integrations/credentials",
};

function metric(metrics: JsonObject, key: string) {
  const value = metrics[key];
  return typeof value === "number" ? value : 0;
}

export function OverviewPage() {
  const { t, i18n } = useTranslation(["overview", "common"]);
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["overview"], queryFn: () => adminRequest<Overview>("/overview"), refetchInterval: 30_000 });
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const metrics = data.metrics;
  const numberFormat = new Intl.NumberFormat(i18n.resolvedLanguage || "zh-CN");
  const cards = [
    { key: "accounts", label: t("overview:accountsSpaces"), value: metric(metrics, "users"), detail: t("overview:workspacesDetail", { count: metric(metrics, "workspaces") }), icon: UsersRound, route: "/accounts/users", tone: "accent" },
    { key: "runs", label: t("overview:activeRuns"), value: metric(metrics, "activeRuns"), detail: t("overview:activeRunsDetail", { failed: metric(metrics, "failedRuns"), total: metric(metrics, "runs") }), icon: Activity, route: "/runs", tone: metric(metrics, "failedRuns") > 0 ? "danger" : "success" },
    { key: "providers", label: t("overview:providers"), value: metric(metrics, "providers"), detail: t("overview:providerIssues", { count: metric(metrics, "providerIssues") }), icon: Network, route: "/providers", tone: metric(metrics, "providerIssues") > 0 ? "warning" : "success" },
    { key: "integrations", label: t("overview:mcpCredentials"), value: metric(metrics, "mcps"), detail: t("overview:credentialsDue", { count: metric(metrics, "expiringCredentials") }), icon: PlugZap, route: "/integrations/mcps", tone: metric(metrics, "mcpIssues") > 0 ? "warning" : "accent" },
    { key: "workshops", label: t("overview:workshops"), value: metric(metrics, "publishedWorkshops"), detail: t("overview:workshopsDetail", { count: metric(metrics, "sessions") }), icon: Boxes, route: "/catalog/workshops", tone: "accent" },
    { key: "cost", label: t("overview:monthCost"), value: `$${metric(metrics, "monthlyCostUsd").toFixed(2)}`, detail: t("overview:monthCostDetail"), icon: CircleDollarSign, route: "/billing/ledger", tone: "cost" },
  ];
  const anomalyColumns: DataColumn<JsonObject>[] = [
    { key: "severity", label: t("overview:severity"), width: 110, render: (row) => <StatusBadge status={row.severity} /> },
    { key: "title", label: t("overview:object"), render: (row) => <div className="primary-cell"><strong>{String(row.title ?? row.resourceId)}</strong><code>{String(row.resourceId ?? "")}</code></div> },
    { key: "detail", label: t("overview:latestDiagnosis"), render: (row) => <span className="truncate-cell">{String(row.detail ?? "-")}</span> },
    { key: "time", label: t("overview:occurredAt"), width: 180, render: (row) => formatDate(row.occurredAt) },
    { key: "open", label: "", width: 50, render: () => <ArrowUpRight size={16} /> },
  ];
  return (
    <div className="page-stack">
      <PageHeader eyebrow={t("overview:eyebrow")} title={t("overview:title")} description={t("overview:description", { time: formatDate(data.generatedAt) })} actions={<IconButton label={t("common:refresh")} onClick={() => void query.refetch()}><RefreshCw size={18} className={query.isFetching ? "spin" : ""} /></IconButton>} />
      <div className="health-ribbon">
        <div><span className="health-pulse" /><strong>{t("overview:controlPlane")}</strong><StatusBadge status={(data.health.api as JsonObject | undefined)?.status ?? "unknown"} /></div>
        <div><span>{t("overview:activeRuns")}</span><strong>{metric(metrics, "activeRuns")}</strong></div>
        <div><span>{t("overview:quarantinedSessions")}</span><strong>{metric(metrics, "quarantinedSessions")}</strong></div>
        <div><span>{t("overview:suspendedWorkspaces")}</span><strong>{metric(metrics, "suspendedWorkspaces")}</strong></div>
        <button type="button" onClick={() => navigate("/runtime")}>{t("overview:runtimeDiagnostics")} <ArrowUpRight size={15} /></button>
      </div>
      <section className="metric-grid">
        {cards.map((card) => { const Icon = card.icon; return <button type="button" className={`metric-card tone-${card.tone}`} key={card.key} onClick={() => navigate(card.route)}><div className="metric-icon"><Icon size={20} /></div><span>{card.label}</span><strong>{typeof card.value === "number" ? numberFormat.format(card.value) : card.value}</strong><small>{card.detail}</small><ArrowUpRight size={16} className="metric-arrow" /></button>; })}
      </section>
      <div className="overview-columns">
        <Panel title={t("overview:anomalyQueue")} meta={t("overview:unresolvedSignals", { count: data.anomalies.length })} actions={<button className="button link" type="button" onClick={() => navigate("/audit")}>{t("overview:viewAll")}</button>}>
          {data.anomalies.length ? <DataTable rows={data.anomalies} columns={anomalyColumns} rowKey={(row) => `${row.resourceType}:${row.resourceId}`} onRowClick={(row) => navigate(`${routeByType[String(row.resourceType)] || "/audit"}/${encodeURIComponent(String(row.resourceId))}`)} /> : <div className="clear-state"><Activity size={22} /><strong>{t("overview:noAnomalies")}</strong><span>{t("overview:noAnomaliesHint")}</span></div>}
        </Panel>
        <Panel title={t("overview:recentAdminOperations")} meta={t("overview:immutableAudit")}>
          {data.recentAdminEvents.length ? <div className="timeline">{data.recentAdminEvents.slice(0, 8).map((event) => <div className="timeline-item" key={String(event.eventId)}><span className={`timeline-marker ${event.outcome === "failed" ? "danger" : ""}`} /><div><strong>{String(event.action)} · {String(event.resourceType)}</strong><code>{String(event.resourceId)}</code><small>{String(event.actorEmail ?? "system")} · {formatDate(event.occurredAt)}</small></div><StatusBadge status={event.outcome} /></div>)}</div> : <div className="clear-state"><AlertTriangle size={21} /><strong>{t("overview:noEvents")}</strong><span>{t("overview:noEventsHint")}</span></div>}
        </Panel>
      </div>
    </div>
  );
}
