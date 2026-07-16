import {
  createProviderInputSchema,
  createWorkspaceProviderBindingInputSchema,
  listProvidersQuerySchema,
  listWorkspaceProviderBindingsQuerySchema,
  providerHealthSummarySchema,
  providerHealthcheckResultSchema,
  providerProfileSchema,
  resolvedRunProviderSchema,
  updateProviderInputSchema,
  updateWorkspaceProviderBindingInputSchema,
  workspaceProviderBindingSchema,
  type CreateProviderInput,
  type CreateWorkspaceProviderBindingInput,
  type ListProvidersQuery,
  type ListWorkspaceProviderBindingsQuery,
  type ProviderHealthcheckResult,
  type ProviderModel,
  type ProviderProfile,
  type ResolvedRunProvider,
  type RunProviderSelection,
  type UpdateProviderInput,
  type UpdateWorkspaceProviderBindingInput,
  type WorkspaceProviderBinding,
  type WorkspaceRole,
} from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { credentialsService } from "../credentials/service.js";
import { providersRepository } from "./repository.js";

type ProviderActor = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  isPlatformAdmin: boolean;
};

let providerSequence = 1;
let bindingSequence = 1;
let bootstrapped = false;

function nowIso() {
  return new Date().toISOString();
}

function parseCounter(value: string | undefined, prefix: string) {
  if (!value?.startsWith(prefix)) {
    return 0;
  }

  const parsed = Number.parseInt(value.slice(prefix.length), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureBootstrapped() {
  if (bootstrapped) {
    return;
  }

  let maxProvider = 0;
  let maxBinding = 0;
  for (const provider of providersRepository.listProviders()) {
    maxProvider = Math.max(maxProvider, parseCounter(provider.providerId, "prv_"));
  }
  for (const binding of providersRepository.listBindings()) {
    maxBinding = Math.max(maxBinding, parseCounter(binding.bindingId, "wpb_"));
  }

  providerSequence = Math.max(providerSequence, maxProvider + 1);
  bindingSequence = Math.max(bindingSequence, maxBinding + 1);
  bootstrapped = true;
}

function nextProviderId() {
  ensureBootstrapped();
  return `prv_${String(providerSequence++).padStart(8, "0")}`;
}

function nextBindingId() {
  ensureBootstrapped();
  return `wpb_${String(bindingSequence++).padStart(8, "0")}`;
}

function canManageWorkspaceBindings(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

function assertPlatformProviderManager(actor: ProviderActor) {
  if (actor.isPlatformAdmin) {
    return;
  }

  throw new AppError(
    403,
    "PROVIDER_ACCESS_DENIED",
    `User ${actor.userId} cannot manage platform provider settings`
  );
}

function assertWorkspaceBindingManager(actor: ProviderActor) {
  if (canManageWorkspaceBindings(actor.role)) {
    return;
  }

  throw new AppError(
    403,
    "PROVIDER_BINDING_ACCESS_DENIED",
    `Workspace role ${actor.role} cannot manage provider bindings`
  );
}

function resolveProviderDefaultModel(provider: ProviderProfile) {
  return provider.models.find((item) => item.enabled && item.isDefault)?.model ?? provider.defaultModel;
}

function compareBindingsPriority(left: WorkspaceProviderBinding, right: WorkspaceProviderBinding) {
  if (left.isDefault !== right.isDefault) {
    return left.isDefault ? -1 : 1;
  }

  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return (
    left.createdAt.localeCompare(right.createdAt) ||
    left.bindingId.localeCompare(right.bindingId)
  );
}

function buildProviderHealthcheckUrl(provider: ProviderProfile) {
  const path = provider.healthcheckPath?.trim() || "/models";
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedBaseUrl = provider.baseUrl.replace(/\/+$/g, "");
  const normalizedPath = path.replace(/^\/+/g, "");
  return `${normalizedBaseUrl}/${normalizedPath}`;
}

function buildProviderApiUrl(baseUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBaseUrl}/${normalizedPath}`;
}

function extractProviderModelIds(payload: unknown) {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.models)
        ? root.models
        : [];
  const ids = candidates
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      const value = record.id ?? record.model ?? record.name;
      return typeof value === "string" ? value.trim() : "";
    })
    .filter(Boolean);
  return [...new Set(ids)].slice(0, 500);
}

async function readResponseText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new AppError(502, "PROVIDER_RESPONSE_TOO_LARGE", `Provider response exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function parseProviderErrorMessage(text: string, status: number) {
  if (!text.trim()) {
    return `Provider returned HTTP ${status}`;
  }

  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    const nestedError = payload.error && typeof payload.error === "object"
      ? payload.error as Record<string, unknown>
      : null;
    const message = nestedError?.message ?? payload.message ?? payload.error;
    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, 2_000);
    }
  } catch {
    // Upstream errors may be plain text or an HTML gateway response.
  }

  return text.replace(/\s+/g, " ").trim().slice(0, 2_000);
}

