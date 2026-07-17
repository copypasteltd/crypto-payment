import {
  acceptWorkspaceInvitationInputSchema,
  acceptWorkspaceInvitationResponseSchema,
  authSessionEnvelopeSchema,
  authSessionResponseSchema,
  activateCreatorReleaseInputSchema,
  batchRunCancelInputSchema,
  batchRunBudgetEstimateSchema,
  batchRunDetailSchema,
  importBatchRunFileInputSchema,
  importBatchRunFileResponseSchema,
  batchRunItemsResponseSchema,
  batchRunRetryInputSchema,
  batchRunStartInputSchema,
  createBatchRunInputSchema,
  estimateBatchRunInputSchema,
  billingEntrySchema,
  billingLedgerSummaryQuerySchema,
  billingLedgerSummarySchema,
  changeCredentialLifecycleInputSchema,
  credentialAuditEventSchema,
  createCreatorAuditExportInputSchema,
  createCreatorPackageInputSchema,
  createCredentialInputSchema,
  createCreatorReleaseInputSchema,
  createCreatorReplayInputSchema,
  createWorkspaceInvitationInputSchema,
  createWorkspaceInvitationResponseSchema,
  createQuotaPolicyInputSchema,
  createMcpBindingInputSchema,
  createMcpInputSchema,
  creatorGovernanceDynamicSectionSchema,
  creatorAuditExportRecordSchema,
  creatorAuditExportResponseSchema,
  creatorGovernanceSectionSummaryQuerySchema,
  creatorGovernanceSectionSummarySchema,
  creatorPackageDetailSchema,
  creatorPackageSummarySchema,
  creatorReleaseActivationSchema,
  creatorReleaseGateSchema,
  creatorReleaseSummarySchema,
  creatorReplaySummarySchema,
  decideCreatorReleaseGateInputSchema,
  decideQuotaOverrideInputSchema,
  listBillingEntriesQuerySchema,
  listCreatorAuditExportsQuerySchema,
  quotaCounterSchema,
  quotaEventSchema,
  quotaOverrideRecordSchema,
  quotaPolicySchema,
  listQuotaCountersQuerySchema,
  listQuotaEventsQuerySchema,
  listQuotaOverridesQuerySchema,
  listQuotaPoliciesQuerySchema,
  createServiceLaunchTemplateInputSchema,
  createWorkshopServiceBundleInputSchema,
  createWorkshopServiceBundleResponseSchema,
  createRunDownloadTicketInputSchema,
  createRunDownloadTicketResponseSchema,
  loginAuthInputSchema,
  logoutAuthInputSchema,
  refreshAuthInputSchema,
  registerAuthInputSchema,
  listCreatorPackagesQuerySchema,
  listServicesQuerySchema,
  listWorkshopsQuerySchema,
  createRunUploadInputSchema,
  createRunUploadResponseSchema,
  credentialLifecycleChangeResultSchema,
  credentialDetailSchema,
  credentialSummarySchema,
  credentialUsageResponseSchema,
  finalizeRunUploadInputSchema,
  finalizeRunUploadResponseSchema,
  listCredentialsQuerySchema,
  listCredentialAuditEventsQuerySchema,
  listMeAssetsQuerySchema,
  listMeAuthorizationsQuerySchema,
  listMeFavoriteWorkshopsQuerySchema,
  listMeRecentActivitiesQuerySchema,
  listSearchHistoryQuerySchema,
  listSearchResultsQuerySchema,
  listSearchSuggestionsQuerySchema,
  recordSearchClickInputSchema,
  runUploadRecordSchema,
  listMcpCallsQuerySchema,
  listMcpBindingsQuerySchema,
  listMeNoticesQuerySchema,
  listNotificationsQuerySchema,
  listBatchRunItemsQuerySchema,
  listBatchRunsQuerySchema,
  listMcpsQuerySchema,
  listRunsQuerySchema,
  meAssetListResponseSchema,
  meAuthorizationSummarySchema,
  meFavoriteWorkshopListResponseSchema,
  meRecentActivityListResponseSchema,
  meRecentActivityRecordSchema,
  meNoticeSchema,
  meProfileSummarySchema,
  meNoticeSummarySchema,
  notificationRecordSchema,
  notificationSummarySchema,
  recordMeRecentActivityInputSchema,
  recordSearchClickResultSchema,
  searchHistoryListResponseSchema,
  searchResultListResponseSchema,
  searchSuggestionListResponseSchema,
  inheritSessionPackInputSchema,
  inheritSessionPackResponseSchema,
  downloadSessionPackArchiveQuerySchema,
  importSessionPackArchiveQuerySchema,
  importSessionPackArchiveResponseSchema,
  listSessionPacksQuerySchema,
  publishSessionPackInputSchema,
  publishSessionPackResponseSchema,
  reviewSessionPackRedactionInputSchema,
  reviewSessionPackRedactionResponseSchema,
  rollbackSessionPackInputSchema,
  rollbackSessionPackResponseSchema,
  updateSessionPackRedactionMapInputSchema,
  updateSessionPackRedactionMapResponseSchema,
  unpublishSessionPackInputSchema,
  unpublishSessionPackResponseSchema,
  sessionPackDetailSchema,
  sessionPackLineageResponseSchema,
  sessionPackSummarySchema,
  serviceDetailSchema,
  serviceLaunchTemplateSchema,
  serviceCatalogEntrySchema,
  serviceTaskVersionRecordSchema,
  mcpCallRecordSchema,
  mcpBindingRecordSchema,
  mcpRegistryEntrySchema,
  rotateCredentialInputSchema,
  switchWorkspaceInputSchema,
  approveRunInputSchema,
  updateRunApprovalModeInputSchema,
  reviewRunInformationAnswerInputSchema,
  clientRealtimeMessageSchema,
  createRunInputSchema,
  createRunResponseSchema,
  createSessionCaptureInputSchema,
  createSessionCaptureResponseSchema,
  createCreatorSourceRunInputSchema,
  createCreatorSourceRunResponseSchema,
  createSessionProjectInputSchema,
  listSessionProjectsQuerySchema,
  listSessionProjectsResponseSchema,
  sessionProjectRecordSchema,
  updateSessionProjectInputSchema,
  listSessionCapturesResponseSchema,
  listSessionCaptureObjectAccessAuditResponseSchema,
  requestSessionCaptureObjectDownloadSchema,
  sessionCaptureRecordSchema,
  createSessionDraftInputSchema,
  createSessionDraftResponseSchema,
  createSessionDraftReplayInputSchema,
  createSessionDraftReplayResponseSchema,
  createSessionDraftRevisionInputSchema,
  createSessionDraftRevisionResponseSchema,
  listSessionDraftsResponseSchema,
  sessionDraftDetailSchema,
  submitSessionRedactionReviewInputSchema,
  submitSessionRedactionReviewResponseSchema,
  sealSessionDraftInputSchema,
  sealSessionDraftResponseSchema,
  putCreatorPackageSessionBindingInputSchema,
  creatorPackageSessionBindingSchema,
  creatorPackageSessionBindingsSchema,
  listSealedSessionVersionsResponseSchema,
  sealedSessionVersionRecordSchema,
  migrateLegacySessionArchivesInputSchema,
  migrateLegacySessionArchivesResponseSchema,
  workshopDetailSchema,
  workshopCatalogEntrySchema,
  workspaceProfileSummarySchema,
  workspaceSummarySchema,
  serverRealtimeMessageSchema,
  runFileEntrySchema,
  listRunFileIndexResponseSchema,
  runListSummarySchema,
  runFilePreviewResponseSchema,
  runFileReadResponseSchema,
  runSnapshotSchema,
  sendRunMessageInputSchema,
  updateCreatorReleaseInputSchema,
  updateCreatorReplayInputSchema,
  updateCredentialInputSchema,
  updateMcpBindingInputSchema,
  updateMcpInputSchema,
  updateWorkspaceMembershipInputSchema,
  workspaceInvitationViewSchema,
  workspaceMemberRecordSchema,
  type AuthSessionEnvelope,
  type AuthSessionResponse,
  type AcceptWorkspaceInvitationInput,
  type AcceptWorkspaceInvitationResponse,
  type ActivateCreatorReleaseInput,
  type BatchRunCancelInput,
  type BatchRunDetail,
  type ImportBatchRunFileInput,
  type ImportBatchRunFileResponse,
  type BatchRunItemsResponse,
  type BatchRunRetryInput,
  type BatchRunStartInput,
  type BatchRunBudgetEstimate,
  type CreateBatchRunInput,
  type EstimateBatchRunInput,
  type BillingEntry,
  type BillingLedgerSummary,
  type BillingLedgerSummaryQuery,
  type ChangeCredentialLifecycleInput,
  type CreateCreatorAuditExportInput,
  type CreateCreatorPackageInput,
  type CredentialDetail,
  type CredentialAuditEvent,
  type CredentialLifecycleChangeResult,
  type CredentialSummary,
  type CredentialUsageResponse,
  type CreateCredentialInput,
  type CreateCreatorReleaseInput,
  type CreateCreatorReplayInput,
  type CreateWorkspaceInvitationInput,
  type CreateWorkspaceInvitationResponse,
  type CreateMcpBindingInput,
  type CreateMcpInput,
  type CreatorGovernanceDynamicSection,
  type CreatorAuditExportRecord,
  type CreatorAuditExportResponse,
  type CreatorGovernanceSectionSummary,
  type CreatorGovernanceSectionSummaryQuery,
  type CreatorPackageDetail,
  type CreatorPackageSummary,
  type CreatorReleaseActivation,
  type CreatorReleaseGate,
  type CreatorReleaseSummary,
  type CreatorReplaySummary,
  type DecideCreatorReleaseGateInput,
  type DecideQuotaOverrideInput,
  type ListBillingEntriesQuery,
  type ListMeAssetsQuery,
  type ListMeAuthorizationsQuery,
  type ListMeFavoriteWorkshopsQuery,
  type ListMeRecentActivitiesQuery,
  type ListSearchHistoryQuery,
  type ListSearchResultsQuery,
  type ListSearchSuggestionsQuery,
  type ListCreatorAuditExportsQuery,
  type InheritSessionPackInput,
  type InheritSessionPackResponse,
  type DownloadSessionPackArchiveQuery,
  type ImportSessionPackArchiveQuery,
  type ImportSessionPackArchiveResponse,
  type PublishSessionPackInput,
  type PublishSessionPackResponse,
  type ReviewSessionPackRedactionInput,
  type ReviewSessionPackRedactionResponse,
  type RollbackSessionPackInput,
  type RollbackSessionPackResponse,
  type UpdateSessionPackRedactionMapInput,
  type UpdateSessionPackRedactionMapResponse,
  type UnpublishSessionPackInput,
  type UnpublishSessionPackResponse,
  type LoginAuthInput,
  type ListCredentialsQuery,
  type ListCredentialAuditEventsQuery,
  type LogoutAuthInput,
  type ListMcpCallsQuery,
  type ListMcpBindingsQuery,
  type ListMeNoticesQuery,
  type ListNotificationsQuery,
  type ListBatchRunItemsQuery,
  type ListBatchRunsQuery,
  type ListMcpsQuery,
  type MeAssetListResponse,
  type MeAuthorizationSummary,
  type MeFavoriteWorkshopListResponse,
  type MeRecentActivityListResponse,
  type MeRecentActivityRecord,
  type RecordSearchClickInput,
  type RecordSearchClickResult,
  type SearchHistoryListResponse,
  type SearchResultListResponse,
  type SearchSuggestionListResponse,
  type ListSessionPacksQuery,
  type MeNotice,
  type MeProfileSummary,
  type MeNoticeSummary,
  type NotificationRecord,
  type NotificationSummary,
  type McpCallRecord,
  type McpBindingRecord,
  type McpRegistryEntry,
  type QuotaCounter,
  type QuotaEvent,
  type QuotaOverrideRecord,
  type QuotaPolicy,
  type RefreshAuthInput,
  type RegisterAuthInput,
  type RotateCredentialInput,
  type CreateRunDownloadTicketInput,
  type CreateRunDownloadTicketResponse,
  type CreateServiceLaunchTemplateInput,
  type CreateWorkshopServiceBundleInput,
  type CreateWorkshopServiceBundleResponse,
  type CreateRunUploadInput,
  type CreateRunUploadResponse,
  type FinalizeRunUploadInput,
  type FinalizeRunUploadResponse,
  type ListCreatorPackagesQuery,
  type ListServicesQuery,
  type ListWorkshopsQuery,
  type RunUploadRecord,
  type SessionPackDetail,
  type SessionPackLineageResponse,
  type SessionPackSummary,
  type ServiceCatalogEntry,
  type ServiceDetail,
  type ServiceLaunchTemplate,
  type ServiceTaskVersionRecord,
  type SwitchWorkspaceInput,
  type ApproveRunInput,
  type UpdateRunApprovalModeInput,
  type ReviewRunInformationAnswerInput,
  type BridgeEvent,
  type CreateRunInput,
  type CreateRunResponse,
  type CreateSessionCaptureInput,
  type CreateSessionCaptureResponse,
  type CreateCreatorSourceRunInput,
  type CreateCreatorSourceRunResponse,
  type CreateSessionProjectInput,
  type ListSessionProjectsQuery,
  type ListSessionProjectsResponse,
  type SessionProjectRecord,
  type UpdateSessionProjectInput,
  type ListSessionCapturesResponse,
  type ListSessionCaptureObjectAccessAuditResponse,
  type RequestSessionCaptureObjectDownload,
  type SessionCaptureRecord,
  type CreateSessionDraftInput,
  type CreateSessionDraftResponse,
  type CreateSessionDraftReplayInput,
  type CreateSessionDraftReplayResponse,
  type CreateSessionDraftRevisionInput,
  type CreateSessionDraftRevisionResponse,
  type ListSessionDraftsResponse,
  type SessionDraftDetail,
  type SubmitSessionRedactionReviewInput,
  type SubmitSessionRedactionReviewResponse,
  type SealSessionDraftInput,
  type SealSessionDraftResponse,
  type PutCreatorPackageSessionBindingInput,
  type CreatorPackageSessionBinding,
  type CreatorPackageSessionBindings,
  type ListSealedSessionVersionsResponse,
  type SealedSessionVersionRecord,
  type MigrateLegacySessionArchivesInput,
  type MigrateLegacySessionArchivesResponse,
  type RunFileEntry,
  type ListRunFileIndexResponse,
  type ListRunsQuery,
  type RunListSummary,
  type RunFilePreviewResponse,
  type RunFileReadResponse,
  type RunFileSource,
  type RunSnapshot,
  type RunConversationAttachment,
  type SendRunMessageInput,
  type CreateQuotaPolicyInput,
  type ListQuotaCountersQuery,
  type ListQuotaEventsQuery,
  type ListQuotaOverridesQuery,
  type ListQuotaPoliciesQuery,
  type UpdateCreatorReleaseInput,
  type UpdateCreatorReplayInput,
  type UpdateQuotaPolicyInput,
  updateQuotaPolicyInputSchema,
  type UpdateCredentialInput,
  type UpdateMcpBindingInput,
  type UpdateMcpInput,
  type RecordMeRecentActivityInput,
  setMeFavoriteWorkshopInputSchema,
  setMeFavoriteWorkshopResultSchema,
  type UpdateWorkspaceMembershipInput,
  type WorkshopCatalogEntry,
  type WorkshopDetail,
  type WorkspaceInvitationView,
  type WorkspaceMemberRecord,
  type WorkspaceProfileSummary,
  type SetMeFavoriteWorkshopInput,
  type SetMeFavoriteWorkshopResult,
} from "@lingban/contracts";

