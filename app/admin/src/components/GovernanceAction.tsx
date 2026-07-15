import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, LoaderCircle, ShieldAlert, X } from "lucide-react";
import { adminRequest } from "../lib/api";
import type { JsonObject } from "../lib/types";
import { ErrorState, IconButton, RecordView } from "./ui";

type Impact = {
  operationId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  impactHash: string;
  impact: JsonObject;
  confirmationPhrase: string;
  expiresAt: string;
};

export type GovernanceActionSpec = {
  action: string;
  label: string;
  labelKey?: string;
  tone?: "default" | "danger";
};

export function GovernanceActionDialog({
  resourceType,
  resourceId,
  spec,
  onClose,
}: {
  resourceType: string;
  resourceId: string;
  spec: GovernanceActionSpec;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("common");
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const impact = useMutation({
    mutationFn: () =>
      adminRequest<Impact>("/actions/impact", {
        method: "POST",
        body: JSON.stringify({ resourceType, resourceId, action: spec.action }),
      }),
  });
  const execute = useMutation({
    mutationFn: (operation: Impact) =>
      adminRequest<JsonObject>("/actions/execute", {
        method: "POST",
        body: JSON.stringify({
          operationId: operation.operationId,
          impactHash: operation.impactHash,
          confirmation,
          reason,
          expectedVersion:
            typeof operation.impact.version === "number" && operation.impact.version > 0
              ? operation.impact.version
              : null,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ refetchType: "none" }),
  });

  useEffect(() => {
    impact.mutate();
    // The operation is intentionally created once for each dialog instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const operation = impact.data;
  const displayLabel = spec.labelKey ? t(spec.labelKey) : spec.label;
  const canExecute =
    Boolean(operation) &&
    reason.trim().length >= 8 &&
    confirmation === operation?.confirmationPhrase &&
    !execute.isPending;

  const closeDialog = () => {
    const shouldRefresh = execute.isSuccess;
    onClose();
    if (shouldRefresh) void queryClient.refetchQueries({ type: "active" });
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) closeDialog();
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <section className="modal action-modal" role="dialog" aria-modal="true" aria-labelledby="action-title">
        <header className="modal-header">
          <div className={`modal-icon ${spec.tone === "danger" ? "danger" : "warning"}`}>
            {spec.tone === "danger" ? <ShieldAlert size={21} /> : <AlertTriangle size={21} />}
          </div>
          <div>
            <p className="eyebrow">{t("impactReview")}</p>
            <h2 id="action-title">{displayLabel}</h2>
            <code>{resourceType}:{resourceId}</code>
          </div>
          <IconButton label={t("closeDialog")} onClick={closeDialog}><X size={19} /></IconButton>
        </header>
        <div className="modal-body">
          {impact.isPending ? <div className="state-view"><LoaderCircle className="spin" size={22} />{t("calculatingImpact")}</div> : null}
          {impact.error ? <ErrorState error={impact.error} onRetry={() => impact.mutate()} /> : null}
          {operation ? (
            <>
              <div className="impact-box">
                <header><span>{t("impactScope")}</span><time>{t("validUntil", { time: new Date(operation.expiresAt).toLocaleTimeString(i18n.resolvedLanguage) })}</time></header>
                <RecordView value={operation.impact} />
              </div>
              <label className="field">
                <span>{t("operationReason")}</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder={t("operationReasonPlaceholder")} />
                <small>{reason.trim().length}/8 · {t("minimumLength", { count: 8 })}</small>
              </label>
              <label className="field">
                <span>{t("confirmationPhrase")}</span>
                <code className="confirmation-phrase">{operation.confirmationPhrase}</code>
                <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} />
              </label>
              {execute.error ? <ErrorState error={execute.error} /> : null}
              {execute.isSuccess ? (
                <div className="operation-success"><Check size={18} />{t("operationExecuted")}</div>
              ) : null}
            </>
          ) : null}
        </div>
        <footer className="modal-footer">
          <button type="button" className="button secondary" onClick={closeDialog}>{execute.isSuccess ? t("close") : t("cancel")}</button>
          {!execute.isSuccess ? (
            <button type="button" className={`button ${spec.tone === "danger" ? "danger" : "primary"}`} disabled={!canExecute} onClick={() => operation && execute.mutate(operation)}>
              {execute.isPending ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
              {t("confirmExecute")}
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}

export function RowActions({
  resourceType,
  resourceId,
  actions,
}: {
  resourceType: string;
  resourceId: string;
  actions: GovernanceActionSpec[];
}) {
  const { t } = useTranslation("common");
  const [selected, setSelected] = useState<GovernanceActionSpec | null>(null);
  return (
    <>
      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        {actions.slice(0, 2).map((action) => (
          <button
            type="button"
            key={action.action}
            className={`table-action ${action.tone === "danger" ? "danger" : ""}`}
            onClick={() => setSelected(action)}
          >
            {action.labelKey ? t(action.labelKey) : action.label}
          </button>
        ))}
      </div>
      {selected ? (
        <GovernanceActionDialog
          resourceType={resourceType}
          resourceId={resourceId}
          spec={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </>
  );
}
