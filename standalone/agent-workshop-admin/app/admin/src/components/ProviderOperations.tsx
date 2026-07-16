import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Check,
  Download,
  Gauge,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { adminRequest } from "../lib/api";
import type { JsonObject, JsonValue } from "../lib/types";
import { toast } from "../lib/toast";
import { ErrorState, IconButton, StatusBadge } from "./ui";

type ModelFetchResponse = {
  modelListUrl: string;
  fetchedModelIds: string[];
  addedModelIds: string[];
  existingModelIds: string[];
  removedModelIds: string[];
  fetchedAt: string;
};

type ProviderTestResponse = {
  success: boolean;
  model: string;
  endpointType: string;
  stream: boolean;
  responseTimeMs: number;
  httpStatus: number | null;
  message: string;
  testedAt: string;
};

type ProviderReference = {
  providerId: string;
  displayName: string;
  baseUrl: string;
  healthcheckPath: string;
  defaultModel: string;
  models: string[];
};

type UnsavedProviderReference = {
  displayName: string;
  baseUrl: string;
  healthcheckPath: string;
  apiKey?: string;
  models: string[];
};

function text(value: JsonValue | undefined, fallback = "") {
  return value == null ? fallback : String(value);
}

function asObjects(value: JsonValue | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

export function toProviderReference(provider: JsonObject): ProviderReference {
  return {
    providerId: text(provider.providerId),
    displayName: text(provider.displayName),
    baseUrl: text(provider.baseUrl),
    healthcheckPath: text(provider.healthcheckPath, "/models"),
    defaultModel: text(provider.defaultModel),
    models: asObjects(provider.models)
      .filter((model) => model.enabled !== false)
      .map((model) => text(model.model))
      .filter(Boolean),
  };
}

function normalizeModels(models: string[]) {
  return [...new Set(models.map((model) => model.trim()).filter(Boolean))];
}

export function ProviderModelsDialog({
  provider,
  unsaved,
  onModelsSelected,
  onClose,
}: {
  provider?: ProviderReference;
  unsaved?: UnsavedProviderReference;
  onModelsSelected?: (models: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(["providers", "common"]);
  const queryClient = useQueryClient();
  const existingModels = useMemo(
    () => normalizeModels(provider?.models ?? unsaved?.models ?? []),
    [provider?.models, unsaved?.models]
  );
  const [result, setResult] = useState<ModelFetchResponse | null>(null);
  const [selected, setSelected] = useState<string[]>(existingModels);
  const [activeTab, setActiveTab] = useState<"added" | "existing" | "removed">("added");
  const [search, setSearch] = useState("");

  const fetchMutation = useMutation({
    mutationFn: () => provider
      ? adminRequest<ModelFetchResponse>(`/providers/${encodeURIComponent(provider.providerId)}/fetch-models`, {
          method: "POST",
          body: JSON.stringify({}),
        })
      : adminRequest<ModelFetchResponse>("/providers/fetch-models", {
          method: "POST",
          body: JSON.stringify({
            input: {
              baseUrl: unsaved?.baseUrl,
              healthcheckPath: unsaved?.healthcheckPath || "/models",
              apiKey: unsaved?.apiKey || undefined,
            },
          }),
        }),
    onSuccess: (response) => {
      toast.success(t("providers:modelsFetched"), { description: t("providers:modelsFetchedSummary", { count: response.fetchedModelIds.length }) });
      setResult(response);
      setSelected(existingModels);
      setActiveTab(
        response.addedModelIds.length
          ? "added"
          : response.removedModelIds.length
            ? "removed"
            : "existing"
      );
    },
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const modelIds = normalizeModels(selected);
      if (onModelsSelected) {
        onModelsSelected(modelIds);
        return null;
      }
      if (!provider) return null;
      const defaultModel = modelIds.includes(provider.defaultModel) ? provider.defaultModel : modelIds[0];
      return adminRequest<JsonObject>(`/providers/${encodeURIComponent(provider.providerId)}/models`, {
        method: "PUT",
        body: JSON.stringify({
          input: { modelIds, defaultModel },
          reason: "Apply selected upstream Provider model catalog",
        }),
      });
    },
    onSuccess: async () => {
      toast.success(onModelsSelected ? t("providers:modelsFilled") : t("providers:modelsSaved"), { description: t("providers:selectedModels", { count: selected.length }) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["providers"] }),
        provider
          ? queryClient.invalidateQueries({ queryKey: ["provider", provider.providerId] })
          : Promise.resolve(),
      ]);
      onClose();
    },
  });

  useEffect(() => {
    fetchMutation.mutate();
    // Fetch once for each dialog instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = {
    added: result?.addedModelIds ?? [],
    existing: result?.existingModelIds ?? [],
    removed: result?.removedModelIds ?? [],
  };
  const visibleModels = groups[activeTab].filter((model) =>
    model.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedSet = new Set(selected);
  const allVisibleSelected = visibleModels.length > 0 && visibleModels.every((model) => selectedSet.has(model));

  function toggleModel(model: string) {
    setSelected((current) => current.includes(model)
      ? current.filter((item) => item !== model)
      : [...current, model]);
  }

  function toggleVisible() {
    setSelected((current) => {
      const currentSet = new Set(current);
      if (allVisibleSelected) visibleModels.forEach((model) => currentSet.delete(model));
      else visibleModels.forEach((model) => currentSet.add(model));
      return [...currentSet];
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal provider-model-dialog" role="dialog" aria-modal="true" aria-labelledby="provider-model-dialog-title">
        <header className="modal-header">
          <div className="modal-icon"><Download size={21} /></div>
          <div>
            <p className="eyebrow">{t("providers:modelFetchEyebrow")}</p>
            <h2 id="provider-model-dialog-title">{t("providers:fetchModels")}</h2>
            <code>{provider?.displayName ?? unsaved?.displayName ?? unsaved?.baseUrl}</code>
          </div>
          <IconButton label={t("common:closeDialog")} onClick={onClose}><X size={19} /></IconButton>
        </header>
        <div className="modal-body provider-model-dialog-body">
          {fetchMutation.isPending ? <div className="provider-operation-loading"><LoaderCircle className="spin" size={22} />{t("providers:fetchingModels")}</div> : null}
          {fetchMutation.error ? <ErrorState error={fetchMutation.error} onRetry={() => fetchMutation.mutate()} /> : null}
          {result ? (
            <>
              <div className="provider-model-source"><span>{t("providers:modelEndpoint")}</span><code>{result.modelListUrl}</code><button type="button" className="button secondary compact-button" onClick={() => fetchMutation.mutate()} disabled={fetchMutation.isPending}><RefreshCw size={15} />{t("providers:fetchAgain")}</button></div>
              <label className="search-field provider-model-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("providers:searchModels")} /></label>
              <div className="provider-model-tabs" role="tablist">
                {(["added", "existing", "removed"] as const).map((tab) => (
                  <button type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)} key={tab}>
                    {t(`providers:modelGroup_${tab}`, { count: groups[tab].length })}
                  </button>
                ))}
              </div>
              <div className="provider-model-select-all">
                <label><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} disabled={!visibleModels.length} /><span>{t("providers:selectVisible")}</span></label>
                <span>{t("providers:selectedModels", { count: selected.length })}</span>
              </div>
              <div className="provider-model-list">
                {visibleModels.length ? visibleModels.map((model) => (
                  <label key={model} className="provider-model-option">
                    <input type="checkbox" checked={selectedSet.has(model)} onChange={() => toggleModel(model)} />
                    <code>{model}</code>
                    {model === provider?.defaultModel ? <span><Check size={13} />{t("providers:default")}</span> : null}
                  </label>
                )) : <div className="provider-model-empty">{t("providers:noModelsInGroup")}</div>}
              </div>
              <p className="provider-model-note">{t("providers:modelDiffNote")}</p>
            </>
          ) : null}
          {applyMutation.error ? <ErrorState error={applyMutation.error} /> : null}
        </div>
        <footer className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>{t("common:cancel")}</button>
          <button type="button" className="button primary" disabled={!result || applyMutation.isPending} onClick={() => { if (!selected.length) { toast.warning(t("providers:selectAtLeastOneModel")); return; } applyMutation.mutate(); }}>
            {applyMutation.isPending ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
            {onModelsSelected ? t("providers:fillModels") : t("providers:saveModels")}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function ProviderTestDialog({ provider, onClose }: { provider: ProviderReference; onClose: () => void }) {
  const { t } = useTranslation(["providers", "common"]);
  const queryClient = useQueryClient();
  const models = provider.models.length ? provider.models : [provider.defaultModel].filter(Boolean);
  const [endpointType, setEndpointType] = useState<"auto" | "openai" | "openai-response">("auto");
  const [stream, setStream] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([provider.defaultModel || models[0]].filter(Boolean));
  const [results, setResults] = useState<Record<string, ProviderTestResponse>>({});
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const visibleModels = models.filter((model) => model.toLowerCase().includes(search.trim().toLowerCase()));
  const allVisibleSelected = visibleModels.length > 0 && visibleModels.every((model) => selected.includes(model));

  async function testModel(model: string, quiet = false): Promise<ProviderTestResponse> {
    setTesting((current) => new Set(current).add(model));
    try {
      const response = await adminRequest<ProviderTestResponse>(`/providers/${encodeURIComponent(provider.providerId)}/test`, {
        method: "POST",
        body: JSON.stringify({ input: { model, endpointType, stream } }),
        feedback: { silentError: quiet },
      });
      setResults((current) => ({ ...current, [model]: response }));
      if (!quiet) {
        if (response.success) toast.success(t("providers:testSucceeded"), { description: `${model} · ${response.responseTimeMs} ms` });
        else toast.error(t("providers:testFailed"), { description: `${model}：${response.message}` });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["providers"] }),
        queryClient.invalidateQueries({ queryKey: ["provider", provider.providerId] }),
      ]);
      return response;
    } catch (error) {
      const response: ProviderTestResponse = {
        success: false,
        model,
        endpointType,
        stream,
        responseTimeMs: 0,
        httpStatus: null,
        message: error instanceof Error ? error.message : t("providers:testFailed"),
        testedAt: new Date().toISOString(),
      };
      setResults((current) => ({ ...current, [model]: response }));
      return response;
    } finally {
      setTesting((current) => {
        const next = new Set(current);
        next.delete(model);
        return next;
      });
    }
  }

  async function testSelected() {
    const queue = normalizeModels(selected);
    if (!queue.length) {
      toast.warning(t("providers:selectAtLeastOneModel"));
      return;
    }
    let cursor = 0;
    const batchResults: ProviderTestResponse[] = [];
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (cursor < queue.length) {
        const model = queue[cursor++];
        batchResults.push(await testModel(model, true));
      }
    });
    await Promise.all(workers);
    const succeeded = batchResults.filter((response) => response.success).length;
    const failed = batchResults.length - succeeded;
    const summary = t("providers:testBatchSummary", { succeeded, failed });
    if (failed === 0) toast.success(t("providers:testSucceeded"), { description: summary });
    else if (succeeded === 0) toast.error(t("providers:testFailed"), { description: summary });
    else toast.warning(t("providers:testPartiallySucceeded"), { description: summary });
  }

  return (
    <div className="drawer-backdrop" role="presentation" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="form-drawer provider-test-drawer" role="dialog" aria-modal="true" aria-labelledby="provider-test-title">
        <header><div className="drawer-icon"><SlidersHorizontal size={21} /></div><div><p className="eyebrow">{t("providers:testEyebrow")}</p><h2 id="provider-test-title">{t("providers:testModels")}</h2><code>{provider.displayName}</code></div><IconButton label={t("common:closeDialog")} onClick={onClose}><X size={19} /></IconButton></header>
        <div className="provider-test-body">
          <div className="provider-test-controls">
            <label className="field"><span>{t("providers:endpointType")}</span><select value={endpointType} onChange={(event) => setEndpointType(event.target.value as typeof endpointType)}><option value="auto">{t("providers:endpointAuto")}</option><option value="openai">OpenAI /chat/completions</option><option value="openai-response">OpenAI /responses</option></select></label>
            <label className="toggle-field"><input type="checkbox" checked={stream} onChange={(event) => setStream(event.target.checked)} /><span>{t("providers:streamTest")}</span></label>
          </div>
          <div className="provider-test-toolbar"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("providers:searchModels")} /></label><button type="button" className="button primary" onClick={() => void testSelected()} disabled={testing.size > 0}>{testing.size ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{t("providers:testSelected", { count: selected.length })}</button></div>
          <div className="table-scroll provider-test-table-wrap">
            <table className="data-table compact provider-test-table"><thead><tr><th><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected((current) => { const next = new Set(current); if (allVisibleSelected) visibleModels.forEach((model) => next.delete(model)); else visibleModels.forEach((model) => next.add(model)); return [...next]; })} /></th><th>{t("providers:modelId")}</th><th>{t("common:status")}</th><th>{t("providers:latency")}</th><th>{t("providers:testResult")}</th><th></th></tr></thead><tbody>
              {visibleModels.map((model) => {
                const response = results[model];
                const pending = testing.has(model);
                return <tr key={model}><td><input type="checkbox" checked={selected.includes(model)} onChange={() => setSelected((current) => current.includes(model) ? current.filter((item) => item !== model) : [...current, model])} /></td><td><code>{model}</code>{model === provider.defaultModel ? <small>{t("providers:default")}</small> : null}</td><td>{pending ? <StatusBadge status="testing" /> : response ? <StatusBadge status={response.success ? "healthy" : "failed"} /> : <StatusBadge status="not_checked" />}</td><td>{response ? `${response.responseTimeMs} ms` : "-"}</td><td><span className={response?.success ? "test-message success" : "test-message"}>{response ? response.success ? `HTTP ${response.httpStatus}` : response.message : "-"}</span></td><td><IconButton label={t("providers:testModel")} disabled={pending || testing.size > 0} onClick={() => void testModel(model)}>{pending ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}</IconButton></td></tr>;
              })}
            </tbody></table>
          </div>
        </div>
        <footer className="provider-test-footer"><span>{t("providers:testConcurrencyNote")}</span><button type="button" className="button secondary" onClick={onClose}>{t("common:close")}</button></footer>
      </aside>
    </div>
  );
}