type FetchLike = typeof fetch;

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ClientConfig = {
  baseUrl: string;
  fetcher?: FetchLike;
  getAccessToken?: () => string | undefined;
};

type Awaitable<T> = T | PromiseLike<T>;

type SessionRefreshFetchConfig = {
  baseUrl: string;
  fetcher?: FetchLike;
  getAccessToken?: () => string | undefined;
  getRefreshToken?: () => string | undefined;
  applySessionResponse?: (response: AuthSessionResponse) => Awaitable<void>;
  onAuthFailure?: (error: unknown) => Awaitable<void>;
};

type RealtimeSocketLike = {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  readyState?: number;
  addEventListener?: (type: string, listener: (event: any) => void) => void;
  removeEventListener?: (type: string, listener: (event: any) => void) => void;
  onopen?: ((event: any) => void) | null;
  onmessage?: ((event: any) => void) | null;
  onerror?: ((event: any) => void) | null;
  onclose?: ((event: any) => void) | null;
};

type RealtimeEventSourceLike = {
  close(): void;
  readyState?: number;
  addEventListener?: (type: string, listener: (event: any) => void) => void;
  removeEventListener?: (type: string, listener: (event: any) => void) => void;
  onopen?: ((event: any) => void) | null;
  onmessage?: ((event: any) => void) | null;
  onerror?: ((event: any) => void) | null;
};

type RunsRealtimeClientConfig = {
  baseUrl: string;
  socketFactory?: (url: string) => RealtimeSocketLike;
  eventSourceFactory?: (url: string) => RealtimeEventSourceLike;
  getAccessToken?: () => string | undefined;
  preferTransport?: "auto" | "ws" | "sse";
};

export type RunRealtimeTransport = "ws" | "sse";

type RunRealtimeHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: string) => void;
  onTransport?: (transport: RunRealtimeTransport) => void;
  onSnapshot?: (snapshot: RunSnapshot) => void;
  onEvent?: (event: BridgeEvent) => void;
  onAck?: (runId: string, ok: boolean) => void;
};

export type RunRealtimeConnection = {
  close(): void;
  sendMessage(input: SendRunMessageInput): void;
  approve(input: ApproveRunInput): void;
  cancel(reason?: string): void;
  isOpen(): boolean;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

async function parseJson<T>(response: Response, parser: { parse(value: unknown): T }) {
  if (!response.ok) {
    const raw = await response.text();

    try {
      const parsed = JSON.parse(raw) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      throw new ApiError(
        response.status,
        parsed.error?.message ?? `HTTP_${response.status}`,
        parsed.error?.code,
        parsed.error?.details
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(response.status, raw || `HTTP_${response.status}`);
    }
  }

  const payload = (await response.json()) as unknown;
  return parser.parse(payload);
}

function toWebSocketBaseUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.startsWith("https://")) {
    return `wss://${normalized.slice("https://".length)}`;
  }

  if (normalized.startsWith("http://")) {
    return `ws://${normalized.slice("http://".length)}`;
  }

  if (normalized.startsWith("ws://") || normalized.startsWith("wss://")) {
    return normalized;
  }

  return `ws://${normalized}`;
}

function buildAuthHeaders(getAccessToken?: () => string | undefined) {
  const accessToken = getAccessToken?.();
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function createIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ??
    `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function appendAccessToken(url: string, accessToken?: string) {
  if (!accessToken) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}accessToken=${encodeURIComponent(accessToken)}`;
}

function buildQueryString(input: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value == null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null || item === "") {
          continue;
        }

        params.append(key, item);
      }
      continue;
    }

    params.set(key, value);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function resolveRequestUrl(baseUrl: string, input: string | URL) {
  const raw = input instanceof URL ? input.toString() : input;
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (/^wss?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return `${normalizeBaseUrl(baseUrl)}${raw}`;
  }

  return `${normalizeBaseUrl(baseUrl)}/${raw}`;
}

function isAuthRetryBypassPathname(pathname: string) {
  return pathname === "/v1/auth/login" || pathname === "/v1/auth/register" || pathname === "/v1/auth/refresh";
}

function withAccessToken(init: RequestInit | undefined, accessToken?: string) {
  const headers = new Headers(init?.headers ?? undefined);

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  } else {
    headers.delete("authorization");
  }

  return {
    ...init,
    headers,
  };
}

function parseContentDispositionFileName(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const simpleMatch = /filename=\"?([^\";]+)\"?/i.exec(value);
  return simpleMatch?.[1]?.trim() || null;
}

