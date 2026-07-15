import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Circle, LoaderCircle, RefreshCw, XCircle } from "lucide-react";
import type { AdminApiError } from "../lib/api";
import type { JsonObject, JsonValue } from "../lib/types";
import i18n from "../i18n";

export function IconButton({
  label,
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: unknown }) {
  const { t } = useTranslation("common");
  const text = String(status ?? "unknown");
  const normalized = text.toLowerCase();
  const statusKey = normalized.replace(/[\s-]+/g, "_");
  const tone = /active|ready|healthy|success|completed|online|approved/.test(normalized)
    ? "success"
    : /failed|error|revoked|critical|unhealthy|terminated|blocked/.test(normalized)
      ? "danger"
      : /warn|pending|degraded|rotation|waiting|draining|suspended|quarantined|auth_required/.test(normalized)
        ? "warning"
        : /running|starting|created|info/.test(normalized)
          ? "info"
          : "neutral";
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" ? XCircle : tone === "warning" ? AlertTriangle : Circle;
  return (
    <span className={`status-badge status-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      {t(`statusValues.${statusKey}`, { defaultValue: text })}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Panel({ title, meta, actions, children, className = "" }: {
  title?: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title || actions ? (
        <header className="panel-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {meta ? <p>{meta}</p> : null}
          </div>
          {actions ? <div className="panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation("common");
  return (
    <div className="state-view" role="status">
      <LoaderCircle className="spin" size={24} aria-hidden="true" />
      <span>{label ?? t("loading")}</span>
    </div>
  );
}

export function EmptyState({ label }: { label?: string }) {
  const { t } = useTranslation("common");
  return (
    <div className="state-view empty-state">
      <Circle size={20} aria-hidden="true" />
      <span>{label ?? t("empty")}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const { t } = useTranslation("common");
  const apiError = error as AdminApiError;
  return (
    <div className="state-view error-state" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <strong>{error.message}</strong>
      {apiError.code ? <code>{apiError.code}</code> : null}
      {apiError.requestId ? <span>{t("requestId")}: {apiError.requestId}</span> : null}
      {onRetry ? (
        <button type="button" className="button secondary" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}

export function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(i18n.resolvedLanguage || "zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

export function formatValue(value: JsonValue | undefined): ReactNode {
  if (value == null) return <span className="muted">-</span>;
  if (typeof value === "boolean") return value ? i18n.t("common:yes") : i18n.t("common:no");
  if (typeof value === "number") return new Intl.NumberFormat(i18n.resolvedLanguage || "zh-CN").format(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDate(value);
    return value;
  }
  return JSON.stringify(value);
}

export function SummaryGrid({ record, fields }: { record: JsonObject; fields: Array<{ key: string; label: string; mono?: boolean }> }) {
  return (
    <dl className="summary-grid">
      {fields.map((field) => (
        <div key={field.key}>
          <dt>{field.label}</dt>
          <dd className={field.mono ? "mono" : ""}>{formatValue(record[field.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function objectEntries(value: JsonObject) {
  return Object.entries(value).filter(([, item]) => item !== undefined);
}

export function RecordView({ value, depth = 0 }: { value: JsonValue | undefined; depth?: number }) {
  if (value == null || typeof value !== "object") return <>{formatValue(value)}</>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <EmptyState />;
    const objectRows = value.filter((item): item is JsonObject => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    if (objectRows.length === value.length && depth < 2) {
      const keys = Array.from(new Set(objectRows.flatMap((item) => Object.keys(item)))).slice(0, 7);
      return (
        <div className="table-scroll">
          <table className="data-table compact">
            <thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead>
            <tbody>
              {objectRows.map((row, index) => (
                <tr key={String(row.id ?? row.eventId ?? row.runId ?? row.userId ?? index)}>
                  {keys.map((key) => <td key={key}>{formatValue(row[key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <ul className="value-list">{value.map((item, index) => <li key={index}><RecordView value={item} depth={depth + 1} /></li>)}</ul>;
  }
  if (depth >= 1) {
    return <pre className="json-block">{JSON.stringify(value, null, 2)}</pre>;
  }
  return (
    <dl className="record-view">
      {objectEntries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd><RecordView value={item} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  );
}
