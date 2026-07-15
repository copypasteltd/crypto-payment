import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw, Search, X } from "lucide-react";
import { adminRequest } from "../lib/api";
import type { JsonObject, ListResponse } from "../lib/types";
import { DataTable, type DataColumn } from "./DataTable";
import { ErrorState, IconButton, LoadingState, PageHeader, Panel } from "./ui";

export function ResourceListPage<T extends JsonObject>({
  queryKey,
  endpoint,
  eyebrow,
  title,
  description,
  columns,
  rowKey,
  detailPath,
  headerActions,
  statusOptions = [],
}: {
  queryKey: string;
  endpoint: string;
  eyebrow: string;
  title: string;
  description: string;
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  detailPath?: (row: T) => string;
  headerActions?: React.ReactNode;
  statusOptions?: string[];
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const page = Math.max(1, Number(params.get("page") || 1));
  const url = useMemo(() => {
    const search = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (q) search.set("q", q);
    if (status) search.set("status", status);
    return `${endpoint}?${search}`;
  }, [endpoint, page, q, status]);
  const query = useQuery({
    queryKey: [queryKey, q, status, page],
    queryFn: () => adminRequest<ListResponse<T>>(url),
  });

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            <IconButton label={t("refresh")} onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={18} className={query.isFetching ? "spin" : ""} />
            </IconButton>
          </>
        }
      />
      <Panel className="table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              value={q}
              onChange={(event) => updateParam("q", event.target.value)}
              placeholder={t("searchListPlaceholder")}
              aria-label={t("search")}
            />
            {q ? <IconButton label={t("clearSearch")} onClick={() => updateParam("q", "")}><X size={16} /></IconButton> : null}
          </label>
          {statusOptions.length ? (
            <select value={status} onChange={(event) => updateParam("status", event.target.value)} aria-label={t("status")}>
              <option value="">{t("allStatuses")}</option>
              {statusOptions.map((option) => <option key={option} value={option}>{t(`statusValues.${option.toLowerCase().replace(/[\s-]+/g, "_")}`, { defaultValue: option })}</option>)}
            </select>
          ) : null}
          <span className="result-count">{t("recordsCount", { count: query.data?.pageInfo.total ?? 0 })}</span>
        </div>
        {query.isLoading ? <LoadingState /> : null}
        {query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
        {query.data ? (
          <DataTable
            rows={query.data.items}
            columns={columns}
            rowKey={rowKey}
            onRowClick={detailPath ? (row) => navigate(detailPath(row)) : undefined}
            pageInfo={query.data.pageInfo}
            onPageChange={(nextPage) => updateParam("page", String(nextPage))}
          />
        ) : null}
      </Panel>
    </div>
  );
}