export function createSessionRefreshFetch(config: SessionRefreshFetchConfig): FetchLike {
  const fetcher = config.fetcher ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  let inFlightRefresh: Promise<AuthSessionResponse> | null = null;

  const refreshSession = async () => {
    const refreshToken = config.getRefreshToken?.();
    if (!refreshToken) {
      const error = new ApiError(
        401,
        "Refresh token is unavailable.",
        "AUTH_REFRESH_UNAVAILABLE"
      );
      await config.onAuthFailure?.(error);
      throw error;
    }

    if (!inFlightRefresh) {
      inFlightRefresh = (async () => {
        try {
          const response = await fetcher(`${baseUrl}/v1/auth/refresh`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(
              refreshAuthInputSchema.parse({
                refreshToken,
              })
            ),
          });
          const refreshed = await parseJson(response, authSessionResponseSchema);
          await config.applySessionResponse?.(refreshed);
          return refreshed;
        } catch (error) {
          await config.onAuthFailure?.(error);
          throw error;
        } finally {
          inFlightRefresh = null;
        }
      })();
    }

    return inFlightRefresh;
  };

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input !== "string" && !(input instanceof URL)) {
      return fetcher(input, init);
    }

    const url = resolveRequestUrl(baseUrl, input);
    const pathname = new URL(url).pathname;
    const bypassRetry = isAuthRetryBypassPathname(pathname);
    const attachAuth = !isAuthRetryBypassPathname(pathname);
    const performFetch = () =>
      fetcher(
        url,
        withAccessToken(init, attachAuth ? config.getAccessToken?.() : undefined)
      );

    const response = await performFetch();
    if (response.status !== 401 || bypassRetry) {
      return response;
    }

    try {
      await refreshSession();
    } catch {
      return response;
    }

    return performFetch();
  };
}

function addRealtimeListener(
  target: RealtimeSocketLike | RealtimeEventSourceLike,
  eventName: string,
  handler: (event: any) => void
) {
  if (target.addEventListener) {
    target.addEventListener(eventName, handler);
    return () => {
      target.removeEventListener?.(eventName, handler);
    };
  }

  const propertyName = `on${eventName}` as const;
  const fallbackTarget = target as Record<string, unknown>;
  const previous = fallbackTarget[propertyName];
  fallbackTarget[propertyName] = handler;

  return () => {
    if (fallbackTarget[propertyName] === handler) {
      fallbackTarget[propertyName] = previous ?? null;
    }
  };
}

function readSocketMessage(event: unknown) {
  if (
    typeof event === "object" &&
    event !== null &&
    "data" in event &&
    typeof (event as { data?: unknown }).data === "string"
  ) {
    return (event as { data: string }).data;
  }

  if (typeof event === "string") {
    return event;
  }

  return JSON.stringify(event ?? null);
}

function parseRealtimeServerMessage(raw: string) {
  return serverRealtimeMessageSchema.parse(JSON.parse(raw) as unknown);
}

function handleRealtimeServerMessage(parsed: ReturnType<typeof parseRealtimeServerMessage>, handlers: RunRealtimeHandlers) {
  switch (parsed.type) {
    case "runs.snapshot":
      handlers.onSnapshot?.(parsed.payload);
      return;
    case "runs.event":
      handlers.onEvent?.(parsed.payload);
      return;
    case "runs.ack":
      handlers.onAck?.(parsed.runId, parsed.ok);
      return;
    case "runs.error":
      handlers.onError?.(parsed.error);
      return;
  }
}

export function createRunsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listRuns(query: ListRunsQuery = {}): Promise<RunSnapshot[]> {
      const parsed = listRunsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/runs${buildQueryString({
          q: parsed.q,
          status: parsed.status,
          viewStatus: parsed.viewStatus,
          attentionMode: parsed.attentionMode,
          entrySurface: parsed.entrySurface,
          tag: parsed.tag,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );
      return parseJson(response, {
        parse(value: unknown) {
          return runSnapshotSchema.array().parse(value);
        },
      });
    },

    async getRunsSummary(query: ListRunsQuery = {}): Promise<RunListSummary> {
      const parsed = listRunsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/runs/summary${buildQueryString({
          q: parsed.q,
          status: parsed.status,
          viewStatus: parsed.viewStatus,
          attentionMode: parsed.attentionMode,
          entrySurface: parsed.entrySurface,
          tag: parsed.tag,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );
      return parseJson(response, runListSummarySchema);
    },

    async createRun(input: CreateRunInput): Promise<CreateRunResponse> {
      const body = createRunInputSchema.parse(input);
      const response = await fetcher(`${config.baseUrl}/v1/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(body),
      });

      return parseJson(response, createRunResponseSchema);
    },

    async getRun(runId: string): Promise<RunSnapshot> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, runSnapshotSchema);
    },

    async listRunMcpCalls(
      runId: string,
      query: Omit<ListMcpCallsQuery, "runId"> = {}
    ): Promise<McpCallRecord[]> {
      const parsed = listMcpCallsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/runs/${encodeURIComponent(runId)}/mcp-calls${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          serviceId: parsed.serviceId,
          mcpId: parsed.mcpId,
          toolName: parsed.toolName,
          status: parsed.status,
          from: parsed.from,
          to: parsed.to,
          limit: typeof parsed.limit === "number" ? String(parsed.limit) : undefined,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return mcpCallRecordSchema.array().parse(value);
        },
      });
    },

    async listRunFiles(runId: string): Promise<RunFileEntry[]> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, {
        parse(value: unknown) {
          return runFileEntrySchema.array().parse(value);
        },
      });
    },

    async sendRunMessage(runId: string, input: SendRunMessageInput): Promise<RunSnapshot> {
      const body = sendRunMessageInputSchema.parse(input);
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(body),
      });

      return parseJson(response, runSnapshotSchema);
    },

    async listRunFileTree(runId: string): Promise<RunFileEntry[]> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/tree`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, {
        parse(value: unknown) {
          return runFileEntrySchema.array().parse(value);
        },
      });
    },

    async listRunIndexedFiles(
      runId: string,
      query: {
        prefix?: string;
        search?: string;
        source?: RunFileSource;
        kind?: RunFileEntry["kind"];
        previewable?: boolean;
        downloadable?: boolean;
        limit?: number;
      } = {}
    ): Promise<ListRunFileIndexResponse> {
      const serialized = buildQueryString({
        prefix: query.prefix,
        search: query.search,
        source: query.source,
        kind: query.kind,
        previewable:
          typeof query.previewable === "boolean" ? String(query.previewable) : undefined,
        downloadable:
          typeof query.downloadable === "boolean" ? String(query.downloadable) : undefined,
        limit: typeof query.limit === "number" ? String(query.limit) : undefined,
      });
      const response = await fetcher(
        `${config.baseUrl}/v1/runs/${runId}/files/indexed${serialized}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );
      return parseJson(response, listRunFileIndexResponseSchema);
    },

    async statRunFile(runId: string, filePath?: string): Promise<RunFileEntry> {
      const query = filePath ? `?path=${encodeURIComponent(filePath)}` : "";
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/stat${query}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, runFileEntrySchema);
    },

    async readRunFile(runId: string, filePath?: string): Promise<RunFileReadResponse> {
      const query = filePath ? `?path=${encodeURIComponent(filePath)}` : "";
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/read${query}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, runFileReadResponseSchema);
    },

    async previewRunFile(runId: string, filePath?: string): Promise<RunFilePreviewResponse> {
      const query = filePath ? `?path=${encodeURIComponent(filePath)}` : "";
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/preview${query}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      const preview = await parseJson(response, runFilePreviewResponseSchema);

      return preview.downloadUrl
        ? {
            ...preview,
            downloadUrl: resolveApiUrl(config.baseUrl, preview.downloadUrl),
          }
        : preview;
    },

    async approveRun(runId: string, input: ApproveRunInput): Promise<RunSnapshot> {
      const body = approveRunInputSchema.parse(input);
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/approvals`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(body),
      });

      return parseJson(response, runSnapshotSchema);
    },

    async setRunApprovalMode(
      runId: string,
      input: UpdateRunApprovalModeInput
    ): Promise<RunSnapshot> {
      const body = updateRunApprovalModeInputSchema.parse(input);
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/approval-mode`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(body),
      });

      return parseJson(response, runSnapshotSchema);
    },

    async reviewRunInformationAnswer(
      runId: string,
      input: ReviewRunInformationAnswerInput
    ): Promise<RunSnapshot> {
      const body = reviewRunInformationAnswerInputSchema.parse(input);
      const response = await fetcher(
        `${config.baseUrl}/v1/runs/${runId}/information-collection/reviews`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(body),
        }
      );

      return parseJson(response, runSnapshotSchema);
    },

    async listRunUploads(runId: string): Promise<RunUploadRecord[]> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/uploads`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, {
        parse(value: unknown) {
          return runUploadRecordSchema.array().parse(value);
        },
      });
    },

    async createRunUpload(runId: string, input: CreateRunUploadInput): Promise<CreateRunUploadResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/uploads`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createRunUploadInputSchema.parse(input)),
      });

      return parseJson(response, createRunUploadResponseSchema);
    },

    async uploadRunUploadContent(
      runId: string,
      uploadId: string,
      content: Uint8Array | ArrayBuffer
    ) {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/uploads/${uploadId}/content`, {
        method: "PUT",
        headers: {
          "content-type": "application/octet-stream",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body:
          content instanceof ArrayBuffer
            ? new Uint8Array(content)
            : content instanceof Uint8Array
              ? content
              : content,
      });

      return parseJson(response, runUploadRecordSchema);
    },

    async finalizeRunUpload(
      runId: string,
      uploadId: string,
      input: FinalizeRunUploadInput = {}
    ): Promise<FinalizeRunUploadResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/uploads/${uploadId}/finalize`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(finalizeRunUploadInputSchema.parse(input)),
      });

      return parseJson(response, finalizeRunUploadResponseSchema);
    },

    async createRunDownloadTicket(
      runId: string,
      input: CreateRunDownloadTicketInput
    ): Promise<CreateRunDownloadTicketResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/download-tickets`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createRunDownloadTicketInputSchema.parse(input)),
      });

      return parseJson(response, createRunDownloadTicketResponseSchema);
    },

    async cancelRun(runId: string, reason?: string): Promise<RunSnapshot> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/cancel`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(reason ? { reason } : {}),
      });

      return parseJson(response, runSnapshotSchema);
    },
  };
}

export type RunsApiClient = ReturnType<typeof createRunsApiClient>;

export function createSessionCapturesApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;
  return {
    async listWorkspace(): Promise<ListSessionCapturesResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-captures`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, listSessionCapturesResponseSchema);
    },
    async create(runId: string, input: CreateSessionCaptureInput): Promise<CreateSessionCaptureResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${encodeURIComponent(runId)}/session-captures`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(createSessionCaptureInputSchema.parse(input)),
      });
      return parseJson(response, createSessionCaptureResponseSchema);
    },
    async list(runId: string): Promise<ListSessionCapturesResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/runs/${encodeURIComponent(runId)}/session-captures`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, listSessionCapturesResponseSchema);
    },
    async get(captureId: string): Promise<SessionCaptureRecord> {
      const response = await fetcher(`${config.baseUrl}/v1/session-captures/${encodeURIComponent(captureId)}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, sessionCaptureRecordSchema);
    },
    async retry(captureId: string): Promise<SessionCaptureRecord> {
      const response = await fetcher(`${config.baseUrl}/v1/session-captures/${encodeURIComponent(captureId)}/retry`, {
        method: "POST",
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, sessionCaptureRecordSchema);
    },
    async listAccessAudit(captureId: string): Promise<ListSessionCaptureObjectAccessAuditResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-captures/${encodeURIComponent(captureId)}/access-audit`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, listSessionCaptureObjectAccessAuditResponseSchema);
    },
    async downloadObject(captureId: string, objectType: string, input: RequestSessionCaptureObjectDownload): Promise<Response> {
      return fetcher(`${config.baseUrl}/v1/session-captures/${encodeURIComponent(captureId)}/objects/${encodeURIComponent(objectType)}/download`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(requestSessionCaptureObjectDownloadSchema.parse(input)),
      });
    },
  };
}

