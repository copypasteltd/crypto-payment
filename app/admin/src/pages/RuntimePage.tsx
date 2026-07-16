import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Activity, RefreshCw, ServerCog } from "lucide-react";
import { NavLink } from "react-router-dom";
import { adminRequest } from "../lib/api";
import type { JsonObject } from "../lib/types";
import { ErrorState, IconButton, LoadingState, PageHeader, Panel, RecordView, StatusBadge } from "../components/ui";

export function RuntimePage() {
  const { t } = useTranslation(["runs", "common"]);
  const query = useQuery({ queryKey: ["runtime"], queryFn: () => adminRequest<JsonObject>("/runtime"), refetchInterval: 20_000 });
  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const readiness = data.readiness as JsonObject;
  const diagnostics = data.diagnostics as JsonObject;
  const connections = Array.isArray(data.bridgeConnections) ? data.bridgeConnections : [];
  return <div className="page-stack"><nav className="module-tabs"><NavLink to="/runs">{t("runs:runs")}</NavLink><NavLink to="/runtime">{t("runs:runtime")}</NavLink></nav><PageHeader eyebrow={t("runs:runtimeEyebrow")} title={t("runs:runtime")} description={t("runs:runtimeDescription")} actions={<IconButton label={t("common:refresh")} onClick={() => void query.refetch()}><RefreshCw size={18} className={query.isFetching ? "spin" : ""} /></IconButton>} /><div className="runtime-status"><div><Activity size={20} /><span>{t("runs:apiReadiness")}</span><StatusBadge status={readiness?.status} /></div><div><ServerCog size={20} /><span>{t("runs:bridgeConnections")}</span><strong>{connections.length}</strong></div><div><span>{t("runs:diagnostics")}</span><StatusBadge status={diagnostics?.status ?? "available"} /></div></div><div className="runtime-grid"><Panel title={t("runs:readinessProbes")} meta={t("runs:readinessMeta")}><RecordView value={readiness} /></Panel><Panel title={t("runs:runtimeDiagnostics")} meta={t("runs:runtimeMeta")}><RecordView value={diagnostics} /></Panel></div><Panel title={t("runs:bridgeConnections")} meta={t("runs:registeredConnections", { count: connections.length })}><RecordView value={connections} /></Panel><Panel title={t("runs:fileLifecycle")} meta={t("runs:fileLifecycleMeta")}><RecordView value={data.fileLifecycle} /></Panel></div>;
}
