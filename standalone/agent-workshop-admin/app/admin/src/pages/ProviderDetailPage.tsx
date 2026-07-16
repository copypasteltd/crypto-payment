import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Network,
  RefreshCw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { GovernanceActionDialog, type GovernanceActionSpec } from "../components/GovernanceAction";
import { FormErrorSummary, invalidSubmitHandler } from "../components/FormFeedback";
import {
  ProviderModelsDialog,
  ProviderTestDialog,
  toProviderReference,
} from "../components/ProviderOperations";
import { ErrorState, IconButton, LoadingState, PageHeader, Panel, StatusBadge, formatDate } from "../components/ui";
import { adminRequest } from "../lib/api";
import type { JsonObject, JsonValue } from "../lib/types";
import { toast } from "../lib/toast";

type ProviderForm = {
  displayName: string;
  description: string;
  baseUrl: string;
  healthcheckPath: string;
  defaultModel: string;
  enabled: boolean;
  apiKey: string;
  reason: string;
};

function asObject(value: JsonValue | undefined): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asRows(value: JsonValue | undefined): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function text(value: JsonValue | undefined, fallback = "-") {
  return value == null || value === "" ? fallback : String(value);
}

function initialForm(provider: JsonObject): ProviderForm {
  return {
    displayName: text(provider.displayName, ""),
    description: text(provider.description, ""),
    baseUrl: text(provider.baseUrl, ""),
    healthcheckPath: text(provider.healthcheckPath, "/models"),
    defaultModel: text(provider.defaultModel, ""),
    enabled: provider.enabled !== false,
    apiKey: "",
    reason: "",
  };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function ProviderDetailPage() {
  const { t } = useTranslation(["providers", "common"]);
  const navigate = useNavigate();
  const { providerId = "" } = useParams();
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [governanceAction, setGovernanceAction] = useState<GovernanceActionSpec | null>(null);

  const query = useQuery({
    queryKey: ["provider", providerId],
    queryFn: () => adminRequest<JsonObject>(`/providers/${encodeURIComponent(providerId)}`),
    enabled: Boolean(providerId),
  });
  const data = query.data ?? {};
  const provider = asObject(data.provider);
  const models = asRows(provider.models);
  const bindings = asRows(data.bindings);
  const credentialConfigured = data.managementCredentialConfigured === true;
  const form = useForm<ProviderForm>({ defaultValues: initialForm(provider) });
  const labels: Partial<Record<keyof ProviderForm, string>> = {
    displayName: t("providers:displayName"),
    baseUrl: t("providers:baseUrl"),
    apiKey: t("providers:apiKey"),
    healthcheckPath: t("providers:healthcheckPath"),
    defaultModel: t("providers:defaultModel"),
    reason: t("providers:changeReason"),
  };

  useEffect(() => {
    if (query.data) form.reset(initialForm(asObject(query.data.provider)));
  }, [form, query.data]);

  const saveMutation = useMutation({
    mutationFn: (values: ProviderForm) => adminRequest<JsonObject>(`/providers/${encodeURIComponent(providerId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        input: {
          displayName: values.displayName,
          description: values.description.trim() || null,
          baseUrl: values.baseUrl,
          healthcheckPath: values.healthcheckPath || "/models",
          defaultModel: values.defaultModel,
          enabled: values.enabled,
        },
        authentication: values.apiKey
          ? {
              apiKey: values.apiKey,
              displayName: `${values.displayName} API Key`,
            }
          : undefined,
        reason: values.reason,
      }),
    }),
    onSuccess: async () => {
      toast.success(t("providers:configurationSaved"), { description: text(provider.displayName, providerId) });
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["providers"] }),
      ]);
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const status = provider.governanceStatus ?? (provider.enabled === false ? "disabled" : "active");
  const lastTest = asObject(provider.lastHealthcheck);
  const reference = toProviderReference(provider);
  const governanceSpec: GovernanceActionSpec = provider.enabled === false
    ? { action: "enable", label: t("common:actionsEnableProvider") }
    : { action: "disable", label: t("common:actionsDisableProvider"), tone: "danger" };

  return (
    <div className="page-stack provider-detail-page">
      <button type="button" className="back-link" onClick={() => navigate("/providers")}><ArrowLeft size={16} />{t("common:backToList")}</button>
      <PageHeader
        eyebrow={t("common:detailEyebrows.provider")}
        title={text(provider.displayName, providerId)}
        description={providerId}
        actions={
          <>
            <StatusBadge status={status} />
            <button type="button" className="button secondary" onClick={() => setModelsOpen(true)}><Download size={16} />{t("providers:fetchModels")}</button>
            <button type="button" className="button primary" onClick={() => setTestOpen(true)}><SlidersHorizontal size={16} />{t("providers:testModels")}</button>
            <IconButton label={t("common:refreshDetail")} onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={18} className={query.isFetching ? "spin" : ""} /></IconButton>
          </>
        }
      />

      <div className="provider-status-strip">
        <div><span>{t("providers:authentication")}</span><strong><KeyRound size={16} />{credentialConfigured ? t("providers:keyConfigured") : t("providers:keyMissing")}</strong></div>
        <div><span>{t("providers:lastCheck")}</span><strong>{lastTest.checkedAt ? formatDate(lastTest.checkedAt) : t("providers:notTested")}</strong></div>
        <div><span>{t("providers:health")}</span><StatusBadge status={lastTest.status ?? "not_checked"} /></div>
        <div><span>{t("providers:latency")}</span><strong>{lastTest.responseTimeMs == null ? "-" : `${text(lastTest.responseTimeMs)} ms`}</strong></div>
      </div>

      <Panel title={t("providers:configuration")} meta={t("providers:configurationNewApiMeta")} className="provider-config-panel">
        <form className="provider-config-form" noValidate onSubmit={form.handleSubmit((values) => saveMutation.mutate(values), invalidSubmitHandler(labels))}>
          <div className="form-grid">
            <label className="field"><span>{t("providers:displayName")}</span><input aria-invalid={Boolean(form.formState.errors.displayName)} {...form.register("displayName", { required: t("common:validation.required") })} /></label>
            <label className="field"><span>{t("providers:defaultModel")}</span><input list="provider-model-options" aria-invalid={Boolean(form.formState.errors.defaultModel)} {...form.register("defaultModel", { required: t("common:validation.defaultModelRequired"), validate: (value) => models.length === 0 || models.some((model) => text(model.model, "") === value.trim()) || t("common:validation.modelInCatalog") })} /><datalist id="provider-model-options">{models.map((model) => <option key={text(model.model)} value={text(model.model)} />)}</datalist></label>
          </div>
          <label className="field provider-url-field"><span>{t("providers:baseUrl")}</span><div><Network size={17} /><input type="url" aria-invalid={Boolean(form.formState.errors.baseUrl)} placeholder="https://api.example.com/v1" {...form.register("baseUrl", { required: t("common:validation.required"), validate: (value) => isHttpUrl(value) || t("common:validation.invalidUrl") })} /></div></label>
          <div className="field"><label htmlFor="provider-api-key">{t("providers:apiKey")}</label><div className="provider-secret-control"><input id="provider-api-key" type={showApiKey ? "text" : "password"} aria-invalid={Boolean(form.formState.errors.apiKey)} autoComplete="new-password" spellCheck={false} placeholder={credentialConfigured ? t("providers:keyKeepPlaceholder") : t("providers:keyRequiredPlaceholder")} {...form.register("apiKey", { validate: (value) => credentialConfigured || value.trim().length > 0 || t("common:validation.required") })} /><IconButton label={showApiKey ? t("providers:hideApiKey") : t("providers:showApiKey")} onClick={() => setShowApiKey((value) => !value)}>{showApiKey ? <EyeOff size={17} /> : <Eye size={17} />}</IconButton></div><small>{t("providers:keyUpdateHint")}</small></div>
          <label className="field"><span>{t("providers:descriptionField")}</span><textarea rows={3} {...form.register("description")} /></label>
          <details className="provider-advanced-settings"><summary>{t("providers:advancedSettings")}</summary><label className="field"><span>{t("providers:healthcheckPath")}</span><input className="mono" aria-invalid={Boolean(form.formState.errors.healthcheckPath)} placeholder="/models" {...form.register("healthcheckPath", { required: t("common:validation.required") })} /></label></details>
          <label className="toggle-field"><input type="checkbox" {...form.register("enabled")} /><span>{t("providers:enabled")}</span></label>
          <label className="field"><span>{t("providers:changeReason")}</span><textarea rows={2} aria-invalid={Boolean(form.formState.errors.reason)} {...form.register("reason", { required: t("common:validation.required"), minLength: { value: 8, message: t("common:validation.minLength", { count: 8 }) } })} /></label>
          <FormErrorSummary errors={form.formState.errors} labels={labels} />
          {saveMutation.error ? <ErrorState error={saveMutation.error} /> : null}
          {saveMutation.isSuccess && !form.formState.isDirty ? <div className="operation-success"><Check size={18} />{t("providers:configurationSaved")}</div> : null}
          <footer className="provider-form-actions"><button className="button primary" type="button" disabled={saveMutation.isPending} onClick={() => { if (!form.formState.isDirty) { toast.info(t("common:toast.noChanges")); return; } void form.handleSubmit((values) => saveMutation.mutate(values), invalidSubmitHandler(labels))(); }}>{saveMutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{t("providers:saveChanges")}</button></footer>
        </form>
      </Panel>

      <Panel title={t("providers:modelCatalog")} meta={t("providers:modelCatalogNewApiMeta", { count: models.length })}>
        <div className="provider-model-panel-actions"><p>{t("providers:modelCatalogInstruction")}</p><button type="button" className="button secondary" onClick={() => setModelsOpen(true)}><Download size={16} />{t("providers:fetchModels")}</button></div>
        {models.length ? <div className="table-scroll"><table className="data-table compact provider-model-table"><thead><tr><th>{t("providers:modelId")}</th><th>{t("providers:modelLabel")}</th><th>{t("common:status")}</th><th>{t("providers:routing")}</th></tr></thead><tbody>{models.map((model) => <tr key={text(model.model)}><td><code>{text(model.model)}</code></td><td>{text(model.label)}</td><td><StatusBadge status={model.enabled === false ? "disabled" : "available"} /></td><td>{model.isDefault ? <span className="default-model-mark"><Check size={14} />{t("providers:default")}</span> : "-"}</td></tr>)}</tbody></table></div> : <div className="provider-empty-models"><Download size={22} /><span>{t("providers:noModels")}</span></div>}
      </Panel>

      <div className="provider-secondary-grid">
        <Panel title={t("providers:bindingSummary")} meta={t("providers:bindingSummaryMeta", { count: bindings.length })}><p className="muted">{bindings.length ? t("providers:bindingSecuritySummary", { count: bindings.length }) : t("providers:noBindings")}</p></Panel>
        <Panel title={t("providers:governance")} meta={t("providers:governanceMeta")} className="danger-zone"><button type="button" className={`button ${governanceSpec.tone === "danger" ? "danger" : "secondary"}`} onClick={() => setGovernanceAction(governanceSpec)}><ShieldAlert size={16} />{governanceSpec.label}</button></Panel>
      </div>

      {modelsOpen ? <ProviderModelsDialog provider={reference} onClose={() => setModelsOpen(false)} /> : null}
      {testOpen ? <ProviderTestDialog provider={reference} onClose={() => setTestOpen(false)} /> : null}
      {governanceAction ? <GovernanceActionDialog resourceType="provider" resourceId={providerId} spec={governanceAction} onClose={() => { setGovernanceAction(null); void query.refetch(); }} /> : null}
    </div>
  );
}