export type SessionCapturesApiClient = ReturnType<typeof createSessionCapturesApiClient>;

export function createSessionDraftsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;
  return {
    async list(): Promise<ListSessionDraftsResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-drafts`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, listSessionDraftsResponseSchema);
    },
    async createFromCapture(captureId: string, input: CreateSessionDraftInput): Promise<CreateSessionDraftResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-captures/${encodeURIComponent(captureId)}/drafts`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(createSessionDraftInputSchema.parse(input)),
      });
      return parseJson(response, createSessionDraftResponseSchema);
    },
    async get(draftId: string): Promise<SessionDraftDetail> {
      const response = await fetcher(`${config.baseUrl}/v1/session-drafts/${encodeURIComponent(draftId)}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, sessionDraftDetailSchema);
    },
    async createRevision(draftId: string, input: CreateSessionDraftRevisionInput): Promise<CreateSessionDraftRevisionResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-drafts/${encodeURIComponent(draftId)}/revisions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(createSessionDraftRevisionInputSchema.parse(input)),
      });
      return parseJson(response, createSessionDraftRevisionResponseSchema);
    },
    async review(draftId: string, input: SubmitSessionRedactionReviewInput): Promise<SubmitSessionRedactionReviewResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-drafts/${encodeURIComponent(draftId)}/redaction-review`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(submitSessionRedactionReviewInputSchema.parse(input)),
      });
      return parseJson(response, submitSessionRedactionReviewResponseSchema);
    },
    async replay(draftId: string, input: CreateSessionDraftReplayInput): Promise<CreateSessionDraftReplayResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-drafts/${encodeURIComponent(draftId)}/replay`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(createSessionDraftReplayInputSchema.parse(input)),
      });
      return parseJson(response, createSessionDraftReplayResponseSchema);
    },
    async seal(draftId: string, input: SealSessionDraftInput): Promise<SealSessionDraftResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-drafts/${encodeURIComponent(draftId)}/seal`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(sealSessionDraftInputSchema.parse(input)),
      });
      return parseJson(response, sealSessionDraftResponseSchema);
    },
  };
}

export type SessionDraftsApiClient = ReturnType<typeof createSessionDraftsApiClient>;

export function createSessionMigrationsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;
  return {
    async migrateLegacyArchives(input: MigrateLegacySessionArchivesInput): Promise<MigrateLegacySessionArchivesResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/session-migrations/legacy-archives`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(migrateLegacySessionArchivesInputSchema.parse(input)),
      });
      return parseJson(response, migrateLegacySessionArchivesResponseSchema);
    },
    async importV2Archive(content: Uint8Array): Promise<SealedSessionVersionRecord> {
      const response = await fetcher(`${config.baseUrl}/v1/session-versions/import`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream", ...buildAuthHeaders(config.getAccessToken) },
        body: content,
      });
      return parseJson(response, sealedSessionVersionRecordSchema);
    },
  };
}

export type SessionMigrationsApiClient = ReturnType<typeof createSessionMigrationsApiClient>;

export function createSessionVersionsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;
  return {
    async list(sessionId: string): Promise<ListSealedSessionVersionsResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/versions`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, listSealedSessionVersionsResponseSchema);
    },
    async get(sessionVersionId: string): Promise<SealedSessionVersionRecord> {
      const response = await fetcher(`${config.baseUrl}/v1/session-versions/${encodeURIComponent(sessionVersionId)}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, sealedSessionVersionRecordSchema);
    },
    async getPackageBindings(packageId: string): Promise<CreatorPackageSessionBindings> {
      const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/session-binding`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });
      return parseJson(response, creatorPackageSessionBindingsSchema);
    },
    async bindPackage(
      packageId: string,
      input: PutCreatorPackageSessionBindingInput
    ): Promise<CreatorPackageSessionBinding> {
      const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/session-binding`, {
        method: "PUT",
        headers: { "content-type": "application/json", ...buildAuthHeaders(config.getAccessToken) },
        body: JSON.stringify(putCreatorPackageSessionBindingInputSchema.parse(input)),
      });
      return parseJson(response, creatorPackageSessionBindingSchema);
    },
  };
}

export type SessionVersionsApiClient = ReturnType<typeof createSessionVersionsApiClient>;

export function createBatchRunsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listBatchRuns(query: ListBatchRunsQuery = {}): Promise<BatchRunDetail[]> {
      const parsed = listBatchRunsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/batch-runs${buildQueryString({
          workspaceId: parsed.workspaceId,
          workspaceContextKey: parsed.workspaceContextKey,
          serviceId: parsed.serviceId,
          status: parsed.status,
          q: parsed.q,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return batchRunDetailSchema.array().parse(value);
        },
      });
    },

    async createBatchRun(input: CreateBatchRunInput): Promise<BatchRunDetail> {
      const response = await fetcher(`${config.baseUrl}/v1/batch-runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createBatchRunInputSchema.parse(input)),
      });

      return parseJson(response, batchRunDetailSchema);
    },

    async estimateBatchRun(input: EstimateBatchRunInput): Promise<BatchRunBudgetEstimate> {
      const response = await fetcher(`${config.baseUrl}/v1/batch-runs/estimate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(estimateBatchRunInputSchema.parse(input)),
      });

      return parseJson(response, {
        parse(value: unknown) {
          return batchRunBudgetEstimateSchema.parse(value);
        },
      });
    },

    async importBatchRunFile(input: ImportBatchRunFileInput): Promise<ImportBatchRunFileResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/batch-runs/import-file`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(importBatchRunFileInputSchema.parse(input)),
      });

      return parseJson(response, importBatchRunFileResponseSchema);
    },

    async getBatchRun(batchJobId: string): Promise<BatchRunDetail> {
      const response = await fetcher(`${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, batchRunDetailSchema);
    },

    async listBatchItems(
      batchJobId: string,
      query: ListBatchRunItemsQuery = {}
    ): Promise<BatchRunItemsResponse> {
      const parsed = listBatchRunItemsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/items${buildQueryString({
          status: parsed.status,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, batchRunItemsResponseSchema);
    },

    async validateBatchRun(batchJobId: string): Promise<BatchRunDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/validate`,
        {
          method: "POST",
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, batchRunDetailSchema);
    },

    async startBatchRun(
      batchJobId: string,
      input: BatchRunStartInput = {}
    ): Promise<BatchRunDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/start`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(batchRunStartInputSchema.parse(input)),
        }
      );

      return parseJson(response, batchRunDetailSchema);
    },

    async retryBatchRun(
      batchJobId: string,
      input: BatchRunRetryInput = { onlyFailed: true }
    ): Promise<BatchRunDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/retry`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(batchRunRetryInputSchema.parse(input)),
        }
      );

      return parseJson(response, batchRunDetailSchema);
    },

    async cancelBatchRun(
      batchJobId: string,
      input: BatchRunCancelInput = {}
    ): Promise<BatchRunDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/cancel`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(batchRunCancelInputSchema.parse(input)),
        }
      );

      return parseJson(response, batchRunDetailSchema);
    },
  };
}

export type BatchRunsApiClient = ReturnType<typeof createBatchRunsApiClient>;

export function resolveApiUrl(baseUrl: string, url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return `${normalizedBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

export type UploadRunAttachmentInput = {
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  content: Uint8Array | ArrayBuffer;
  label?: string;
};

export async function uploadRunAttachment(
  client: Pick<
    RunsApiClient,
    "createRunUpload" | "uploadRunUploadContent" | "finalizeRunUpload"
  >,
  runId: string,
  input: UploadRunAttachmentInput
): Promise<RunConversationAttachment> {
  const created = await client.createRunUpload(runId, {
    fileName: input.fileName,
    contentType: input.contentType ?? undefined,
    sizeBytes: input.sizeBytes ?? undefined,
  });

  await client.uploadRunUploadContent(runId, created.upload.uploadId, input.content);

  const finalized = await client.finalizeRunUpload(runId, created.upload.uploadId, {
    label: input.label?.trim() || input.fileName,
  });

  return finalized.attachment;
}

export async function getRunFileDownloadUrl(
  client: Pick<RunsApiClient, "createRunDownloadTicket">,
  baseUrl: string,
  runId: string,
  filePath: string
) {
  const resolved = await client.createRunDownloadTicket(runId, {
    path: filePath,
  });

  return resolveApiUrl(baseUrl, resolved.downloadUrl);
}

export function createAuthApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async register(input: RegisterAuthInput): Promise<AuthSessionResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/auth/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(registerAuthInputSchema.parse(input)),
      });

      return parseJson(response, authSessionResponseSchema);
    },

    async login(input: LoginAuthInput): Promise<AuthSessionResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(loginAuthInputSchema.parse(input)),
      });

      return parseJson(response, authSessionResponseSchema);
    },

    async refresh(input: RefreshAuthInput): Promise<AuthSessionResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(refreshAuthInputSchema.parse(input)),
      });

      return parseJson(response, authSessionResponseSchema);
    },

    async logout(input: LogoutAuthInput = {}): Promise<{ ok: boolean }> {
      const response = await fetcher(`${config.baseUrl}/v1/auth/logout`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(logoutAuthInputSchema.parse(input)),
      });

      return parseJson(response, {
        parse(value: unknown) {
          return value as { ok: boolean };
        },
      });
    },

    async getSession(): Promise<AuthSessionEnvelope> {
      const response = await fetcher(`${config.baseUrl}/v1/auth/session`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, authSessionEnvelopeSchema);
    },

    async listWorkspaces() {
      const response = await fetcher(`${config.baseUrl}/v1/workspaces`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, {
        parse(value: unknown) {
          return workspaceSummarySchema.array().parse(value);
        },
      });
    },

    async getWorkspaceSummary(workspaceId: string): Promise<WorkspaceProfileSummary> {
      const response = await fetcher(
        `${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/summary`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, workspaceProfileSummarySchema);
    },

    async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]> {
      const response = await fetcher(
        `${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return workspaceMemberRecordSchema.array().parse(value);
        },
      });
    },

    async updateWorkspaceMember(
      workspaceId: string,
      userId: string,
      input: UpdateWorkspaceMembershipInput
    ): Promise<WorkspaceMemberRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(updateWorkspaceMembershipInputSchema.parse(input)),
        }
      );

      return parseJson(response, workspaceMemberRecordSchema);
    },

    async listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitationView[]> {
      const response = await fetcher(
        `${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return workspaceInvitationViewSchema.array().parse(value);
        },
      });
    },

    async createWorkspaceInvitation(
      workspaceId: string,
      input: CreateWorkspaceInvitationInput
    ): Promise<CreateWorkspaceInvitationResponse> {
      const response = await fetcher(
        `${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(createWorkspaceInvitationInputSchema.parse(input)),
        }
      );

      return parseJson(response, createWorkspaceInvitationResponseSchema);
    },

    async revokeWorkspaceInvitation(
      workspaceId: string,
      invitationId: string
    ): Promise<WorkspaceInvitationView> {
      const response = await fetcher(
        `${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/revoke`,
        {
          method: "POST",
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, workspaceInvitationViewSchema);
    },

    async listMyInvitations(): Promise<WorkspaceInvitationView[]> {
      const response = await fetcher(`${config.baseUrl}/v1/auth/invitations`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, {
        parse(value: unknown) {
          return workspaceInvitationViewSchema.array().parse(value);
        },
      });
    },

    async acceptWorkspaceInvitation(
      invitationId: string,
      input: AcceptWorkspaceInvitationInput
    ): Promise<AcceptWorkspaceInvitationResponse> {
      const response = await fetcher(
        `${config.baseUrl}/v1/auth/invitations/${encodeURIComponent(invitationId)}/accept`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(acceptWorkspaceInvitationInputSchema.parse(input)),
        }
      );

      return parseJson(response, acceptWorkspaceInvitationResponseSchema);
    },

    async switchWorkspace(input: SwitchWorkspaceInput): Promise<AuthSessionResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/workspaces/switch`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(switchWorkspaceInputSchema.parse(input)),
      });

      return parseJson(response, authSessionResponseSchema);
    },
  };
}