function providerModelDiff(provider: ProviderProfile, fetchedModelIds: string[]) {
  const currentModelIds = provider.models.map((item) => item.model);
  const currentSet = new Set(currentModelIds);
  const fetchedSet = new Set(fetchedModelIds);
  return {
    fetchedModelIds,
    addedModelIds: fetchedModelIds.filter((model) => !currentSet.has(model)),
    existingModelIds: fetchedModelIds.filter((model) => currentSet.has(model)),
    removedModelIds: currentModelIds.filter((model) => !fetchedSet.has(model)),
  };
}

type ProviderTestEndpoint = "auto" | "openai" | "openai-response";

function resolveProviderTestEndpoint(model: string, endpointType: ProviderTestEndpoint) {
  if (endpointType !== "auto") return endpointType;
  return /codex/i.test(model) ? "openai-response" : "openai";
}

function ensureModelAllowed(provider: ProviderProfile, model: string) {
  const knownModels = provider.models.filter((item) => item.enabled).map((item) => item.model);
  if (provider.allowCustomModel || knownModels.length === 0) {
    return;
  }

  if (knownModels.includes(model)) {
    return;
  }

  throw new AppError(
    409,
    "PROVIDER_MODEL_NOT_ALLOWED",
    `Model ${model} is not allowed for provider ${provider.providerId}`,
    {
      providerId: provider.providerId,
      model,
      allowedModels: knownModels,
    }
  );
}

function normalizeProviderModels(
  models: ProviderModel[] | undefined,
  defaultModel: string
) {
  if (!models || models.length === 0) {
    return [
      {
        model: defaultModel,
        label: null,
        enabled: true,
        isDefault: true,
        capabilities: {
          stream: true,
          toolCalling: true,
          responsesApi: true,
          longSession: true,
        },
      },
    ] satisfies ProviderModel[];
  }

  const normalized = models.map((item) => ({
    ...item,
    isDefault: item.model === defaultModel || item.isDefault,
  }));
  const preferredDefaultModel =
    normalized.find((item) => item.isDefault)?.model ??
    normalized.find((item) => item.model === defaultModel)?.model ??
    normalized[0]?.model ??
    defaultModel;

  return normalized.map((item) => ({
    ...item,
    isDefault: item.model === preferredDefaultModel,
  }));
}

async function ensureWorkspaceCredential(actor: ProviderActor, credentialId: string) {
  const credential = credentialsService.getCredentialForActor(credentialId, actor);
  if (credential.scope !== "workspace") {
    throw new AppError(
      409,
      "PROVIDER_CREDENTIAL_SCOPE_INVALID",
      `Provider binding requires a workspace credential: ${credentialId}`
    );
  }

  if (credential.workspaceId !== actor.workspaceId) {
    throw new AppError(
      409,
      "PROVIDER_CREDENTIAL_WORKSPACE_MISMATCH",
      `Credential ${credentialId} does not belong to workspace ${actor.workspaceId}`
    );
  }

  if (credential.mountMode !== "env") {
    throw new AppError(
      409,
      "PROVIDER_CREDENTIAL_MOUNT_INVALID",
      `Credential ${credentialId} must use env mount mode for provider injection`
    );
  }

  return credential;
}

