import { useEffect, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, CircleAlert, Copy, Info, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { notifyUnexpectedError, subscribeToToasts, toast, type ToastRecord, type ToastTone } from "../lib/toast";

const icons: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: CircleAlert,
  warning: AlertTriangle,
  info: Info,
};

function ToastItem({ item }: { item: ToastRecord }) {
  const { t } = useTranslation("common");
  const Icon = icons[item.tone];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item.durationMs || item.durationMs <= 0) return;
    const timer = window.setTimeout(() => toast.dismiss(item.id), item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.durationMs, item.id]);

  async function copyRequestId() {
    if (!item.meta?.requestId) return;
    await navigator.clipboard.writeText(item.meta.requestId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  return (
    <article
      className={`admin-toast toast-${item.tone}`}
      role={item.tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      data-testid={`admin-toast-${item.tone}`}
    >
      <div className="toast-icon"><Icon size={19} aria-hidden="true" /></div>
      <div className="toast-content">
        <strong>{item.title}</strong>
        {item.description ? <p>{item.description}</p> : null}
        {item.meta && (item.meta.code || item.meta.requestId || item.meta.status || item.meta.path) ? (
          <div className="toast-meta">
            {item.meta.code ? <code>{item.meta.code}</code> : null}
            {item.meta.status ? <span>HTTP {item.meta.status}</span> : null}
            {item.meta.path ? <span className="toast-path">{item.meta.path}</span> : null}
            {item.meta.requestId ? (
              <button type="button" onClick={() => void copyRequestId()} title={t("toast.copyRequestId")}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? t("toast.copied") : item.meta.requestId}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <button type="button" className="toast-close" onClick={() => toast.dismiss(item.id)} aria-label={t("toast.dismiss")} title={t("toast.dismiss")}><X size={16} /></button>
      {item.durationMs && item.durationMs > 0 ? <span className="toast-life" style={{ animationDuration: `${item.durationMs}ms` }} /> : null}
    </article>
  );
}

export function ToastViewport() {
  const [items, setItems] = useState<ToastRecord[]>([]);

  useEffect(() => subscribeToToasts((command) => {
    if (command.type === "add") {
      setItems((current) => [...current, command.toast].slice(-5));
      return;
    }
    if (command.type === "dismiss") {
      setItems((current) => current.filter((item) => item.id !== command.id));
      return;
    }
    setItems([]);
  }), []);

  return (
    <section className="toast-viewport" aria-label="Notifications" aria-live="polite">
      {items.map((item) => <ToastItem item={item} key={item.id} />)}
    </section>
  );
}

export function GlobalErrorBridge() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => notifyUnexpectedError(event.error ?? event.message, i18n.t("common:toast.scriptError"));
    const onUnhandledRejection = (event: PromiseRejectionEvent) => notifyUnexpectedError(event.reason, i18n.t("common:toast.asyncError"));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
  return null;
}