export function createWorkshopCatalogApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async createWorkshopServiceBundle(
      input: CreateWorkshopServiceBundleInput
    ): Promise<CreateWorkshopServiceBundleResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/workshops`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createWorkshopServiceBundleInputSchema.parse(input)),
      });
      return parseJson(response, createWorkshopServiceBundleResponseSchema);
    },

    async listWorkshops(query: ListWorkshopsQuery = {}): Promise<WorkshopCatalogEntry[]> {
      const parsed = listWorkshopsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/workshops${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          workspaceId: parsed.workspaceId,
          entrySurface: parsed.entrySurface,
          q: parsed.q,
          tag: parsed.tag,
          scope: parsed.scope,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return workshopCatalogEntrySchema.array().parse(value);
        },
      });
    },

    async getWorkshop(workshopId: string, query: ListWorkshopsQuery = {}): Promise<WorkshopDetail> {
      const parsed = listWorkshopsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/workshops/${encodeURIComponent(workshopId)}${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          workspaceId: parsed.workspaceId,
          entrySurface: parsed.entrySurface,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, workshopDetailSchema);
    },

    async listWorkshopServices(
      workshopId: string,
      query: ListServicesQuery = {}
    ): Promise<ServiceCatalogEntry[]> {
      const parsed = listServicesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/workshops/${encodeURIComponent(workshopId)}/services${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          workspaceId: parsed.workspaceId,
          entrySurface: parsed.entrySurface,
          q: parsed.q,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return serviceCatalogEntrySchema.array().parse(value);
        },
      });
    },

    async listServices(query: ListServicesQuery = {}): Promise<ServiceCatalogEntry[]> {
      const parsed = listServicesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/services${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          workspaceId: parsed.workspaceId,
          workshopId: parsed.workshopId,
          entrySurface: parsed.entrySurface,
          q: parsed.q,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return serviceCatalogEntrySchema.array().parse(value);
        },
      });
    },

    async getService(serviceId: string, query: ListServicesQuery = {}): Promise<ServiceDetail> {
      const parsed = listServicesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/services/${encodeURIComponent(serviceId)}${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          workspaceId: parsed.workspaceId,
          entrySurface: parsed.entrySurface,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, serviceDetailSchema);
    },

    async listTaskVersions(serviceId: string): Promise<ServiceTaskVersionRecord[]> {
      const response = await fetcher(
        `${config.baseUrl}/v1/services/${encodeURIComponent(serviceId)}/versions`,
        { headers: buildAuthHeaders(config.getAccessToken) }
      );
      return parseJson(response, {
        parse(value: unknown) {
          return serviceTaskVersionRecordSchema.array().parse(value);
        },
      });
    },

    async createLaunchTemplate(
      serviceId: string,
      input: CreateServiceLaunchTemplateInput
    ): Promise<ServiceLaunchTemplate> {
      const response = await fetcher(
        `${config.baseUrl}/v1/services/${encodeURIComponent(serviceId)}/launch-template`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(createServiceLaunchTemplateInputSchema.parse(input)),
        }
      );

      return parseJson(response, serviceLaunchTemplateSchema);
    },
  };
}

export function createSessionsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listSessionPacks(query: ListSessionPacksQuery = {}): Promise<SessionPackSummary[]> {
      const parsed = listSessionPacksQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          q: parsed.q,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return sessionPackSummarySchema.array().parse(value);
        },
      });
    },

    async getSessionPack(sessionVersionId: string): Promise<SessionPackDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, sessionPackDetailSchema);
    },

    async getSessionPackLineage(sessionVersionId: string): Promise<SessionPackLineageResponse> {
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/lineage`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, sessionPackLineageResponseSchema);
    },

    async importSessionPackArchive(
      archive: Uint8Array | ArrayBuffer,
      query: ImportSessionPackArchiveQuery = {}
    ): Promise<ImportSessionPackArchiveResponse> {
      const parsed = importSessionPackArchiveQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/import${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
        })}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/octet-stream",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: archive instanceof ArrayBuffer ? new Uint8Array(archive) : archive,
        }
      );

      return parseJson(response, importSessionPackArchiveResponseSchema);
    },

    async inheritSessionPack(
      sessionVersionId: string,
      input?: InheritSessionPackInput
    ): Promise<InheritSessionPackResponse> {
      const parsed = inheritSessionPackInputSchema.parse(input ?? {});
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/inherit`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(parsed),
        }
      );

      return parseJson(response, inheritSessionPackResponseSchema);
    },

    async publishSessionPack(
      sessionVersionId: string,
      input: PublishSessionPackInput
    ): Promise<PublishSessionPackResponse> {
      const parsed = publishSessionPackInputSchema.parse(input);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/publish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(parsed),
        }
      );

      return parseJson(response, publishSessionPackResponseSchema);
    },

    async rollbackSessionPack(
      sessionVersionId: string,
      input: RollbackSessionPackInput
    ): Promise<RollbackSessionPackResponse> {
      const parsed = rollbackSessionPackInputSchema.parse(input);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/rollback`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(parsed),
        }
      );

      return parseJson(response, rollbackSessionPackResponseSchema);
    },

    async unpublishSessionPack(
      sessionVersionId: string,
      input: UnpublishSessionPackInput
    ): Promise<UnpublishSessionPackResponse> {
      const parsed = unpublishSessionPackInputSchema.parse(input);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/unpublish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(parsed),
        }
      );

      return parseJson(response, unpublishSessionPackResponseSchema);
    },

    async updateSessionPackRedactionMap(
      sessionVersionId: string,
      input: UpdateSessionPackRedactionMapInput
    ): Promise<UpdateSessionPackRedactionMapResponse> {
      const parsed = updateSessionPackRedactionMapInputSchema.parse(input);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/redaction-map`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(parsed),
        }
      );

      return parseJson(response, updateSessionPackRedactionMapResponseSchema);
    },

    async reviewSessionPackRedaction(
      sessionVersionId: string,
      input: ReviewSessionPackRedactionInput
    ): Promise<ReviewSessionPackRedactionResponse> {
      const parsed = reviewSessionPackRedactionInputSchema.parse(input);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/redaction-review`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(parsed),
        }
      );

      return parseJson(response, reviewSessionPackRedactionResponseSchema);
    },

    async downloadSessionPackArchive(
      sessionVersionId: string,
      query: DownloadSessionPackArchiveQuery = {}
    ): Promise<{
      content: Uint8Array;
      contentType: string | null;
      fileName: string | null;
      redacted: boolean;
    }> {
      const parsed = downloadSessionPackArchiveQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/archive${buildQueryString({
          redact: parsed.redact ? "true" : undefined,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `GET /v1/sessions/${sessionVersionId}/archive failed: ${response.status} ${response.statusText} ${text}`
        );
      }

      const content = new Uint8Array(await response.arrayBuffer());
      return {
        content,
        contentType: response.headers.get("content-type"),
        fileName: parseContentDispositionFileName(response.headers.get("content-disposition")),
        redacted: response.headers.get("x-lingban-session-pack-redacted") === "true",
      };
    },
  };
}