function assertUniqueWorkspaceProviderBinding(input: {
  workspaceId: string;
  providerId: string;
  bindingId?: string;
}) {
  const conflicting = providersRepository
    .listBindings()
    .find(
      (binding) =>
        binding.workspaceId === input.workspaceId &&
        binding.providerId === input.providerId &&
        binding.bindingId !== input.bindingId
    );

  if (!conflicting) {
    return;
  }

  throw new AppError(
    409,
    "PROVIDER_BINDING_DUPLICATE",
    `Workspace ${input.workspaceId} already has a binding for provider ${input.providerId}`,
    {
      workspaceId: input.workspaceId,
      providerId: input.providerId,
      bindingId: conflicting.bindingId,
    }
  );
}

export class ProvidersService {
  async init() {
    await providersRepository.init();
    ensureBootstrapped();
  }

  listProviders(query: ListProvidersQuery = {}) {
    const parsed = listProvidersQuerySchema.parse(query);
    return providersRepository.listProviders().filter((item) =>
      parsed.enabled === undefined ? true : item.enabled === parsed.enabled
    );
  }

  getProvider(providerId: string) {
    const provider = providersRepository.getProviderById(providerId);
    if (!provider) {
      throw new AppError(404, "PROVIDER_NOT_FOUND", `Provider not found: ${providerId}`);
    }

    return provider;
  }