export function ProviderRowOperations({ provider, governance }: { provider: JsonObject; governance: React.ReactNode }) {
  const { t } = useTranslation("providers");
  const queryClient = useQueryClient();
  const reference = toProviderReference(provider);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const quickTest = useMutation({
    mutationFn: () => adminRequest<ProviderTestResponse>(`/providers/${encodeURIComponent(reference.providerId)}/test`, {
      method: "POST",
      body: JSON.stringify({ input: { model: reference.defaultModel, endpointType: "auto", stream: false } }),
    }),
    onSuccess: async (response) => {
      if (response.success) toast.success(t("testSucceeded"), { description: `${reference.displayName} · ${response.responseTimeMs} ms` });
      else toast.error(t("testFailed"), { description: response.message });
      await queryClient.invalidateQueries({ queryKey: ["providers"] });
    },
  });

  return (
    <>
      <div className="provider-row-operations" onClick={(event) => event.stopPropagation()}>
        <IconButton label={t("quickTest")} onClick={() => quickTest.mutate()} disabled={quickTest.isPending}>{quickTest.isPending ? <LoaderCircle className="spin" size={16} /> : <Gauge size={16} />}</IconButton>
        <IconButton label={t("testModels")} onClick={() => setTestOpen(true)}><SlidersHorizontal size={16} /></IconButton>
        <IconButton label={t("fetchModels")} onClick={() => setModelsOpen(true)}><Download size={16} /></IconButton>
        {quickTest.data ? <span className={`provider-quick-result ${quickTest.data.success ? "success" : "failed"}`} title={quickTest.data.message || undefined}>{quickTest.data.success ? `${quickTest.data.responseTimeMs} ms` : t("testFailed")}</span> : null}
        {quickTest.error ? <span className="provider-quick-result failed" title={quickTest.error.message}>{t("testFailed")}</span> : null}
        {governance}
      </div>
      {modelsOpen ? <ProviderModelsDialog provider={reference} onClose={() => setModelsOpen(false)} /> : null}
      {testOpen ? <ProviderTestDialog provider={reference} onClose={() => setTestOpen(false)} /> : null}
    </>
  );
}