export function createSearchApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listSearchHistory(
      query: ListSearchHistoryQuery = {}
    ): Promise<SearchHistoryListResponse> {
      const parsed = listSearchHistoryQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/search/history${buildQueryString({
          q: parsed.q,
          limit: parsed.limit == null ? undefined : String(parsed.limit),
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, searchHistoryListResponseSchema);
    },

    async listSearchResults(
      query: ListSearchResultsQuery
    ): Promise<SearchResultListResponse> {
      const parsed = listSearchResultsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/search${buildQueryString({
          q: parsed.q,
          types: parsed.types,
          limit: parsed.limit == null ? undefined : String(parsed.limit),
          entrySurface: parsed.entrySurface,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, searchResultListResponseSchema);
    },

    async listSearchSuggestions(
      query: ListSearchSuggestionsQuery
    ): Promise<SearchSuggestionListResponse> {
      const parsed = listSearchSuggestionsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/search/suggestions${buildQueryString({
          q: parsed.q,
          types: parsed.types,
          limit: parsed.limit == null ? undefined : String(parsed.limit),
          entrySurface: parsed.entrySurface,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, searchSuggestionListResponseSchema);
    },

    async recordSearchClick(
      input: RecordSearchClickInput
    ): Promise<RecordSearchClickResult> {
      const response = await fetcher(`${config.baseUrl}/v1/search/clicks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(recordSearchClickInputSchema.parse(input)),
      });

      return parseJson(response, recordSearchClickResultSchema);
    },
  };
}

export function createCreatorApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async createPackage(input: CreateCreatorPackageInput): Promise<CreatorPackageDetail> {
      const response = await fetcher(`${config.baseUrl}/v1/packages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createCreatorPackageInputSchema.parse(input)),
      });
      return parseJson(response, creatorPackageDetailSchema);
    },

    async listPackages(query: ListCreatorPackagesQuery = {}): Promise<CreatorPackageSummary[]> {
      const parsed = listCreatorPackagesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/packages${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          q: parsed.q,
          state: parsed.state,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return creatorPackageSummarySchema.array().parse(value);
        },
      });
    },

    async getPackage(packageId: string): Promise<CreatorPackageDetail> {
      const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, creatorPackageDetailSchema);
    },

    async getGovernanceSectionSummary(
      packageId: string,
      section: CreatorGovernanceDynamicSection,
      query: CreatorGovernanceSectionSummaryQuery = {}
    ): Promise<CreatorGovernanceSectionSummary> {
      const parsedSection = creatorGovernanceDynamicSectionSchema.parse(section);
      const parsedQuery = creatorGovernanceSectionSummaryQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/governance/${encodeURIComponent(parsedSection)}/summary${buildQueryString({
          workspaceContextKey: parsedQuery.workspaceContextKey,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, creatorGovernanceSectionSummarySchema);
    },

    async listAuditExports(
      packageId: string,
      query: ListCreatorAuditExportsQuery = {}
    ): Promise<CreatorAuditExportRecord[]> {
      const parsed = listCreatorAuditExportsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/audit-exports${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return creatorAuditExportRecordSchema.array().parse(value);
        },
      });
    },

    async createAuditExport(
      packageId: string,
      input: CreateCreatorAuditExportInput
    ): Promise<CreatorAuditExportResponse> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/audit-exports`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(createCreatorAuditExportInputSchema.parse(input)),
        }
      );

      return parseJson(response, creatorAuditExportResponseSchema);
    },

    async downloadAuditExport(
      packageId: string,
      exportId: string
    ): Promise<{ fileName: string; contentType: string | null; blob: Blob }> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/audit-exports/${encodeURIComponent(exportId)}/content`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      if (!response.ok) {
        await parseJson(response, {
          parse() {
            return null;
          },
        });
      }

      const fileName =
        parseContentDispositionFileName(response.headers.get("content-disposition")) ??
        `${packageId}-${exportId}`;

      return {
        fileName,
        contentType: response.headers.get("content-type"),
        blob: await response.blob(),
      };
    },

    async listPackageReleases(packageId: string): Promise<CreatorReleaseSummary[]> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/releases`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return creatorReleaseSummarySchema.array().parse(value);
        },
      });
    },

    async createPackageRelease(
      packageId: string,
      input: CreateCreatorReleaseInput
    ): Promise<CreatorReleaseSummary> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/releases`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(createCreatorReleaseInputSchema.parse(input)),
        }
      );

      return parseJson(response, creatorReleaseSummarySchema);
    },

    async listReleaseGates(releaseId: string): Promise<CreatorReleaseGate[]> {
      const response = await fetcher(
        `${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/gates`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return creatorReleaseGateSchema.array().parse(value);
        },
      });
    },

    async decideReleaseGate(
      releaseId: string,
      gateId: string,
      input: DecideCreatorReleaseGateInput
    ): Promise<CreatorReleaseGate> {
      const response = await fetcher(
        `${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/gates/${encodeURIComponent(gateId)}/decide`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(decideCreatorReleaseGateInputSchema.parse(input)),
        }
      );

      return parseJson(response, creatorReleaseGateSchema);
    },

    async updatePackageRelease(
      packageId: string,
      releaseId: string,
      input: UpdateCreatorReleaseInput
    ): Promise<CreatorReleaseSummary> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/releases/${encodeURIComponent(releaseId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(updateCreatorReleaseInputSchema.parse(input)),
        }
      );

      return parseJson(response, creatorReleaseSummarySchema);
    },

    async listPackageReplays(packageId: string): Promise<CreatorReplaySummary[]> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/replays`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return creatorReplaySummarySchema.array().parse(value);
        },
      });
    },

    async createPackageReplay(
      packageId: string,
      input: CreateCreatorReplayInput
    ): Promise<CreatorReplaySummary> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/replays`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(createCreatorReplayInputSchema.parse(input)),
        }
      );

      return parseJson(response, creatorReplaySummarySchema);
    },

    async listReleaseActivations(releaseId: string): Promise<CreatorReleaseActivation[]> {
      const response = await fetcher(
        `${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/activations`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return creatorReleaseActivationSchema.array().parse(value);
        },
      });
    },

    async activateRelease(
      releaseId: string,
      input: ActivateCreatorReleaseInput = {}
    ): Promise<CreatorReleaseActivation> {
      const response = await fetcher(
        `${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/activate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(activateCreatorReleaseInputSchema.parse(input)),
        }
      );

      return parseJson(response, creatorReleaseActivationSchema);
    },

    async updatePackageReplay(
      packageId: string,
      replayId: string,
      input: UpdateCreatorReplayInput
    ): Promise<CreatorReplaySummary> {
      const response = await fetcher(
        `${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/replays/${encodeURIComponent(replayId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(updateCreatorReplayInputSchema.parse(input)),
        }
      );

      return parseJson(response, creatorReplaySummarySchema);
    },
  };
}

export function createSessionProjectsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async list(
      query: ListSessionProjectsQuery = {}
    ): Promise<ListSessionProjectsResponse> {
      const parsed = listSessionProjectsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/creator/session-projects${buildQueryString({
          q: parsed.q,
          status: parsed.status,
          limit: String(parsed.limit),
        })}`,
        { headers: buildAuthHeaders(config.getAccessToken) }
      );
      return parseJson(response, listSessionProjectsResponseSchema);
    },

    async create(input: CreateSessionProjectInput): Promise<SessionProjectRecord> {
      const response = await fetcher(`${config.baseUrl}/v1/creator/session-projects`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createSessionProjectInputSchema.parse(input)),
      });
      return parseJson(response, sessionProjectRecordSchema);
    },

    async get(sessionProjectId: string): Promise<SessionProjectRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/creator/session-projects/${encodeURIComponent(sessionProjectId)}`,
        { headers: buildAuthHeaders(config.getAccessToken) }
      );
      return parseJson(response, sessionProjectRecordSchema);
    },

    async update(
      sessionProjectId: string,
      input: UpdateSessionProjectInput
    ): Promise<SessionProjectRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/creator/session-projects/${encodeURIComponent(sessionProjectId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(updateSessionProjectInputSchema.parse(input)),
        }
      );
      return parseJson(response, sessionProjectRecordSchema);
    },

    async archive(sessionProjectId: string): Promise<SessionProjectRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/creator/session-projects/${encodeURIComponent(sessionProjectId)}/archive`,
        {
          method: "POST",
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );
      return parseJson(response, sessionProjectRecordSchema);
    },

    async createSourceRun(
      input: CreateCreatorSourceRunInput
    ): Promise<CreateCreatorSourceRunResponse> {
      const response = await fetcher(`${config.baseUrl}/v1/creator/source-runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": createIdempotencyKey(),
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createCreatorSourceRunInputSchema.parse(input)),
      });
      return parseJson(response, createCreatorSourceRunResponseSchema);
    },
  };
}

export type SessionProjectsApiClient = ReturnType<typeof createSessionProjectsApiClient>;

