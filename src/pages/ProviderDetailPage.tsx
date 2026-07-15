import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Check,
  Clock3,
  DatabaseZap,
  KeyRound,
  ListRestart,
  LoaderCircle,
  Network,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { CreateCredentialDialog } from "../components/CreateDialogs";
import { GovernanceActionDialog, type GovernanceActionSpec } from "../components/GovernanceAction";
import { ErrorState, IconButton, LoadingState, PageHeader, Panel, StatusBadge, formatDate } from "../components/ui";
import { adminRequest } from "../lib/api";
import type { JsonObject, JsonValue, ListResponse } from "../lib/types";

type ProviderForm = {
  displayName: string;
  description: string;
  baseUrl: string;
  healthcheckPath: string;
  defaultModel: string;
  enabled: boolean;
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

function list(value: JsonValue | undefined) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function buildHealthEndpoint(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/g, "")}/${(path || "/models").replace(/^\/+/, "")}`;
}

function initialForm(provider: JsonObject): ProviderForm {
  return {
    displayName: text(provider.displayName, ""),
    description: text(provider.description, ""),
    baseUrl: text(provider.baseUrl, ""),
    healthcheckPath: text(provider.healthcheckPath, "/models"),
    defaultModel: text(provider.defaultModel, ""),
    enabled: provider.enabled !== false,
    reason: "",
  };
}

export function ProviderDetailPage() {
  const { t } = useTranslation(["providers", "common"]);
  const navigate = useNavigate();
  const { providerId = "" } = useParams();
  const queryClient = useQueryClient();
  const [credentialId, setCredentialId] = useState("");
  const [diagnosticReason, setDiagnosticReason] = useState(() => t("providers:diagnosticReasonDefault"));
  const [writingCredential, setWritingCredential] = useState(false);
  const [governanceAction, setGovernanceAction] = useState<GovernanceActionSpec | null>(null);

  const query = useQuery({
    queryKey: ["provider", providerId],
    queryFn: () => adminRequest<JsonObject>(`/providers/${encodeURIComponent(providerId)}`),
    enabled: Boolean(providerId),
  });
  const credentialsQuery = useQuery({
    queryKey: ["credentials", "provider-diagnostics"],
    queryFn: () => adminRequest<ListResponse<JsonObject>>("/credentials?page=1&pageSize=100&status=active"),
  });

  const data = query.data ?? {};
  const provider = asObject(data.provider);
  const models = asRows(provider.models);
  const bindings = asRows(data.bindings);
  const credentials = credentialsQuery.data?.items ?? [];
  const enabledBindingCredentialIds = useMemo(
    () => bindings.filter((binding) => binding.enabled !== false).map((binding) => text(binding.credentialId, "")).filter(Boolean),
    [bindings]
  );
  const form = useForm<ProviderForm>({ defaultValues: initialForm(provider) });
  const watchedBaseUrl = form.watch("baseUrl");
  const watchedHealthcheckPath = form.watch("healthcheckPath");

  useEffect(() => {
    if (query.data) form.reset(initialForm(asObject(query.data.provider)));
  }, [form, query.data]);

  useEffect(() => {
    if (credentialId || credentials.length === 0) return;
    const boundCredential = enabledBindingCredentialIds.find((id) => credentials.some((credential) => credential.credentialId === id));
    setCredentialId(boundCredential ?? text(credentials[0]?.credentialId, ""));
  }, [credentialId, credentials, enabledBindingCredentialIds]);

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
        reason: values.reason,
      }),
    }),
    onSuccess: async () => {
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["providers"] }),
      ]);
    },
  });

  const healthMutation = useMutation({
    mutationFn: () => adminRequest<JsonObject>(`/providers/${encodeURIComponent(providerId)}/health-check`, {
      method: "POST",
      body: JSON.stringify({
        input: credentialId ? { credentialId } : {},
        reason: diagnosticReason,
      }),
    }),
    onSuccess: async () => {
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["providers"] }),
      ]);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => adminRequest<JsonObject>(`/providers/${encodeURIComponent(providerId)}/model-sync`, {
      method: "POST",
      body: JSON.stringify({
        input: credentialId ? { credentialId } : {},
        reason: diagnosticReason,
      }),
    }),
    onSuccess: async () => {
      await Promise.all([
        query.refetch(),
        queryClient.invalidateQueries({ queryKey: ["providers"] }),
      ]);
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  const status = provider.governanceStatus ?? (provider.enabled === false ? "disabled" : "active");
  const currentHealth = asObject(provider.lastHealthcheck);
  const healthResult = healthMutation.data ? asObject(healthMutation.data.healthcheck) : currentHealth;
  const healthEndpoint = buildHealthEndpoint(watchedBaseUrl, watchedHealthcheckPath);
  const reasonValid = diagnosticReason.trim().length >= 8;
  const diagnosticPending = healthMutation.isPending || syncMutation.isPending;
  const selectedCredential = credentials.find((credential) => credential.credentialId === credentialId);
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
        actions={<><StatusBadge status={status} /><IconButton label={t("common:refreshDetail")} onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={18} className={query.isFetching ? "spin" : ""} /></IconButton></>}
      />

      <div className="provider-control-grid">
        <Panel title={t("providers:configuration")} meta={t("providers:configurationMeta")} className="provider-config-panel">
          <form className="provider-config-form" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
            <div className="form-grid">
              <label className="field"><span>{t("providers:displayName")}</span><input {...form.register("displayName", { required: true })} /></label>
              <label className="field"><span>{t("providers:defaultModel")}</span><input list="provider-model-options" {...form.register("defaultModel", { required: true })} /><datalist id="provider-model-options">{models.map((model) => <option key={text(model.model)} value={text(model.model)} />)}</datalist></label>
            </div>
            <label className="field provider-url-field"><span>{t("providers:baseUrl")}</span><div><Network size={17} /><input type="url" placeholder="https://api.example.com/v1" {...form.register("baseUrl", { required: true, pattern: /^https?:\/\//i })} /></div></label>
            <label className="field"><span>{t("providers:healthcheckPath")}</span><input className="mono" placeholder="/models" {...form.register("healthcheckPath", { required: true })} /><small>{healthEndpoint}</small></label>
            <label className="field"><span>{t("providers:descriptionField")}</span><textarea rows={3} {...form.register("description")} /></label>
            <label className="toggle-field"><input type="checkbox" {...form.register("enabled")} /><span>{t("providers:enabled")}</span></label>
            <label className="field"><span>{t("providers:changeReason")}</span><textarea rows={2} {...form.register("reason", { required: true, minLength: 8 })} /></label>
            {saveMutation.error ? <ErrorState error={saveMutation.error} /> : null}
            {saveMutation.isSuccess && !form.formState.isDirty ? <div className="operation-success"><Check size={18} />{t("providers:configurationSaved")}</div> : null}
            <footer className="provider-form-actions"><button className="button primary" type="submit" disabled={!form.formState.isDirty || saveMutation.isPending}>{saveMutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{t("providers:saveChanges")}</button></footer>
          </form>
        </Panel>

        <Panel title={t("providers:diagnostics")} meta={t("providers:diagnosticsMeta")} className="provider-diagnostics-panel">
          <div className="diagnostic-endpoint"><span>{t("providers:requestEndpoint")}</span><code>{healthEndpoint}</code></div>
          <label className="field"><span>{t("providers:credential")}</span><select value={credentialId} onChange={(event) => setCredentialId(event.target.value)} disabled={credentialsQuery.isLoading}><option value="">{t("providers:publicAccess")}</option>{credentials.map((credential) => <option key={text(credential.credentialId)} value={text(credential.credentialId)}>{text(credential.displayName)} · {text(credential.credentialId)}{enabledBindingCredentialIds.includes(text(credential.credentialId, "")) ? ` · ${t("providers:bound")}` : ""}</option>)}</select></label>
          <div className="credential-context"><KeyRound size={16} /><div><strong>{selectedCredential ? text(selectedCredential.displayName) : t("providers:noCredential")}</strong><span>{selectedCredential ? `${text(selectedCredential.scope)} · ${text(selectedCredential.status)}` : t("providers:publicAccessMeta")}</span></div><button type="button" className="button secondary compact-button" onClick={() => setWritingCredential(true)}><Plus size={15} />{t("providers:addCredential")}</button></div>
          <label className="field"><span>{t("providers:diagnosticReason")}</span><textarea rows={2} value={diagnosticReason} onChange={(event) => setDiagnosticReason(event.target.value)} /></label>
          {form.formState.isDirty ? <div className="provider-save-warning"><ShieldAlert size={17} />{t("providers:saveBeforeDiagnostic")}</div> : null}
          <div className="diagnostic-actions">
            <button className="button secondary" type="button" onClick={() => healthMutation.mutate()} disabled={form.formState.isDirty || !reasonValid || diagnosticPending}>{healthMutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Activity size={17} />}{t("common:healthCheck")}</button>
            <button className="button primary" type="button" onClick={() => syncMutation.mutate()} disabled={form.formState.isDirty || !reasonValid || diagnosticPending}>{syncMutation.isPending ? <LoaderCircle className="spin" size={17} /> : <ListRestart size={17} />}{t("common:syncModels")}</button>
          </div>
          {healthMutation.error ? <ErrorState error={healthMutation.error} /> : null}
          {syncMutation.error ? <ErrorState error={syncMutation.error} /> : null}
          {Object.keys(healthResult).length ? <div className="diagnostic-result"><div><StatusBadge status={healthResult.status} /><strong>{text(healthResult.httpStatus, t("providers:noHttpStatus"))}</strong></div><dl><div><dt>{t("providers:latency")}</dt><dd>{text(healthResult.responseTimeMs)} ms</dd></div><div><dt>{t("providers:lastCheck")}</dt><dd>{formatDate(healthResult.checkedAt)}</dd></div></dl>{healthResult.errorMessage ? <p>{text(healthResult.errorMessage)}</p> : null}</div> : null}
          {syncMutation.data ? <div className="sync-result"><div><DatabaseZap size={18} /><strong>{t("providers:syncComplete")}</strong></div><dl><div><dt>{t("providers:discovered")}</dt><dd>{text(syncMutation.data.discoveredModelCount, "0")}</dd></div><div><dt>{t("providers:added")}</dt><dd>{list(syncMutation.data.addedModelIds).length}</dd></div><div><dt>{t("providers:disabledModels")}</dt><dd>{list(syncMutation.data.disabledModelIds).length}</dd></div></dl><span><Clock3 size={14} />{formatDate(syncMutation.data.syncedAt)}</span></div> : null}
        </Panel>
      </div>

      <Panel title={t("providers:modelCatalog")} meta={t("providers:modelCatalogMeta", { count: models.length })}>
        {models.length ? <div className="table-scroll"><table className="data-table compact provider-model-table"><thead><tr><th>{t("providers:modelId")}</th><th>{t("providers:modelLabel")}</th><th>{t("common:status")}</th><th>{t("providers:routing")}</th></tr></thead><tbody>{models.map((model) => <tr key={text(model.model)}><td><code>{text(model.model)}</code></td><td>{text(model.label)}</td><td><StatusBadge status={model.enabled === false ? "disabled" : "available"} /></td><td>{model.isDefault ? <span className="default-model-mark"><Check size={14} />{t("providers:default")}</span> : "-"}</td></tr>)}</tbody></table></div> : <div className="provider-empty-models"><DatabaseZap size={22} /><span>{t("providers:noModels")}</span></div>}
      </Panel>

      <div className="provider-secondary-grid">
        <Panel title={t("providers:bindingSummary")} meta={t("providers:bindingSummaryMeta", { count: bindings.length })}>{bindings.length ? <div className="provider-binding-list">{bindings.map((binding) => <div key={text(binding.bindingId)}><div><strong>{text(binding.workspaceId)}</strong><code>{text(binding.credentialId)}</code></div><StatusBadge status={binding.enabled === false ? "disabled" : "active"} /></div>)}</div> : <span className="muted">{t("providers:noBindings")}</span>}</Panel>
        <Panel title={t("providers:governance")} meta={t("providers:governanceMeta")} className="danger-zone"><button type="button" className={`button ${governanceSpec.tone === "danger" ? "danger" : "secondary"}`} onClick={() => setGovernanceAction(governanceSpec)}><ShieldAlert size={16} />{governanceSpec.label}</button></Panel>
      </div>

      {writingCredential ? <CreateCredentialDialog initialProvider={providerId} onCreated={(credential) => { setCredentialId(text(credential.credentialId, "")); setWritingCredential(false); }} onClose={() => setWritingCredential(false)} /> : null}
      {governanceAction ? <GovernanceActionDialog resourceType="provider" resourceId={providerId} spec={governanceAction} onClose={() => { setGovernanceAction(null); void query.refetch(); }} /> : null}
    </div>
  );
}