  async createProvider(actor: ProviderActor, input: CreateProviderInput) {
    assertPlatformProviderManager(actor);
    const parsed = createProviderInputSchema.parse(input);
    const timestamp = nowIso();
    const provider = providerProfileSchema.parse({
      providerId: nextProviderId(),
      displayName: parsed.displayName,
      description: parsed.description ?? null,
      enabled: parsed.enabled ?? true,
      adapterMode: parsed.adapterMode ?? "openai-compatible",
      apiStyle: parsed.apiStyle ?? "openai-compatible",
      baseUrl: parsed.baseUrl,
      authEnvName: parsed.authEnvName ?? "OPENAI_API_KEY",
      baseUrlEnvName: parsed.baseUrlEnvName ?? "OPENAI_BASE_URL",
      modelEnvName: parsed.modelEnvName ?? "OPENAI_MODEL",
      defaultModel: parsed.defaultModel,
      models: normalizeProviderModels(parsed.models, parsed.defaultModel),
      allowCustomModel: parsed.allowCustomModel ?? false,
      extraAllowedBaseUrls: parsed.extraAllowedBaseUrls ?? [],
      healthcheckPath: parsed.healthcheckPath ?? "/models",
      capabilities: parsed.capabilities ?? {},
      lastHealthcheck: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return await providersRepository.saveProvider(provider);
  }

  async updateProvider(actor: ProviderActor, providerId: string, input: UpdateProviderInput) {
    assertPlatformProviderManager(actor);
    const current = this.getProvider(providerId);
    const parsed = updateProviderInputSchema.parse(input);
    const defaultModel = parsed.defaultModel ?? current.defaultModel;
    const endpointChanged =
      (parsed.baseUrl !== undefined && parsed.baseUrl !== current.baseUrl) ||
      (parsed.healthcheckPath !== undefined && parsed.healthcheckPath !== current.healthcheckPath);
    const next = providerProfileSchema.parse({
      ...current,
      ...parsed,
      models: parsed.models ? normalizeProviderModels(parsed.models, defaultModel) : current.models,
      defaultModel,
      lastHealthcheck: endpointChanged ? null : current.lastHealthcheck,
      updatedAt: nowIso(),
    });

    return await providersRepository.saveProvider(next);
  }

  async checkProviderHealth(
    actor: ProviderActor,
    providerId: string,
    options: { apiKey?: string | null } = {}
  ): Promise<ProviderHealthcheckResult> {
    assertPlatformProviderManager(actor);
    const provider = this.getProvider(providerId);
    const checkedAt = nowIso();
    const healthcheckUrl = buildProviderHealthcheckUrl(provider);
    const startedAt = Date.now();
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "lingban-provider-healthcheck/1.0",
    };
    if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

    try {
      const response = await fetch(healthcheckUrl, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(5_000),
        headers,
      });

      const responseTimeMs = Date.now() - startedAt;
      const status =
        response.status >= 200 && response.status < 300
          ? "healthy"
          : response.status === 401 || response.status === 403
            ? "auth_required"
            : "degraded";

      const healthcheck = providerHealthSummarySchema.parse({
        checkedAt,
        healthcheckUrl,
        status,
        reachable: true,
        httpStatus: response.status,
        responseTimeMs,
        errorMessage: null,
      });
      const savedProvider = await providersRepository.saveProvider(
        providerProfileSchema.parse({
          ...provider,
          lastHealthcheck: healthcheck,
          updatedAt: nowIso(),
        })
      );

      return providerHealthcheckResultSchema.parse({
        providerId: provider.providerId,
        displayName: savedProvider.displayName,
        baseUrl: savedProvider.baseUrl,
        healthcheck,
      });
    } catch (error) {
      const healthcheck = providerHealthSummarySchema.parse({
        checkedAt,
        healthcheckUrl,
        status: "unreachable",
        reachable: false,
        httpStatus: null,
        responseTimeMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : "Unknown provider healthcheck failure",
      });
      const savedProvider = await providersRepository.saveProvider(
        providerProfileSchema.parse({
          ...provider,
          lastHealthcheck: healthcheck,
          updatedAt: nowIso(),
        })
      );

      return providerHealthcheckResultSchema.parse({
        providerId: provider.providerId,
        displayName: savedProvider.displayName,
        baseUrl: savedProvider.baseUrl,
        healthcheck,
      });
    }
  }