export function createMeApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async getSummary(): Promise<MeProfileSummary> {
      const response = await fetcher(`${config.baseUrl}/v1/me/summary`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, meProfileSummarySchema);
    },

    async listAssets(query: ListMeAssetsQuery = {}): Promise<MeAssetListResponse> {
      const parsed = listMeAssetsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/me/assets${buildQueryString({
          limit: parsed.limit == null ? undefined : String(parsed.limit),
          kind: parsed.kind,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, meAssetListResponseSchema);
    },

    async getAuthorizationSummary(
      query: ListMeAuthorizationsQuery = {}
    ): Promise<MeAuthorizationSummary> {
      const parsed = listMeAuthorizationsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/me/authorizations${buildQueryString({
          limit: parsed.limit == null ? undefined : String(parsed.limit),
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, meAuthorizationSummarySchema);
    },

    async listFavoriteWorkshops(
      query: ListMeFavoriteWorkshopsQuery = {}
    ): Promise<MeFavoriteWorkshopListResponse> {
      const parsed = listMeFavoriteWorkshopsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/me/favorites/workshops${buildQueryString({
          limit: parsed.limit == null ? undefined : String(parsed.limit),
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, meFavoriteWorkshopListResponseSchema);
    },

    async setFavoriteWorkshop(
      workshopId: string,
      input: SetMeFavoriteWorkshopInput
    ): Promise<SetMeFavoriteWorkshopResult> {
      const response = await fetcher(
        `${config.baseUrl}/v1/me/favorites/workshops/${encodeURIComponent(workshopId)}`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(setMeFavoriteWorkshopInputSchema.parse(input)),
        }
      );

      return parseJson(response, setMeFavoriteWorkshopResultSchema);
    },

    async listRecentActivities(
      query: ListMeRecentActivitiesQuery = {}
    ): Promise<MeRecentActivityListResponse> {
      const parsed = listMeRecentActivitiesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/me/recent${buildQueryString({
          limit: parsed.limit == null ? undefined : String(parsed.limit),
          types: parsed.types,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, meRecentActivityListResponseSchema);
    },

    async recordRecentActivity(
      input: RecordMeRecentActivityInput
    ): Promise<MeRecentActivityRecord> {
      const response = await fetcher(`${config.baseUrl}/v1/me/recent/record`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(recordMeRecentActivityInputSchema.parse(input)),
      });

      return parseJson(response, meRecentActivityRecordSchema);
    },

    async listNotices(query: ListMeNoticesQuery = {}): Promise<MeNotice[]> {
      const parsed = listMeNoticesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/me/notices${buildQueryString({
          limit: parsed.limit == null ? undefined : String(parsed.limit),
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return meNoticeSchema.array().parse(value);
        },
      });
    },

    async getNoticeSummary(): Promise<MeNoticeSummary> {
      const response = await fetcher(`${config.baseUrl}/v1/me/notices/summary`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, meNoticeSummarySchema);
    },
  };
}

export type MeApiClient = ReturnType<typeof createMeApiClient>;

export function createNotificationsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listNotifications(
      query: ListNotificationsQuery = {}
    ): Promise<NotificationRecord[]> {
      const parsed = listNotificationsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/notifications${buildQueryString({
          limit: parsed.limit == null ? undefined : String(parsed.limit),
          type: parsed.type,
          readState: parsed.readState,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return notificationRecordSchema.array().parse(value);
        },
      });
    },

    async getNotificationSummary(): Promise<NotificationSummary> {
      const response = await fetcher(`${config.baseUrl}/v1/notifications/summary`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, notificationSummarySchema);
    },

    async markNotificationRead(notificationId: string): Promise<NotificationRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/notifications/${encodeURIComponent(notificationId)}/read`,
        {
          method: "POST",
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, notificationRecordSchema);
    },

    async markAllNotificationsRead(): Promise<NotificationSummary> {
      const response = await fetcher(`${config.baseUrl}/v1/notifications/read-all`, {
        method: "POST",
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, notificationSummarySchema);
    },
  };
}

export type NotificationsApiClient = ReturnType<typeof createNotificationsApiClient>;
export type SearchApiClient = ReturnType<typeof createSearchApiClient>;

export type CreatorApiClient = ReturnType<typeof createCreatorApiClient>;

export function createBillingApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listEntries(query: ListBillingEntriesQuery = {}): Promise<BillingEntry[]> {
      const parsed = listBillingEntriesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/billing/entries${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          metric: parsed.metric,
          source: parsed.source,
          costBasis: parsed.costBasis,
          runId: parsed.runId,
          from: parsed.from,
          to: parsed.to,
          limit: parsed.limit == null ? undefined : String(parsed.limit),
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return billingEntrySchema.array().parse(value);
        },
      });
    },

    async getSummary(
      query: BillingLedgerSummaryQuery = {}
    ): Promise<BillingLedgerSummary> {
      const parsed = billingLedgerSummaryQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/billing/summary${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          runId: parsed.runId,
          from: parsed.from,
          to: parsed.to,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, billingLedgerSummarySchema);
    },
  };
}

export type BillingApiClient = ReturnType<typeof createBillingApiClient>;

export function createQuotaApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listPolicies(query: ListQuotaPoliciesQuery = {}): Promise<QuotaPolicy[]> {
      const parsed = listQuotaPoliciesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/quotas/policies${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          metric: parsed.metric,
          scopeType: parsed.scopeType,
          status: parsed.status,
          enabled:
            parsed.enabled === undefined
              ? undefined
              : parsed.enabled
                ? "true"
                : "false",
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return quotaPolicySchema.array().parse(value);
        },
      });
    },

    async createPolicy(input: CreateQuotaPolicyInput): Promise<QuotaPolicy> {
      const response = await fetcher(`${config.baseUrl}/v1/quotas/policies`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createQuotaPolicyInputSchema.parse(input)),
      });

      return parseJson(response, quotaPolicySchema);
    },

    async updatePolicy(
      policyId: string,
      input: UpdateQuotaPolicyInput
    ): Promise<QuotaPolicy> {
      const response = await fetcher(
        `${config.baseUrl}/v1/quotas/policies/${encodeURIComponent(policyId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(updateQuotaPolicyInputSchema.parse(input)),
        }
      );

      return parseJson(response, quotaPolicySchema);
    },

    async listCounters(query: ListQuotaCountersQuery = {}): Promise<QuotaCounter[]> {
      const parsed = listQuotaCountersQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/quotas/counters${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          metric: parsed.metric,
          scopeType: parsed.scopeType,
          runId: parsed.runId,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return quotaCounterSchema.array().parse(value);
        },
      });
    },

    async listEvents(query: ListQuotaEventsQuery = {}): Promise<QuotaEvent[]> {
      const parsed = listQuotaEventsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/quotas/events${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          metric: parsed.metric,
          decision: parsed.decision,
          runId: parsed.runId,
          overrideId: parsed.overrideId,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return quotaEventSchema.array().parse(value);
        },
      });
    },

    async listOverrides(query: ListQuotaOverridesQuery = {}): Promise<QuotaOverrideRecord[]> {
      const parsed = listQuotaOverridesQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/quotas/overrides${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          packageId: parsed.packageId,
          serviceId: parsed.serviceId,
          metric: parsed.metric,
          status: parsed.status,
          runId: parsed.runId,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return quotaOverrideRecordSchema.array().parse(value);
        },
      });
    },

    async approveOverride(
      overrideId: string,
      input: DecideQuotaOverrideInput = {}
    ): Promise<QuotaOverrideRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/quotas/overrides/${encodeURIComponent(overrideId)}/approve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(decideQuotaOverrideInputSchema.parse(input)),
        }
      );

      return parseJson(response, quotaOverrideRecordSchema);
    },

    async rejectOverride(
      overrideId: string,
      input: DecideQuotaOverrideInput = {}
    ): Promise<QuotaOverrideRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/quotas/overrides/${encodeURIComponent(overrideId)}/reject`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(decideQuotaOverrideInputSchema.parse(input)),
        }
      );

      return parseJson(response, quotaOverrideRecordSchema);
    },
  };
}

export type QuotaApiClient = ReturnType<typeof createQuotaApiClient>;

export function createCredentialsApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listCredentials(query: ListCredentialsQuery = {}): Promise<CredentialSummary[]> {
      const parsed = listCredentialsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials${buildQueryString({
          scope: parsed.scope,
          status: parsed.status,
          q: parsed.q,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return credentialSummarySchema.array().parse(value);
        },
      });
    },

    async getCredential(credentialId: string): Promise<CredentialDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, credentialDetailSchema);
    },

    async createCredential(input: CreateCredentialInput): Promise<CredentialDetail> {
      const response = await fetcher(`${config.baseUrl}/v1/credentials`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createCredentialInputSchema.parse(input)),
      });

      return parseJson(response, credentialDetailSchema);
    },

    async updateCredential(
      credentialId: string,
      input: UpdateCredentialInput
    ): Promise<CredentialDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(updateCredentialInputSchema.parse(input)),
        }
      );

      return parseJson(response, credentialDetailSchema);
    },

    async rotateCredential(
      credentialId: string,
      input: RotateCredentialInput
    ): Promise<CredentialDetail> {
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/rotate`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(rotateCredentialInputSchema.parse(input)),
        }
      );

      return parseJson(response, credentialDetailSchema);
    },

    async getCredentialUsage(credentialId: string): Promise<CredentialUsageResponse> {
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/usages`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, credentialUsageResponseSchema);
    },

    async listCredentialAuditEvents(
      credentialId: string,
      query: ListCredentialAuditEventsQuery = {}
    ): Promise<CredentialAuditEvent[]> {
      const parsed = listCredentialAuditEventsQuerySchema.parse(query);
      const serialized = buildQueryString({
        action: parsed.action,
        outcome: parsed.outcome,
        runId: parsed.runId,
        limit: typeof parsed.limit === "number" ? String(parsed.limit) : undefined,
      });
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/audit-events${serialized}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return credentialAuditEventSchema.array().parse(value);
        },
      });
    },

    async suspendCredential(
      credentialId: string,
      input: ChangeCredentialLifecycleInput = {}
    ): Promise<CredentialLifecycleChangeResult> {
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/suspend`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(changeCredentialLifecycleInputSchema.parse(input)),
        }
      );

      return parseJson(response, credentialLifecycleChangeResultSchema);
    },

    async revokeCredential(
      credentialId: string,
      input: ChangeCredentialLifecycleInput = {}
    ): Promise<CredentialLifecycleChangeResult> {
      const response = await fetcher(
        `${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/revoke`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(changeCredentialLifecycleInputSchema.parse(input)),
        }
      );

      return parseJson(response, credentialLifecycleChangeResultSchema);
    },
  };
}

