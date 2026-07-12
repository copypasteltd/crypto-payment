import { acceptWorkspaceInvitationInputSchema, acceptWorkspaceInvitationResponseSchema, authSessionEnvelopeSchema, authSessionResponseSchema, activateCreatorReleaseInputSchema, batchRunCancelInputSchema, batchRunBudgetEstimateSchema, batchRunDetailSchema, importBatchRunFileInputSchema, importBatchRunFileResponseSchema, batchRunItemsResponseSchema, batchRunRetryInputSchema, batchRunStartInputSchema, createBatchRunInputSchema, estimateBatchRunInputSchema, billingEntrySchema, billingLedgerSummaryQuerySchema, billingLedgerSummarySchema, changeCredentialLifecycleInputSchema, credentialAuditEventSchema, createCreatorAuditExportInputSchema, createCredentialInputSchema, createCreatorReleaseInputSchema, createCreatorReplayInputSchema, createWorkspaceInvitationInputSchema, createWorkspaceInvitationResponseSchema, createQuotaPolicyInputSchema, createMcpBindingInputSchema, createMcpInputSchema, creatorGovernanceDynamicSectionSchema, creatorAuditExportRecordSchema, creatorAuditExportResponseSchema, creatorGovernanceSectionSummaryQuerySchema, creatorGovernanceSectionSummarySchema, creatorPackageDetailSchema, creatorPackageSummarySchema, creatorReleaseActivationSchema, creatorReleaseGateSchema, creatorReleaseSummarySchema, creatorReplaySummarySchema, decideCreatorReleaseGateInputSchema, decideQuotaOverrideInputSchema, listBillingEntriesQuerySchema, listCreatorAuditExportsQuerySchema, quotaCounterSchema, quotaEventSchema, quotaOverrideRecordSchema, quotaPolicySchema, listQuotaCountersQuerySchema, listQuotaEventsQuerySchema, listQuotaOverridesQuerySchema, listQuotaPoliciesQuerySchema, createServiceLaunchTemplateInputSchema, createRunDownloadTicketInputSchema, createRunDownloadTicketResponseSchema, loginAuthInputSchema, logoutAuthInputSchema, refreshAuthInputSchema, registerAuthInputSchema, listCreatorPackagesQuerySchema, listServicesQuerySchema, listWorkshopsQuerySchema, createRunUploadInputSchema, createRunUploadResponseSchema, credentialLifecycleChangeResultSchema, credentialDetailSchema, credentialSummarySchema, credentialUsageResponseSchema, finalizeRunUploadInputSchema, finalizeRunUploadResponseSchema, listCredentialsQuerySchema, listCredentialAuditEventsQuerySchema, listMeAssetsQuerySchema, listMeAuthorizationsQuerySchema, listMeFavoriteWorkshopsQuerySchema, listMeRecentActivitiesQuerySchema, listSearchHistoryQuerySchema, listSearchResultsQuerySchema, listSearchSuggestionsQuerySchema, recordSearchClickInputSchema, runUploadRecordSchema, listMcpCallsQuerySchema, listMcpBindingsQuerySchema, listMeNoticesQuerySchema, listNotificationsQuerySchema, listBatchRunItemsQuerySchema, listBatchRunsQuerySchema, listMcpsQuerySchema, listRunsQuerySchema, meAssetListResponseSchema, meAuthorizationSummarySchema, meFavoriteWorkshopListResponseSchema, meRecentActivityListResponseSchema, meRecentActivityRecordSchema, meNoticeSchema, meProfileSummarySchema, meNoticeSummarySchema, notificationRecordSchema, notificationSummarySchema, recordMeRecentActivityInputSchema, recordSearchClickResultSchema, searchHistoryListResponseSchema, searchResultListResponseSchema, searchSuggestionListResponseSchema, inheritSessionPackInputSchema, inheritSessionPackResponseSchema, downloadSessionPackArchiveQuerySchema, importSessionPackArchiveQuerySchema, importSessionPackArchiveResponseSchema, listSessionPacksQuerySchema, publishSessionPackInputSchema, publishSessionPackResponseSchema, reviewSessionPackRedactionInputSchema, reviewSessionPackRedactionResponseSchema, rollbackSessionPackInputSchema, rollbackSessionPackResponseSchema, updateSessionPackRedactionMapInputSchema, updateSessionPackRedactionMapResponseSchema, unpublishSessionPackInputSchema, unpublishSessionPackResponseSchema, sessionPackDetailSchema, sessionPackLineageResponseSchema, sessionPackSummarySchema, serviceDetailSchema, serviceLaunchTemplateSchema, serviceCatalogEntrySchema, mcpCallRecordSchema, mcpBindingRecordSchema, mcpRegistryEntrySchema, rotateCredentialInputSchema, switchWorkspaceInputSchema, approveRunInputSchema, reviewRunInformationAnswerInputSchema, clientRealtimeMessageSchema, createRunInputSchema, createRunResponseSchema, workshopDetailSchema, workshopCatalogEntrySchema, workspaceProfileSummarySchema, workspaceSummarySchema, serverRealtimeMessageSchema, runFileEntrySchema, listRunFileIndexResponseSchema, runListSummarySchema, runFilePreviewResponseSchema, runFileReadResponseSchema, runSnapshotSchema, sendRunMessageInputSchema, updateCreatorReleaseInputSchema, updateCreatorReplayInputSchema, updateCredentialInputSchema, updateMcpBindingInputSchema, updateMcpInputSchema, updateWorkspaceMembershipInputSchema, workspaceInvitationViewSchema, workspaceMemberRecordSchema, updateQuotaPolicyInputSchema, setMeFavoriteWorkshopInputSchema, setMeFavoriteWorkshopResultSchema, } from "@lingban/contracts";
export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, message, code, details) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, "");
}
async function parseJson(response, parser) {
    if (!response.ok) {
        const raw = await response.text();
        try {
            const parsed = JSON.parse(raw);
            throw new ApiError(response.status, parsed.error?.message ?? `HTTP_${response.status}`, parsed.error?.code, parsed.error?.details);
        }
        catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(response.status, raw || `HTTP_${response.status}`);
        }
    }
    const payload = (await response.json());
    return parser.parse(payload);
}
function toWebSocketBaseUrl(baseUrl) {
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
function buildAuthHeaders(getAccessToken) {
    const accessToken = getAccessToken?.();
    const headers = {};
    if (accessToken) {
        headers.authorization = `Bearer ${accessToken}`;
    }
    return headers;
}
function appendAccessToken(url, accessToken) {
    if (!accessToken) {
        return url;
    }
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}accessToken=${encodeURIComponent(accessToken)}`;
}
function buildQueryString(input) {
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
function resolveRequestUrl(baseUrl, input) {
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
function isAuthRetryBypassPathname(pathname) {
    return pathname === "/v1/auth/login" || pathname === "/v1/auth/register" || pathname === "/v1/auth/refresh";
}
function withAccessToken(init, accessToken) {
    const headers = new Headers(init?.headers ?? undefined);
    if (accessToken) {
        headers.set("authorization", `Bearer ${accessToken}`);
    }
    else {
        headers.delete("authorization");
    }
    return {
        ...init,
        headers,
    };
}
function parseContentDispositionFileName(value) {
    if (!value) {
        return null;
    }
    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(value);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]);
        }
        catch {
            return utf8Match[1];
        }
    }
    const simpleMatch = /filename=\"?([^\";]+)\"?/i.exec(value);
    return simpleMatch?.[1]?.trim() || null;
}
export function createSessionRefreshFetch(config) {
    const fetcher = config.fetcher ?? fetch;
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    let inFlightRefresh = null;
    const refreshSession = async () => {
        const refreshToken = config.getRefreshToken?.();
        if (!refreshToken) {
            const error = new ApiError(401, "Refresh token is unavailable.", "AUTH_REFRESH_UNAVAILABLE");
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
                        body: JSON.stringify(refreshAuthInputSchema.parse({
                            refreshToken,
                        })),
                    });
                    const refreshed = await parseJson(response, authSessionResponseSchema);
                    await config.applySessionResponse?.(refreshed);
                    return refreshed;
                }
                catch (error) {
                    await config.onAuthFailure?.(error);
                    throw error;
                }
                finally {
                    inFlightRefresh = null;
                }
            })();
        }
        return inFlightRefresh;
    };
    return async (input, init) => {
        if (typeof input !== "string" && !(input instanceof URL)) {
            return fetcher(input, init);
        }
        const url = resolveRequestUrl(baseUrl, input);
        const pathname = new URL(url).pathname;
        const bypassRetry = isAuthRetryBypassPathname(pathname);
        const attachAuth = !isAuthRetryBypassPathname(pathname);
        const performFetch = () => fetcher(url, withAccessToken(init, attachAuth ? config.getAccessToken?.() : undefined));
        const response = await performFetch();
        if (response.status !== 401 || bypassRetry) {
            return response;
        }
        try {
            await refreshSession();
        }
        catch {
            return response;
        }
        return performFetch();
    };
}
function addRealtimeListener(target, eventName, handler) {
    if (target.addEventListener) {
        target.addEventListener(eventName, handler);
        return () => {
            target.removeEventListener?.(eventName, handler);
        };
    }
    const propertyName = `on${eventName}`;
    const fallbackTarget = target;
    const previous = fallbackTarget[propertyName];
    fallbackTarget[propertyName] = handler;
    return () => {
        if (fallbackTarget[propertyName] === handler) {
            fallbackTarget[propertyName] = previous ?? null;
        }
    };
}
function readSocketMessage(event) {
    if (typeof event === "object" &&
        event !== null &&
        "data" in event &&
        typeof event.data === "string") {
        return event.data;
    }
    if (typeof event === "string") {
        return event;
    }
    return JSON.stringify(event ?? null);
}
function parseRealtimeServerMessage(raw) {
    return serverRealtimeMessageSchema.parse(JSON.parse(raw));
}
function handleRealtimeServerMessage(parsed, handlers) {
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
export function createRunsApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listRuns(query = {}) {
            const parsed = listRunsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/runs${buildQueryString({
                q: parsed.q,
                status: parsed.status,
                viewStatus: parsed.viewStatus,
                attentionMode: parsed.attentionMode,
                entrySurface: parsed.entrySurface,
                tag: parsed.tag,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return runSnapshotSchema.array().parse(value);
                },
            });
        },
        async getRunsSummary(query = {}) {
            const parsed = listRunsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/runs/summary${buildQueryString({
                q: parsed.q,
                status: parsed.status,
                viewStatus: parsed.viewStatus,
                attentionMode: parsed.attentionMode,
                entrySurface: parsed.entrySurface,
                tag: parsed.tag,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, runListSummarySchema);
        },
        async createRun(input) {
            const body = createRunInputSchema.parse(input);
            const response = await fetcher(`${config.baseUrl}/v1/runs`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(body),
            });
            return parseJson(response, createRunResponseSchema);
        },
        async getRun(runId) {
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, runSnapshotSchema);
        },
        async listRunMcpCalls(runId, query = {}) {
            const parsed = listMcpCallsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/runs/${encodeURIComponent(runId)}/mcp-calls${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                serviceId: parsed.serviceId,
                mcpId: parsed.mcpId,
                toolName: parsed.toolName,
                status: parsed.status,
                from: parsed.from,
                to: parsed.to,
                limit: typeof parsed.limit === "number" ? String(parsed.limit) : undefined,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return mcpCallRecordSchema.array().parse(value);
                },
            });
        },
        async listRunFiles(runId) {
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return runFileEntrySchema.array().parse(value);
                },
            });
        },
        async sendRunMessage(runId, input) {
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
        async listRunFileTree(runId) {
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/tree`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return runFileEntrySchema.array().parse(value);
                },
            });
        },
        async listRunIndexedFiles(runId, query = {}) {
            const serialized = buildQueryString({
                prefix: query.prefix,
                search: query.search,
                source: query.source,
                kind: query.kind,
                previewable: typeof query.previewable === "boolean" ? String(query.previewable) : undefined,
                downloadable: typeof query.downloadable === "boolean" ? String(query.downloadable) : undefined,
                limit: typeof query.limit === "number" ? String(query.limit) : undefined,
            });
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/indexed${serialized}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, listRunFileIndexResponseSchema);
        },
        async statRunFile(runId, filePath) {
            const query = filePath ? `?path=${encodeURIComponent(filePath)}` : "";
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/stat${query}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, runFileEntrySchema);
        },
        async readRunFile(runId, filePath) {
            const query = filePath ? `?path=${encodeURIComponent(filePath)}` : "";
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/files/read${query}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, runFileReadResponseSchema);
        },
        async previewRunFile(runId, filePath) {
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
        async approveRun(runId, input) {
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
        async reviewRunInformationAnswer(runId, input) {
            const body = reviewRunInformationAnswerInputSchema.parse(input);
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/information-collection/reviews`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(body),
            });
            return parseJson(response, runSnapshotSchema);
        },
        async listRunUploads(runId) {
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/uploads`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return runUploadRecordSchema.array().parse(value);
                },
            });
        },
        async createRunUpload(runId, input) {
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
        async uploadRunUploadContent(runId, uploadId, content) {
            const response = await fetcher(`${config.baseUrl}/v1/runs/${runId}/uploads/${uploadId}/content`, {
                method: "PUT",
                headers: {
                    "content-type": "application/octet-stream",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: content instanceof ArrayBuffer
                    ? new Uint8Array(content)
                    : content instanceof Uint8Array
                        ? content
                        : content,
            });
            return parseJson(response, runUploadRecordSchema);
        },
        async finalizeRunUpload(runId, uploadId, input = {}) {
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
        async createRunDownloadTicket(runId, input) {
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
        async cancelRun(runId, reason) {
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
export function createBatchRunsApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listBatchRuns(query = {}) {
            const parsed = listBatchRunsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs${buildQueryString({
                workspaceId: parsed.workspaceId,
                workspaceContextKey: parsed.workspaceContextKey,
                serviceId: parsed.serviceId,
                status: parsed.status,
                q: parsed.q,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return batchRunDetailSchema.array().parse(value);
                },
            });
        },
        async createBatchRun(input) {
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
        async estimateBatchRun(input) {
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs/estimate`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(estimateBatchRunInputSchema.parse(input)),
            });
            return parseJson(response, {
                parse(value) {
                    return batchRunBudgetEstimateSchema.parse(value);
                },
            });
        },
        async importBatchRunFile(input) {
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
        async getBatchRun(batchJobId) {
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, batchRunDetailSchema);
        },
        async listBatchItems(batchJobId, query = {}) {
            const parsed = listBatchRunItemsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/items${buildQueryString({
                status: parsed.status,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, batchRunItemsResponseSchema);
        },
        async validateBatchRun(batchJobId) {
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/validate`, {
                method: "POST",
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, batchRunDetailSchema);
        },
        async startBatchRun(batchJobId, input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/start`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(batchRunStartInputSchema.parse(input)),
            });
            return parseJson(response, batchRunDetailSchema);
        },
        async retryBatchRun(batchJobId, input = { onlyFailed: true }) {
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/retry`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(batchRunRetryInputSchema.parse(input)),
            });
            return parseJson(response, batchRunDetailSchema);
        },
        async cancelBatchRun(batchJobId, input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/batch-runs/${encodeURIComponent(batchJobId)}/cancel`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(batchRunCancelInputSchema.parse(input)),
            });
            return parseJson(response, batchRunDetailSchema);
        },
    };
}
export function resolveApiUrl(baseUrl, url) {
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    return `${normalizedBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}
export async function uploadRunAttachment(client, runId, input) {
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
export async function getRunFileDownloadUrl(client, baseUrl, runId, filePath) {
    const resolved = await client.createRunDownloadTicket(runId, {
        path: filePath,
    });
    return resolveApiUrl(baseUrl, resolved.downloadUrl);
}
export function createAuthApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async register(input) {
            const response = await fetcher(`${config.baseUrl}/v1/auth/register`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(registerAuthInputSchema.parse(input)),
            });
            return parseJson(response, authSessionResponseSchema);
        },
        async login(input) {
            const response = await fetcher(`${config.baseUrl}/v1/auth/login`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(loginAuthInputSchema.parse(input)),
            });
            return parseJson(response, authSessionResponseSchema);
        },
        async refresh(input) {
            const response = await fetcher(`${config.baseUrl}/v1/auth/refresh`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(refreshAuthInputSchema.parse(input)),
            });
            return parseJson(response, authSessionResponseSchema);
        },
        async logout(input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/auth/logout`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(logoutAuthInputSchema.parse(input)),
            });
            return parseJson(response, {
                parse(value) {
                    return value;
                },
            });
        },
        async getSession() {
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
                parse(value) {
                    return workspaceSummarySchema.array().parse(value);
                },
            });
        },
        async getWorkspaceSummary(workspaceId) {
            const response = await fetcher(`${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/summary`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, workspaceProfileSummarySchema);
        },
        async listWorkspaceMembers(workspaceId) {
            const response = await fetcher(`${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return workspaceMemberRecordSchema.array().parse(value);
                },
            });
        },
        async updateWorkspaceMember(workspaceId, userId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`, {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(updateWorkspaceMembershipInputSchema.parse(input)),
            });
            return parseJson(response, workspaceMemberRecordSchema);
        },
        async listWorkspaceInvitations(workspaceId) {
            const response = await fetcher(`${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return workspaceInvitationViewSchema.array().parse(value);
                },
            });
        },
        async createWorkspaceInvitation(workspaceId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(createWorkspaceInvitationInputSchema.parse(input)),
            });
            return parseJson(response, createWorkspaceInvitationResponseSchema);
        },
        async revokeWorkspaceInvitation(workspaceId, invitationId) {
            const response = await fetcher(`${config.baseUrl}/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/revoke`, {
                method: "POST",
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, workspaceInvitationViewSchema);
        },
        async listMyInvitations() {
            const response = await fetcher(`${config.baseUrl}/v1/auth/invitations`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return workspaceInvitationViewSchema.array().parse(value);
                },
            });
        },
        async acceptWorkspaceInvitation(invitationId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/auth/invitations/${encodeURIComponent(invitationId)}/accept`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(acceptWorkspaceInvitationInputSchema.parse(input)),
            });
            return parseJson(response, acceptWorkspaceInvitationResponseSchema);
        },
        async switchWorkspace(input) {
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
export function createWorkshopCatalogApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listWorkshops(query = {}) {
            const parsed = listWorkshopsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/workshops${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                workspaceId: parsed.workspaceId,
                entrySurface: parsed.entrySurface,
                q: parsed.q,
                tag: parsed.tag,
                scope: parsed.scope,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return workshopCatalogEntrySchema.array().parse(value);
                },
            });
        },
        async getWorkshop(workshopId, query = {}) {
            const parsed = listWorkshopsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/workshops/${encodeURIComponent(workshopId)}${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                workspaceId: parsed.workspaceId,
                entrySurface: parsed.entrySurface,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, workshopDetailSchema);
        },
        async listWorkshopServices(workshopId, query = {}) {
            const parsed = listServicesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/workshops/${encodeURIComponent(workshopId)}/services${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                workspaceId: parsed.workspaceId,
                entrySurface: parsed.entrySurface,
                q: parsed.q,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return serviceCatalogEntrySchema.array().parse(value);
                },
            });
        },
        async listServices(query = {}) {
            const parsed = listServicesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/services${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                workspaceId: parsed.workspaceId,
                workshopId: parsed.workshopId,
                entrySurface: parsed.entrySurface,
                q: parsed.q,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return serviceCatalogEntrySchema.array().parse(value);
                },
            });
        },
        async getService(serviceId, query = {}) {
            const parsed = listServicesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/services/${encodeURIComponent(serviceId)}${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                workspaceId: parsed.workspaceId,
                entrySurface: parsed.entrySurface,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, serviceDetailSchema);
        },
        async createLaunchTemplate(serviceId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/services/${encodeURIComponent(serviceId)}/launch-template`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(createServiceLaunchTemplateInputSchema.parse(input)),
            });
            return parseJson(response, serviceLaunchTemplateSchema);
        },
    };
}
export function createSessionsApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listSessionPacks(query = {}) {
            const parsed = listSessionPacksQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/sessions${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                packageId: parsed.packageId,
                serviceId: parsed.serviceId,
                q: parsed.q,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return sessionPackSummarySchema.array().parse(value);
                },
            });
        },
        async getSessionPack(sessionVersionId) {
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, sessionPackDetailSchema);
        },
        async getSessionPackLineage(sessionVersionId) {
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/lineage`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, sessionPackLineageResponseSchema);
        },
        async importSessionPackArchive(archive, query = {}) {
            const parsed = importSessionPackArchiveQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/sessions/import${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
            })}`, {
                method: "POST",
                headers: {
                    "content-type": "application/octet-stream",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: archive instanceof ArrayBuffer ? new Uint8Array(archive) : archive,
            });
            return parseJson(response, importSessionPackArchiveResponseSchema);
        },
        async inheritSessionPack(sessionVersionId, input) {
            const parsed = inheritSessionPackInputSchema.parse(input ?? {});
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/inherit`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(parsed),
            });
            return parseJson(response, inheritSessionPackResponseSchema);
        },
        async publishSessionPack(sessionVersionId, input) {
            const parsed = publishSessionPackInputSchema.parse(input);
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/publish`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(parsed),
            });
            return parseJson(response, publishSessionPackResponseSchema);
        },
        async rollbackSessionPack(sessionVersionId, input) {
            const parsed = rollbackSessionPackInputSchema.parse(input);
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/rollback`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(parsed),
            });
            return parseJson(response, rollbackSessionPackResponseSchema);
        },
        async unpublishSessionPack(sessionVersionId, input) {
            const parsed = unpublishSessionPackInputSchema.parse(input);
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/unpublish`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(parsed),
            });
            return parseJson(response, unpublishSessionPackResponseSchema);
        },
        async updateSessionPackRedactionMap(sessionVersionId, input) {
            const parsed = updateSessionPackRedactionMapInputSchema.parse(input);
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/redaction-map`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(parsed),
            });
            return parseJson(response, updateSessionPackRedactionMapResponseSchema);
        },
        async reviewSessionPackRedaction(sessionVersionId, input) {
            const parsed = reviewSessionPackRedactionInputSchema.parse(input);
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/redaction-review`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(parsed),
            });
            return parseJson(response, reviewSessionPackRedactionResponseSchema);
        },
        async downloadSessionPackArchive(sessionVersionId, query = {}) {
            const parsed = downloadSessionPackArchiveQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/sessions/${encodeURIComponent(sessionVersionId)}/archive${buildQueryString({
                redact: parsed.redact ? "true" : undefined,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`GET /v1/sessions/${sessionVersionId}/archive failed: ${response.status} ${response.statusText} ${text}`);
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
export function createSearchApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listSearchHistory(query = {}) {
            const parsed = listSearchHistoryQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/search/history${buildQueryString({
                q: parsed.q,
                limit: parsed.limit == null ? undefined : String(parsed.limit),
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, searchHistoryListResponseSchema);
        },
        async listSearchResults(query) {
            const parsed = listSearchResultsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/search${buildQueryString({
                q: parsed.q,
                types: parsed.types,
                limit: parsed.limit == null ? undefined : String(parsed.limit),
                entrySurface: parsed.entrySurface,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, searchResultListResponseSchema);
        },
        async listSearchSuggestions(query) {
            const parsed = listSearchSuggestionsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/search/suggestions${buildQueryString({
                q: parsed.q,
                types: parsed.types,
                limit: parsed.limit == null ? undefined : String(parsed.limit),
                entrySurface: parsed.entrySurface,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, searchSuggestionListResponseSchema);
        },
        async recordSearchClick(input) {
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
export function createCreatorApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listPackages(query = {}) {
            const parsed = listCreatorPackagesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/packages${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                q: parsed.q,
                state: parsed.state,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return creatorPackageSummarySchema.array().parse(value);
                },
            });
        },
        async getPackage(packageId) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, creatorPackageDetailSchema);
        },
        async getGovernanceSectionSummary(packageId, section, query = {}) {
            const parsedSection = creatorGovernanceDynamicSectionSchema.parse(section);
            const parsedQuery = creatorGovernanceSectionSummaryQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/governance/${encodeURIComponent(parsedSection)}/summary${buildQueryString({
                workspaceContextKey: parsedQuery.workspaceContextKey,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, creatorGovernanceSectionSummarySchema);
        },
        async listAuditExports(packageId, query = {}) {
            const parsed = listCreatorAuditExportsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/audit-exports${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return creatorAuditExportRecordSchema.array().parse(value);
                },
            });
        },
        async createAuditExport(packageId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/audit-exports`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(createCreatorAuditExportInputSchema.parse(input)),
            });
            return parseJson(response, creatorAuditExportResponseSchema);
        },
        async downloadAuditExport(packageId, exportId) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/audit-exports/${encodeURIComponent(exportId)}/content`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            if (!response.ok) {
                await parseJson(response, {
                    parse() {
                        return null;
                    },
                });
            }
            const fileName = parseContentDispositionFileName(response.headers.get("content-disposition")) ??
                `${packageId}-${exportId}`;
            return {
                fileName,
                contentType: response.headers.get("content-type"),
                blob: await response.blob(),
            };
        },
        async listPackageReleases(packageId) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/releases`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return creatorReleaseSummarySchema.array().parse(value);
                },
            });
        },
        async createPackageRelease(packageId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/releases`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(createCreatorReleaseInputSchema.parse(input)),
            });
            return parseJson(response, creatorReleaseSummarySchema);
        },
        async listReleaseGates(releaseId) {
            const response = await fetcher(`${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/gates`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return creatorReleaseGateSchema.array().parse(value);
                },
            });
        },
        async decideReleaseGate(releaseId, gateId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/gates/${encodeURIComponent(gateId)}/decide`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(decideCreatorReleaseGateInputSchema.parse(input)),
            });
            return parseJson(response, creatorReleaseGateSchema);
        },
        async updatePackageRelease(packageId, releaseId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/releases/${encodeURIComponent(releaseId)}`, {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(updateCreatorReleaseInputSchema.parse(input)),
            });
            return parseJson(response, creatorReleaseSummarySchema);
        },
        async listPackageReplays(packageId) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/replays`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return creatorReplaySummarySchema.array().parse(value);
                },
            });
        },
        async createPackageReplay(packageId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/replays`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(createCreatorReplayInputSchema.parse(input)),
            });
            return parseJson(response, creatorReplaySummarySchema);
        },
        async listReleaseActivations(releaseId) {
            const response = await fetcher(`${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/activations`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return creatorReleaseActivationSchema.array().parse(value);
                },
            });
        },
        async activateRelease(releaseId, input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/releases/${encodeURIComponent(releaseId)}/activate`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(activateCreatorReleaseInputSchema.parse(input)),
            });
            return parseJson(response, creatorReleaseActivationSchema);
        },
        async updatePackageReplay(packageId, replayId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/packages/${encodeURIComponent(packageId)}/replays/${encodeURIComponent(replayId)}`, {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(updateCreatorReplayInputSchema.parse(input)),
            });
            return parseJson(response, creatorReplaySummarySchema);
        },
    };
}
export function createMeApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async getSummary() {
            const response = await fetcher(`${config.baseUrl}/v1/me/summary`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, meProfileSummarySchema);
        },
        async listAssets(query = {}) {
            const parsed = listMeAssetsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/me/assets${buildQueryString({
                limit: parsed.limit == null ? undefined : String(parsed.limit),
                kind: parsed.kind,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, meAssetListResponseSchema);
        },
        async getAuthorizationSummary(query = {}) {
            const parsed = listMeAuthorizationsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/me/authorizations${buildQueryString({
                limit: parsed.limit == null ? undefined : String(parsed.limit),
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, meAuthorizationSummarySchema);
        },
        async listFavoriteWorkshops(query = {}) {
            const parsed = listMeFavoriteWorkshopsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/me/favorites/workshops${buildQueryString({
                limit: parsed.limit == null ? undefined : String(parsed.limit),
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, meFavoriteWorkshopListResponseSchema);
        },
        async setFavoriteWorkshop(workshopId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/me/favorites/workshops/${encodeURIComponent(workshopId)}`, {
                method: "PUT",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(setMeFavoriteWorkshopInputSchema.parse(input)),
            });
            return parseJson(response, setMeFavoriteWorkshopResultSchema);
        },
        async listRecentActivities(query = {}) {
            const parsed = listMeRecentActivitiesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/me/recent${buildQueryString({
                limit: parsed.limit == null ? undefined : String(parsed.limit),
                types: parsed.types,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, meRecentActivityListResponseSchema);
        },
        async recordRecentActivity(input) {
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
        async listNotices(query = {}) {
            const parsed = listMeNoticesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/me/notices${buildQueryString({
                limit: parsed.limit == null ? undefined : String(parsed.limit),
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return meNoticeSchema.array().parse(value);
                },
            });
        },
        async getNoticeSummary() {
            const response = await fetcher(`${config.baseUrl}/v1/me/notices/summary`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, meNoticeSummarySchema);
        },
    };
}
export function createNotificationsApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listNotifications(query = {}) {
            const parsed = listNotificationsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/notifications${buildQueryString({
                limit: parsed.limit == null ? undefined : String(parsed.limit),
                type: parsed.type,
                readState: parsed.readState,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return notificationRecordSchema.array().parse(value);
                },
            });
        },
        async getNotificationSummary() {
            const response = await fetcher(`${config.baseUrl}/v1/notifications/summary`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, notificationSummarySchema);
        },
        async markNotificationRead(notificationId) {
            const response = await fetcher(`${config.baseUrl}/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
                method: "POST",
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, notificationRecordSchema);
        },
        async markAllNotificationsRead() {
            const response = await fetcher(`${config.baseUrl}/v1/notifications/read-all`, {
                method: "POST",
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, notificationSummarySchema);
        },
    };
}
export function createBillingApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listEntries(query = {}) {
            const parsed = listBillingEntriesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/billing/entries${buildQueryString({
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
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return billingEntrySchema.array().parse(value);
                },
            });
        },
        async getSummary(query = {}) {
            const parsed = billingLedgerSummaryQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/billing/summary${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                packageId: parsed.packageId,
                serviceId: parsed.serviceId,
                runId: parsed.runId,
                from: parsed.from,
                to: parsed.to,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, billingLedgerSummarySchema);
        },
    };
}
export function createQuotaApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listPolicies(query = {}) {
            const parsed = listQuotaPoliciesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/quotas/policies${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                packageId: parsed.packageId,
                serviceId: parsed.serviceId,
                metric: parsed.metric,
                scopeType: parsed.scopeType,
                status: parsed.status,
                enabled: parsed.enabled === undefined
                    ? undefined
                    : parsed.enabled
                        ? "true"
                        : "false",
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return quotaPolicySchema.array().parse(value);
                },
            });
        },
        async createPolicy(input) {
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
        async updatePolicy(policyId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/quotas/policies/${encodeURIComponent(policyId)}`, {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(updateQuotaPolicyInputSchema.parse(input)),
            });
            return parseJson(response, quotaPolicySchema);
        },
        async listCounters(query = {}) {
            const parsed = listQuotaCountersQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/quotas/counters${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                packageId: parsed.packageId,
                serviceId: parsed.serviceId,
                metric: parsed.metric,
                scopeType: parsed.scopeType,
                runId: parsed.runId,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return quotaCounterSchema.array().parse(value);
                },
            });
        },
        async listEvents(query = {}) {
            const parsed = listQuotaEventsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/quotas/events${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                packageId: parsed.packageId,
                serviceId: parsed.serviceId,
                metric: parsed.metric,
                decision: parsed.decision,
                runId: parsed.runId,
                overrideId: parsed.overrideId,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return quotaEventSchema.array().parse(value);
                },
            });
        },
        async listOverrides(query = {}) {
            const parsed = listQuotaOverridesQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/quotas/overrides${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                packageId: parsed.packageId,
                serviceId: parsed.serviceId,
                metric: parsed.metric,
                status: parsed.status,
                runId: parsed.runId,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return quotaOverrideRecordSchema.array().parse(value);
                },
            });
        },
        async approveOverride(overrideId, input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/quotas/overrides/${encodeURIComponent(overrideId)}/approve`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(decideQuotaOverrideInputSchema.parse(input)),
            });
            return parseJson(response, quotaOverrideRecordSchema);
        },
        async rejectOverride(overrideId, input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/quotas/overrides/${encodeURIComponent(overrideId)}/reject`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(decideQuotaOverrideInputSchema.parse(input)),
            });
            return parseJson(response, quotaOverrideRecordSchema);
        },
    };
}
export function createCredentialsApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listCredentials(query = {}) {
            const parsed = listCredentialsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/credentials${buildQueryString({
                scope: parsed.scope,
                status: parsed.status,
                q: parsed.q,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return credentialSummarySchema.array().parse(value);
                },
            });
        },
        async getCredential(credentialId) {
            const response = await fetcher(`${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, credentialDetailSchema);
        },
        async createCredential(input) {
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
        async updateCredential(credentialId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}`, {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(updateCredentialInputSchema.parse(input)),
            });
            return parseJson(response, credentialDetailSchema);
        },
        async rotateCredential(credentialId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/rotate`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(rotateCredentialInputSchema.parse(input)),
            });
            return parseJson(response, credentialDetailSchema);
        },
        async getCredentialUsage(credentialId) {
            const response = await fetcher(`${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/usages`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, credentialUsageResponseSchema);
        },
        async listCredentialAuditEvents(credentialId, query = {}) {
            const parsed = listCredentialAuditEventsQuerySchema.parse(query);
            const serialized = buildQueryString({
                action: parsed.action,
                outcome: parsed.outcome,
                runId: parsed.runId,
                limit: typeof parsed.limit === "number" ? String(parsed.limit) : undefined,
            });
            const response = await fetcher(`${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/audit-events${serialized}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return credentialAuditEventSchema.array().parse(value);
                },
            });
        },
        async suspendCredential(credentialId, input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/suspend`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(changeCredentialLifecycleInputSchema.parse(input)),
            });
            return parseJson(response, credentialLifecycleChangeResultSchema);
        },
        async revokeCredential(credentialId, input = {}) {
            const response = await fetcher(`${config.baseUrl}/v1/credentials/${encodeURIComponent(credentialId)}/revoke`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(changeCredentialLifecycleInputSchema.parse(input)),
            });
            return parseJson(response, credentialLifecycleChangeResultSchema);
        },
    };
}
export function createMcpGovernanceApiClient(config) {
    const fetcher = config.fetcher ?? fetch;
    return {
        async listMcps(query = {}) {
            const parsed = listMcpsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/mcps${buildQueryString({
                source: parsed.source,
                status: parsed.status,
                q: parsed.q,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return mcpRegistryEntrySchema.array().parse(value);
                },
            });
        },
        async getMcp(mcpId) {
            const response = await fetcher(`${config.baseUrl}/v1/mcps/${encodeURIComponent(mcpId)}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, mcpRegistryEntrySchema);
        },
        async createMcp(input) {
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
        async updateMcp(mcpId, input) {
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
        async listBindings(query = {}) {
            const parsed = listMcpBindingsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/mcp-bindings${buildQueryString({
                scope: parsed.scope,
                status: parsed.status,
                mcpId: parsed.mcpId,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return mcpBindingRecordSchema.array().parse(value);
                },
            });
        },
        async listCalls(query = {}) {
            const parsed = listMcpCallsQuerySchema.parse(query);
            const response = await fetcher(`${config.baseUrl}/v1/mcp-calls${buildQueryString({
                workspaceContextKey: parsed.workspaceContextKey,
                serviceId: parsed.serviceId,
                runId: parsed.runId,
                mcpId: parsed.mcpId,
                toolName: parsed.toolName,
                status: parsed.status,
                from: parsed.from,
                to: parsed.to,
                limit: typeof parsed.limit === "number" ? String(parsed.limit) : undefined,
            })}`, {
                headers: buildAuthHeaders(config.getAccessToken),
            });
            return parseJson(response, {
                parse(value) {
                    return mcpCallRecordSchema.array().parse(value);
                },
            });
        },
        async createBinding(input) {
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
        async updateBinding(bindingId, input) {
            const response = await fetcher(`${config.baseUrl}/v1/mcp-bindings/${encodeURIComponent(bindingId)}`, {
                method: "PATCH",
                headers: {
                    "content-type": "application/json",
                    ...buildAuthHeaders(config.getAccessToken),
                },
                body: JSON.stringify(updateMcpBindingInputSchema.parse(input)),
            });
            return parseJson(response, mcpBindingRecordSchema);
        },
    };
}
export function createRunsRealtimeClient(config) {
    const socketFactory = config.socketFactory ??
        ((url) => {
            if (typeof WebSocket === "undefined") {
                throw new Error("WebSocket is not available in the current runtime.");
            }
            return new WebSocket(url);
        });
    const eventSourceFactory = config.eventSourceFactory ??
        ((url) => {
            if (typeof EventSource === "undefined") {
                throw new Error("EventSource is not available in the current runtime.");
            }
            return new EventSource(url);
        });
    return {
        connect(runId, handlers = {}) {
            const accessToken = config.getAccessToken?.();
            const teardown = [];
            const preferTransport = config.preferTransport ?? "auto";
            const allowSseFallback = preferTransport === "auto";
            let socket = null;
            let eventSource = null;
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
            const sendPayload = (payload) => {
                if (!socket || socket.readyState !== 1) {
                    return;
                }
                socket.send(JSON.stringify(payload));
            };
            const emitTransportOpen = (transport) => {
                handlers.onTransport?.(transport);
                handlers.onOpen?.();
            };
            const forwardRealtimePayload = (raw) => {
                try {
                    handleRealtimeServerMessage(parseRealtimeServerMessage(raw), handlers);
                }
                catch (error) {
                    handlers.onError?.(error instanceof Error ? error.message : "Invalid realtime payload");
                }
            };
            const connectSse = () => {
                try {
                    eventSource = eventSourceFactory(appendAccessToken(`${normalizeBaseUrl(config.baseUrl)}/v1/runs/${encodeURIComponent(runId)}/stream`, accessToken));
                }
                catch (error) {
                    handlers.onError?.(error instanceof Error ? error.message : "Failed to create EventSource connection");
                    return false;
                }
                teardown.push(addRealtimeListener(eventSource, "open", () => {
                    if (closed) {
                        return;
                    }
                    emitTransportOpen("sse");
                }));
                teardown.push(addRealtimeListener(eventSource, "runs.snapshot", (event) => {
                    forwardRealtimePayload(readSocketMessage(event));
                }));
                teardown.push(addRealtimeListener(eventSource, "runs.event", (event) => {
                    forwardRealtimePayload(readSocketMessage(event));
                }));
                teardown.push(addRealtimeListener(eventSource, "error", () => {
                    if (closed) {
                        return;
                    }
                    handlers.onError?.("SSE connection error");
                }));
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
                    socket = socketFactory(appendAccessToken(`${toWebSocketBaseUrl(config.baseUrl)}/ws/runs/${encodeURIComponent(runId)}`, accessToken));
                }
                catch (error) {
                    if (fallbackToSse()) {
                        return;
                    }
                    handlers.onError?.(error instanceof Error ? error.message : "Failed to create WebSocket connection");
                    return;
                }
                teardown.push(addRealtimeListener(socket, "open", () => {
                    if (closed) {
                        return;
                    }
                    wsOpened = true;
                    commandChannelOpen = true;
                    sendPayload(clientRealtimeMessageSchema.parse({
                        type: "runs.subscribe",
                        runId,
                    }));
                    emitTransportOpen("ws");
                }));
                teardown.push(addRealtimeListener(socket, "message", (event) => {
                    forwardRealtimePayload(readSocketMessage(event));
                }));
                teardown.push(addRealtimeListener(socket, "error", () => {
                    if (closed || transportSwitching) {
                        return;
                    }
                    if (!wsOpened && fallbackToSse()) {
                        return;
                    }
                    handlers.onError?.("WebSocket connection error");
                }));
                teardown.push(addRealtimeListener(socket, "close", () => {
                    commandChannelOpen = false;
                    if (closed || transportSwitching) {
                        return;
                    }
                    if (!wsOpened && fallbackToSse()) {
                        return;
                    }
                    handlers.onClose?.();
                }));
            };
            if (preferTransport === "sse") {
                connectSse();
            }
            else {
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
                    sendPayload(clientRealtimeMessageSchema.parse({
                        type: "runs.sendMessage",
                        runId,
                        payload: sendRunMessageInputSchema.parse(input),
                    }));
                },
                approve(input) {
                    sendPayload(clientRealtimeMessageSchema.parse({
                        type: "runs.approve",
                        runId,
                        payload: approveRunInputSchema.parse(input),
                    }));
                },
                cancel(reason) {
                    sendPayload(clientRealtimeMessageSchema.parse({
                        type: "runs.cancel",
                        runId,
                        reason,
                    }));
                },
                isOpen() {
                    return commandChannelOpen && socket?.readyState === 1;
                },
            };
        },
    };
}
export function buildRunDownloadTicketUrl(baseUrl, ticketId) {
    return `${normalizeBaseUrl(baseUrl)}/v1/downloads/${encodeURIComponent(ticketId)}`;
}
//# sourceMappingURL=index.js.map