  async fetchProviderModelsFromConfiguration(
    actor: ProviderActor,
    input: {
      baseUrl: string;
      healthcheckPath?: string | null;
      apiKey?: string | null;
    }
  ) {
    assertPlatformProviderManager(actor);
    const modelListUrl = buildProviderApiUrl(input.baseUrl, input.healthcheckPath?.trim() || "/models");
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "lingban-provider-model-fetch/1.0",
    };
    if (input.apiKey) headers.authorization = `Bearer ${input.apiKey}`;
    let response: Response;
    try {
      response = await fetch(modelListUrl, {
        method: "GET",
        redirect: "manual",
        headers,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new AppError(
        502,
        "PROVIDER_MODEL_FETCH_UNAVAILABLE",
        `Provider model endpoint is unavailable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    if (!response.ok) {
      const responseText = await readResponseText(response, 64_000).catch(() => "");
      throw new AppError(
        502,
        "PROVIDER_MODEL_FETCH_FAILED",
        parseProviderErrorMessage(responseText, response.status),
        { httpStatus: response.status, modelListUrl }
      );
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > 5_000_000) {
      throw new AppError(502, "PROVIDER_MODEL_SYNC_RESPONSE_TOO_LARGE", "Provider model response exceeds 5 MB");
    }
    let payload: unknown;
    try {
      payload = JSON.parse(await readResponseText(response, 5_000_000));
    } catch {
      throw new AppError(502, "PROVIDER_MODEL_FETCH_INVALID_RESPONSE", "Provider model endpoint did not return valid JSON");
    }
    const discoveredIds = extractProviderModelIds(payload);
    if (discoveredIds.length === 0) {
      throw new AppError(502, "PROVIDER_MODEL_FETCH_EMPTY", "Provider model endpoint returned no model identifiers");
    }
    return {
      modelListUrl,
      fetchedModelIds: discoveredIds,
      fetchedAt: nowIso(),
    };
  }

  async fetchProviderModels(
    actor: ProviderActor,
    providerId: string,
    options: { apiKey?: string | null } = {}
  ) {
    const provider = this.getProvider(providerId);
    const result = await this.fetchProviderModelsFromConfiguration(actor, {
      baseUrl: provider.baseUrl,
      healthcheckPath: provider.healthcheckPath,
      apiKey: options.apiKey,
    });
    return {
      providerId,
      ...result,
      ...providerModelDiff(provider, result.fetchedModelIds),
    };
  }

  async applyProviderModels(
    actor: ProviderActor,
    providerId: string,
    input: { modelIds: string[]; defaultModel: string }
  ) {
    assertPlatformProviderManager(actor);
    const provider = this.getProvider(providerId);
    const modelIds = [...new Set(input.modelIds.map((model) => model.trim()).filter(Boolean))].slice(0, 500);
    if (modelIds.length === 0) {
      throw new AppError(400, "PROVIDER_MODELS_REQUIRED", "Select at least one model");
    }
    if (!modelIds.includes(input.defaultModel)) {
      throw new AppError(400, "PROVIDER_DEFAULT_MODEL_REQUIRED", "The default model must be selected");
    }

    const previousById = new Map(provider.models.map((item) => [item.model, item]));
    const models = normalizeProviderModels(
      modelIds.map((model) => previousById.get(model) ?? {
        model,
        label: null,
        enabled: true,
        isDefault: model === input.defaultModel,
        capabilities: provider.capabilities,
      }),
      input.defaultModel
    );
    return await providersRepository.saveProvider(providerProfileSchema.parse({
      ...provider,
      defaultModel: input.defaultModel,
      models,
      updatedAt: nowIso(),
    }));
  }

  async testProvider(
    actor: ProviderActor,
    providerId: string,
    input: {
      model?: string;
      endpointType?: ProviderTestEndpoint;
      stream?: boolean;
      apiKey?: string | null;
    } = {}
  ) {
    assertPlatformProviderManager(actor);
    const provider = this.getProvider(providerId);
    const model = input.model?.trim() || resolveProviderDefaultModel(provider);
    ensureModelAllowed(provider, model);
    const requestedEndpointType = input.endpointType ?? "auto";
    const endpointType = resolveProviderTestEndpoint(model, requestedEndpointType);
    const testUrl = buildProviderApiUrl(
      provider.baseUrl,
      endpointType === "openai-response" ? "/responses" : "/chat/completions"
    );
    const checkedAt = nowIso();
    const startedAt = Date.now();
    const headers: Record<string, string> = {
      accept: input.stream ? "text/event-stream, application/json" : "application/json",
      "content-type": "application/json",
      "user-agent": "lingban-provider-test/1.0",
    };
    if (input.apiKey) headers.authorization = `Bearer ${input.apiKey}`;
    const body = endpointType === "openai-response"
      ? {
          model,
          input: "Reply with OK.",
          max_output_tokens: 16,
          stream: Boolean(input.stream),
        }
      : {
          model,
          messages: [{ role: "user", content: "Reply with OK." }],
          max_tokens: 8,
          stream: Boolean(input.stream),
        };

    try {
      const response = await fetch(testUrl, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
        headers,
        body: JSON.stringify(body),
      });
      const responseTimeMs = Date.now() - startedAt;
      const responseText = await readResponseText(response, 1_000_000).catch((error) =>
        error instanceof Error ? error.message : "Unable to read Provider response"
      );
      const status = response.ok
        ? "healthy"
        : response.status === 401 || response.status === 403
          ? "auth_required"
          : "degraded";
      const errorMessage = response.ok ? null : parseProviderErrorMessage(responseText, response.status);
      const healthcheck = providerHealthSummarySchema.parse({
        checkedAt,
        healthcheckUrl: testUrl,
        status,
        reachable: true,
        httpStatus: response.status,
        responseTimeMs,
        errorMessage,
      });
      await providersRepository.saveProvider(providerProfileSchema.parse({
        ...provider,
        lastHealthcheck: healthcheck,
        updatedAt: nowIso(),
      }));
      return {
        success: response.ok,
        providerId,
        model,
        requestedEndpointType,
        endpointType,
        stream: Boolean(input.stream),
        responseTimeMs,
        httpStatus: response.status,
        message: errorMessage ?? "",
        testedAt: checkedAt,
        healthcheck,
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : "Provider test failed";
      const healthcheck = providerHealthSummarySchema.parse({
        checkedAt,
        healthcheckUrl: testUrl,
        status: "unreachable",
        reachable: false,
        httpStatus: null,
        responseTimeMs,
        errorMessage: message,
      });
      await providersRepository.saveProvider(providerProfileSchema.parse({
        ...provider,
        lastHealthcheck: healthcheck,
        updatedAt: nowIso(),
      }));
      return {
        success: false,
        providerId,
        model,
        requestedEndpointType,
        endpointType,
        stream: Boolean(input.stream),
        responseTimeMs,
        httpStatus: null,
        message,
        testedAt: checkedAt,
        healthcheck,
      };
    }
  }

  listWorkspaceBindings(
    actor: ProviderActor,
    query: ListWorkspaceProviderBindingsQuery = {}
  ) {
    const parsed = listWorkspaceProviderBindingsQuerySchema.parse(query);
    return providersRepository
      .listBindings()
      .filter((item) => item.workspaceId === actor.workspaceId)
      .filter((item) => (parsed.providerId ? item.providerId === parsed.providerId : true))
      .filter((item) => (parsed.enabled === undefined ? true : item.enabled === parsed.enabled))
      .sort(compareBindingsPriority);
  }

  async createWorkspaceBinding(actor: ProviderActor, input: CreateWorkspaceProviderBindingInput) {
    assertWorkspaceBindingManager(actor);
    const parsed = createWorkspaceProviderBindingInputSchema.parse(input);
    this.getProvider(parsed.providerId);
    assertUniqueWorkspaceProviderBinding({
      workspaceId: actor.workspaceId,
      providerId: parsed.providerId,
    });
    await ensureWorkspaceCredential(actor, parsed.credentialId);
    const timestamp = nowIso();
    const binding = workspaceProviderBindingSchema.parse({
      bindingId: nextBindingId(),
      workspaceId: actor.workspaceId,
      providerId: parsed.providerId,
      credentialId: parsed.credentialId,
      enabled: parsed.enabled ?? true,
      isDefault: parsed.isDefault ?? false,
      priority: parsed.priority ?? 100,
      allowUserOverride: parsed.allowUserOverride ?? true,
      notes: parsed.notes ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await this.#persistBindingWithDefaultSemantics(binding);
    return binding;
  }

  async updateWorkspaceBinding(
    actor: ProviderActor,
    bindingId: string,
    input: UpdateWorkspaceProviderBindingInput
  ) {
    assertWorkspaceBindingManager(actor);
    const current = providersRepository.getBindingById(bindingId);
    if (!current || current.workspaceId !== actor.workspaceId) {
      throw new AppError(
        404,
        "PROVIDER_BINDING_NOT_FOUND",
        `Workspace provider binding not found: ${bindingId}`
      );
    }

    const parsed = updateWorkspaceProviderBindingInputSchema.parse(input);
    assertUniqueWorkspaceProviderBinding({
      workspaceId: actor.workspaceId,
      providerId: current.providerId,
      bindingId: current.bindingId,
    });
    if (parsed.credentialId) {
      await ensureWorkspaceCredential(actor, parsed.credentialId);
    }

    const next = workspaceProviderBindingSchema.parse({
      ...current,
      ...parsed,
      updatedAt: nowIso(),
    });

    await this.#persistBindingWithDefaultSemantics(next);
    return next;
  }

  resolveRunProvider(input: {
    workspaceId: string;
    requestedByUserId?: string | null;
    selection?: RunProviderSelection | null;
  }): ResolvedRunProvider | null {
    const selection = input.selection ?? null;
    const workspaceBindings = providersRepository
      .listBindings()
      .filter((binding) => binding.workspaceId === input.workspaceId && binding.enabled)
      .sort(compareBindingsPriority)
      .map((binding) => ({
        binding,
        provider: providersRepository.getProviderById(binding.providerId),
      }))
      .filter(
        (item): item is { binding: WorkspaceProviderBinding; provider: ProviderProfile } =>
          Boolean(item.provider?.enabled)
      );

    if (workspaceBindings.length === 0) {
      return null;
    }

    const chosen =
      selection?.providerId
        ? workspaceBindings.find((item) => item.provider.providerId === selection.providerId) ?? null
        : workspaceBindings.find((item) => item.binding.isDefault) ?? workspaceBindings[0] ?? null;

    if (!chosen) {
      throw new AppError(
        409,
        "PROVIDER_BINDING_UNAVAILABLE",
        selection?.providerId
          ? `Provider ${selection.providerId} is not enabled for workspace ${input.workspaceId}`
          : `No enabled provider binding is available for workspace ${input.workspaceId}`
      );
    }

    if (selection?.model && !chosen.binding.allowUserOverride) {
      throw new AppError(
        409,
        "PROVIDER_MODEL_OVERRIDE_FORBIDDEN",
        `Provider binding ${chosen.binding.bindingId} does not allow model override`
      );
    }

    const model = selection?.model ?? resolveProviderDefaultModel(chosen.provider);
    ensureModelAllowed(chosen.provider, model);

    return resolvedRunProviderSchema.parse({
      providerId: chosen.provider.providerId,
      bindingId: chosen.binding.bindingId,
      displayName: chosen.provider.displayName,
      adapterMode: chosen.provider.adapterMode,
      apiStyle: chosen.provider.apiStyle,
      baseUrl: chosen.provider.baseUrl,
      model,
      credentialId: chosen.binding.credentialId,
      authEnvName: chosen.provider.authEnvName,
      baseUrlEnvName: chosen.provider.baseUrlEnvName,
      modelEnvName: chosen.provider.modelEnvName,
      runtimeEnv: {
        [chosen.provider.baseUrlEnvName]: chosen.provider.baseUrl,
        [chosen.provider.modelEnvName]: model,
      },
      allowedBaseUrls: [
        chosen.provider.baseUrl,
        ...chosen.provider.extraAllowedBaseUrls,
      ],
      resolvedAt: nowIso(),
    });
  }

  async #persistBindingWithDefaultSemantics(binding: WorkspaceProviderBinding) {
    const existingBindings = providersRepository
      .listBindings()
      .filter((item) => item.workspaceId === binding.workspaceId);
    const nextBindings = existingBindings.map((item) =>
      item.bindingId === binding.bindingId
        ? binding
        : binding.isDefault
          ? {
              ...item,
              isDefault: false,
              updatedAt: binding.updatedAt,
            }
          : item
    );
    if (!nextBindings.some((item) => item.bindingId === binding.bindingId)) {
      nextBindings.push(binding);
    }

    const untouchedBindings = providersRepository
      .listBindings()
      .filter((item) => item.workspaceId !== binding.workspaceId);

    await providersRepository.replaceState({
      providers: providersRepository.listProviders(),
      bindings: [...untouchedBindings, ...nextBindings],
    });
  }
}

export async function initializeProvidersInfrastructure() {
  await providersService.init();
}

export const providersService = new ProvidersService();