export type CredentialsApiClient = ReturnType<typeof createCredentialsApiClient>;

export function createMcpGovernanceApiClient(config: ClientConfig) {
  const fetcher = config.fetcher ?? fetch;

  return {
    async listMcps(query: ListMcpsQuery = {}): Promise<McpRegistryEntry[]> {
      const parsed = listMcpsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/mcps${buildQueryString({
          source: parsed.source,
          status: parsed.status,
          q: parsed.q,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return mcpRegistryEntrySchema.array().parse(value);
        },
      });
    },

    async getMcp(mcpId: string): Promise<McpRegistryEntry> {
      const response = await fetcher(`${config.baseUrl}/v1/mcps/${encodeURIComponent(mcpId)}`, {
        headers: buildAuthHeaders(config.getAccessToken),
      });

      return parseJson(response, mcpRegistryEntrySchema);
    },

    async createMcp(input: CreateMcpInput): Promise<McpRegistryEntry> {
      const response = await fetcher(`${config.baseUrl}/v1/mcps`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createMcpInputSchema.parse(input)),
      });

      return parseJson(response, mcpRegistryEntrySchema);
    },

    async updateMcp(mcpId: string, input: UpdateMcpInput): Promise<McpRegistryEntry> {
      const response = await fetcher(`${config.baseUrl}/v1/mcps/${encodeURIComponent(mcpId)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(updateMcpInputSchema.parse(input)),
      });

      return parseJson(response, mcpRegistryEntrySchema);
    },

    async listBindings(query: ListMcpBindingsQuery = {}): Promise<McpBindingRecord[]> {
      const parsed = listMcpBindingsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/mcp-bindings${buildQueryString({
          scope: parsed.scope,
          status: parsed.status,
          mcpId: parsed.mcpId,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return mcpBindingRecordSchema.array().parse(value);
        },
      });
    },

    async listCalls(query: ListMcpCallsQuery = {}): Promise<McpCallRecord[]> {
      const parsed = listMcpCallsQuerySchema.parse(query);
      const response = await fetcher(
        `${config.baseUrl}/v1/mcp-calls${buildQueryString({
          workspaceContextKey: parsed.workspaceContextKey,
          serviceId: parsed.serviceId,
          runId: parsed.runId,
          mcpId: parsed.mcpId,
          toolName: parsed.toolName,
          status: parsed.status,
          from: parsed.from,
          to: parsed.to,
          limit: typeof parsed.limit === "number" ? String(parsed.limit) : undefined,
        })}`,
        {
          headers: buildAuthHeaders(config.getAccessToken),
        }
      );

      return parseJson(response, {
        parse(value: unknown) {
          return mcpCallRecordSchema.array().parse(value);
        },
      });
    },

    async createBinding(input: CreateMcpBindingInput): Promise<McpBindingRecord> {
      const response = await fetcher(`${config.baseUrl}/v1/mcp-bindings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildAuthHeaders(config.getAccessToken),
        },
        body: JSON.stringify(createMcpBindingInputSchema.parse(input)),
      });

      return parseJson(response, mcpBindingRecordSchema);
    },

    async updateBinding(
      bindingId: string,
      input: UpdateMcpBindingInput
    ): Promise<McpBindingRecord> {
      const response = await fetcher(
        `${config.baseUrl}/v1/mcp-bindings/${encodeURIComponent(bindingId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...buildAuthHeaders(config.getAccessToken),
          },
          body: JSON.stringify(updateMcpBindingInputSchema.parse(input)),
        }
      );

      return parseJson(response, mcpBindingRecordSchema);
    },
  };
}

export type McpGovernanceApiClient = ReturnType<typeof createMcpGovernanceApiClient>;

export function createRunsRealtimeClient(config: RunsRealtimeClientConfig) {
  const socketFactory =
    config.socketFactory ??
    ((url: string) => {
      if (typeof WebSocket === "undefined") {
        throw new Error("WebSocket is not available in the current runtime.");
      }

      return new WebSocket(url);
    });
  const eventSourceFactory =
    config.eventSourceFactory ??
    ((url: string) => {
      if (typeof EventSource === "undefined") {
        throw new Error("EventSource is not available in the current runtime.");
      }

      return new EventSource(url);
    });

  return {
    connect(runId: string, handlers: RunRealtimeHandlers = {}): RunRealtimeConnection {
      const accessToken = config.getAccessToken?.();
      const teardown: Array<() => void> = [];
      const preferTransport = config.preferTransport ?? "auto";
      const allowSseFallback = preferTransport === "auto";
      let socket: RealtimeSocketLike | null = null;
      let eventSource: RealtimeEventSourceLike | null = null;
      let closed = false;
      let transportSwitching = false;
      let wsOpened = false;
      let commandChannelOpen = false;

      const disposeListeners = () => {
        while (teardown.length > 0) {
          const dispose = teardown.pop();
          dispose?.();
        }
      };

      const sendPayload = (payload: unknown) => {
        if (!socket || socket.readyState !== 1) {
          return;
        }

        socket.send(JSON.stringify(payload));
      };

      const emitTransportOpen = (transport: RunRealtimeTransport) => {
        handlers.onTransport?.(transport);
        handlers.onOpen?.();
      };

      const forwardRealtimePayload = (raw: string) => {
        try {
          handleRealtimeServerMessage(parseRealtimeServerMessage(raw), handlers);
        } catch (error) {
          handlers.onError?.(error instanceof Error ? error.message : "Invalid realtime payload");
        }
      };

      const connectSse = () => {
        try {
          eventSource = eventSourceFactory(
            appendAccessToken(
              `${normalizeBaseUrl(config.baseUrl)}/v1/runs/${encodeURIComponent(runId)}/stream`,
              accessToken
            )
          );
        } catch (error) {
          handlers.onError?.(
            error instanceof Error ? error.message : "Failed to create EventSource connection"
          );
          return false;
        }

        teardown.push(
          addRealtimeListener(eventSource, "open", () => {
            if (closed) {
              return;
            }

            emitTransportOpen("sse");
          })
        );
        teardown.push(
          addRealtimeListener(eventSource, "runs.snapshot", (event) => {
            forwardRealtimePayload(readSocketMessage(event));
          })
        );
        teardown.push(
          addRealtimeListener(eventSource, "runs.event", (event) => {
            forwardRealtimePayload(readSocketMessage(event));
          })
        );
        teardown.push(
          addRealtimeListener(eventSource, "error", () => {
            if (closed) {
              return;
            }

            handlers.onError?.("SSE connection error");
          })
        );

        return true;
      };

      const fallbackToSse = () => {
        if (closed || transportSwitching || !allowSseFallback) {
          return false;
        }

        transportSwitching = true;
        disposeListeners();
        socket?.close(1000, "fallback.sse");
        socket = null;
        commandChannelOpen = false;
        const connected = connectSse();
        transportSwitching = false;
        return connected;
      };

      const connectWs = () => {
        try {
          socket = socketFactory(
            appendAccessToken(
              `${toWebSocketBaseUrl(config.baseUrl)}/ws/runs/${encodeURIComponent(runId)}`,
              accessToken
            )
          );
        } catch (error) {
          if (fallbackToSse()) {
            return;
          }

          handlers.onError?.(
            error instanceof Error ? error.message : "Failed to create WebSocket connection"
          );
          return;
        }

        teardown.push(
          addRealtimeListener(socket, "open", () => {
            if (closed) {
              return;
            }

            wsOpened = true;
            commandChannelOpen = true;
            sendPayload(
              clientRealtimeMessageSchema.parse({
                type: "runs.subscribe",
                runId,
              })
            );
            emitTransportOpen("ws");
          })
        );

        teardown.push(
          addRealtimeListener(socket, "message", (event) => {
            forwardRealtimePayload(readSocketMessage(event));
          })
        );

        teardown.push(
          addRealtimeListener(socket, "error", () => {
            if (closed || transportSwitching) {
              return;
            }

            if (!wsOpened && fallbackToSse()) {
              return;
            }

            handlers.onError?.("WebSocket connection error");
          })
        );

        teardown.push(
          addRealtimeListener(socket, "close", () => {
            commandChannelOpen = false;

            if (closed || transportSwitching) {
              return;
            }

            if (!wsOpened && fallbackToSse()) {
              return;
            }

            handlers.onClose?.();
          })
        );
      };

      if (preferTransport === "sse") {
        connectSse();
      } else {
        connectWs();
      }

      return {
        close() {
          if (closed) {
            return;
          }

          closed = true;
          commandChannelOpen = false;
          disposeListeners();
          eventSource?.close();
          eventSource = null;
          socket?.close(1000, "client.close");
          socket = null;
        },
        sendMessage(input) {
          sendPayload(
            clientRealtimeMessageSchema.parse({
              type: "runs.sendMessage",
              runId,
              payload: sendRunMessageInputSchema.parse(input),
            })
          );
        },
        approve(input) {
          sendPayload(
            clientRealtimeMessageSchema.parse({
              type: "runs.approve",
              runId,
              payload: approveRunInputSchema.parse(input),
            })
          );
        },
        cancel(reason) {
          sendPayload(
            clientRealtimeMessageSchema.parse({
              type: "runs.cancel",
              runId,
              reason,
            })
          );
        },
        isOpen() {
          return commandChannelOpen && socket?.readyState === 1;
        },
      };
    },
  };
}

export function buildRunDownloadTicketUrl(baseUrl: string, ticketId: string) {
  return `${normalizeBaseUrl(baseUrl)}/v1/downloads/${encodeURIComponent(ticketId)}`;
}
