import { type AuthSessionEnvelope, type AuthSessionResponse, type AcceptWorkspaceInvitationInput, type AcceptWorkspaceInvitationResponse, type ActivateCreatorReleaseInput, type BatchRunCancelInput, type BatchRunDetail, type ImportBatchRunFileInput, type ImportBatchRunFileResponse, type BatchRunItemsResponse, type BatchRunRetryInput, type BatchRunStartInput, type BatchRunBudgetEstimate, type CreateBatchRunInput, type EstimateBatchRunInput, type BillingEntry, type BillingLedgerSummary, type BillingLedgerSummaryQuery, type ChangeCredentialLifecycleInput, type CreateCreatorAuditExportInput, type CredentialDetail, type CredentialAuditEvent, type CredentialLifecycleChangeResult, type CredentialSummary, type CredentialUsageResponse, type CreateCredentialInput, type CreateCreatorReleaseInput, type CreateCreatorReplayInput, type CreateWorkspaceInvitationInput, type CreateWorkspaceInvitationResponse, type CreateMcpBindingInput, type CreateMcpInput, type CreatorGovernanceDynamicSection, type CreatorAuditExportRecord, type CreatorAuditExportResponse, type CreatorGovernanceSectionSummary, type CreatorGovernanceSectionSummaryQuery, type CreatorPackageDetail, type CreatorPackageSummary, type CreatorReleaseActivation, type CreatorReleaseGate, type CreatorReleaseSummary, type CreatorReplaySummary, type DecideCreatorReleaseGateInput, type DecideQuotaOverrideInput, type ListBillingEntriesQuery, type ListMeAssetsQuery, type ListMeAuthorizationsQuery, type ListMeFavoriteWorkshopsQuery, type ListMeRecentActivitiesQuery, type ListSearchHistoryQuery, type ListSearchResultsQuery, type ListSearchSuggestionsQuery, type ListCreatorAuditExportsQuery, type InheritSessionPackInput, type InheritSessionPackResponse, type DownloadSessionPackArchiveQuery, type ImportSessionPackArchiveQuery, type ImportSessionPackArchiveResponse, type PublishSessionPackInput, type PublishSessionPackResponse, type ReviewSessionPackRedactionInput, type ReviewSessionPackRedactionResponse, type RollbackSessionPackInput, type RollbackSessionPackResponse, type UpdateSessionPackRedactionMapInput, type UpdateSessionPackRedactionMapResponse, type UnpublishSessionPackInput, type UnpublishSessionPackResponse, type LoginAuthInput, type ListCredentialsQuery, type ListCredentialAuditEventsQuery, type LogoutAuthInput, type ListMcpCallsQuery, type ListMcpBindingsQuery, type ListMeNoticesQuery, type ListNotificationsQuery, type ListBatchRunItemsQuery, type ListBatchRunsQuery, type ListMcpsQuery, type MeAssetListResponse, type MeAuthorizationSummary, type MeFavoriteWorkshopListResponse, type MeRecentActivityListResponse, type MeRecentActivityRecord, type RecordSearchClickInput, type RecordSearchClickResult, type SearchHistoryListResponse, type SearchResultListResponse, type SearchSuggestionListResponse, type ListSessionPacksQuery, type MeNotice, type MeProfileSummary, type MeNoticeSummary, type NotificationRecord, type NotificationSummary, type McpCallRecord, type McpBindingRecord, type McpRegistryEntry, type QuotaCounter, type QuotaEvent, type QuotaOverrideRecord, type QuotaPolicy, type RefreshAuthInput, type RegisterAuthInput, type RotateCredentialInput, type CreateRunDownloadTicketInput, type CreateRunDownloadTicketResponse, type CreateServiceLaunchTemplateInput, type CreateRunUploadInput, type CreateRunUploadResponse, type FinalizeRunUploadInput, type FinalizeRunUploadResponse, type ListCreatorPackagesQuery, type ListServicesQuery, type ListWorkshopsQuery, type RunUploadRecord, type SessionPackDetail, type SessionPackLineageResponse, type SessionPackSummary, type ServiceCatalogEntry, type ServiceDetail, type ServiceLaunchTemplate, type SwitchWorkspaceInput, type ApproveRunInput, type ReviewRunInformationAnswerInput, type BridgeEvent, type CreateRunInput, type CreateRunResponse, type RunFileEntry, type ListRunFileIndexResponse, type ListRunsQuery, type RunListSummary, type RunFilePreviewResponse, type RunFileReadResponse, type RunFileSource, type RunSnapshot, type RunConversationAttachment, type SendRunMessageInput, type CreateQuotaPolicyInput, type ListQuotaCountersQuery, type ListQuotaEventsQuery, type ListQuotaOverridesQuery, type ListQuotaPoliciesQuery, type UpdateCreatorReleaseInput, type UpdateCreatorReplayInput, type UpdateQuotaPolicyInput, type UpdateCredentialInput, type UpdateMcpBindingInput, type UpdateMcpInput, type RecordMeRecentActivityInput, type UpdateWorkspaceMembershipInput, type WorkshopCatalogEntry, type WorkshopDetail, type WorkspaceInvitationView, type WorkspaceMemberRecord, type WorkspaceProfileSummary, type SetMeFavoriteWorkshopInput, type SetMeFavoriteWorkshopResult } from "@lingban/contracts";
type FetchLike = typeof fetch;
export declare class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly details?: unknown;
    constructor(status: number, message: string, code?: string, details?: unknown);
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
export declare function createSessionRefreshFetch(config: SessionRefreshFetchConfig): FetchLike;
export declare function createRunsApiClient(config: ClientConfig): {
    listRuns(query?: ListRunsQuery): Promise<RunSnapshot[]>;
    getRunsSummary(query?: ListRunsQuery): Promise<RunListSummary>;
    createRun(input: CreateRunInput): Promise<CreateRunResponse>;
    getRun(runId: string): Promise<RunSnapshot>;
    listRunMcpCalls(runId: string, query?: Omit<ListMcpCallsQuery, "runId">): Promise<McpCallRecord[]>;
    listRunFiles(runId: string): Promise<RunFileEntry[]>;
    sendRunMessage(runId: string, input: SendRunMessageInput): Promise<RunSnapshot>;
    listRunFileTree(runId: string): Promise<RunFileEntry[]>;
    listRunIndexedFiles(runId: string, query?: {
        prefix?: string;
        search?: string;
        source?: RunFileSource;
        kind?: RunFileEntry["kind"];
        previewable?: boolean;
        downloadable?: boolean;
        limit?: number;
    }): Promise<ListRunFileIndexResponse>;
    statRunFile(runId: string, filePath?: string): Promise<RunFileEntry>;
    readRunFile(runId: string, filePath?: string): Promise<RunFileReadResponse>;
    previewRunFile(runId: string, filePath?: string): Promise<RunFilePreviewResponse>;
    approveRun(runId: string, input: ApproveRunInput): Promise<RunSnapshot>;
    reviewRunInformationAnswer(runId: string, input: ReviewRunInformationAnswerInput): Promise<RunSnapshot>;
    listRunUploads(runId: string): Promise<RunUploadRecord[]>;
    createRunUpload(runId: string, input: CreateRunUploadInput): Promise<CreateRunUploadResponse>;
    uploadRunUploadContent(runId: string, uploadId: string, content: Uint8Array | ArrayBuffer): Promise<{
        uploadId: string;
        runId: string;
        workspaceId: string;
        fileName: string;
        contentType: string | null;
        declaredSizeBytes: number | null;
        storedSizeBytes: number | null;
        sha256: string | null;
        objectKey: string;
        status: "blocked" | "expired" | "created" | "uploaded" | "attached";
        scanStatus: "pending" | "error" | "blocked" | "clean" | "skipped";
        scanEngine: string | null;
        scanReasonCode: string | null;
        scanDetail: string | null;
        scanSignature: string | null;
        scannedAt: string | null;
        attachedPath: string | null;
        attachedLabel: string | null;
        createdAt: string;
        updatedAt: string;
    }>;
    finalizeRunUpload(runId: string, uploadId: string, input?: FinalizeRunUploadInput): Promise<FinalizeRunUploadResponse>;
    createRunDownloadTicket(runId: string, input: CreateRunDownloadTicketInput): Promise<CreateRunDownloadTicketResponse>;
    cancelRun(runId: string, reason?: string): Promise<RunSnapshot>;
};
export type RunsApiClient = ReturnType<typeof createRunsApiClient>;
export declare function createBatchRunsApiClient(config: ClientConfig): {
    listBatchRuns(query?: ListBatchRunsQuery): Promise<BatchRunDetail[]>;
    createBatchRun(input: CreateBatchRunInput): Promise<BatchRunDetail>;
    estimateBatchRun(input: EstimateBatchRunInput): Promise<BatchRunBudgetEstimate>;
    importBatchRunFile(input: ImportBatchRunFileInput): Promise<ImportBatchRunFileResponse>;
    getBatchRun(batchJobId: string): Promise<BatchRunDetail>;
    listBatchItems(batchJobId: string, query?: ListBatchRunItemsQuery): Promise<BatchRunItemsResponse>;
    validateBatchRun(batchJobId: string): Promise<BatchRunDetail>;
    startBatchRun(batchJobId: string, input?: BatchRunStartInput): Promise<BatchRunDetail>;
    retryBatchRun(batchJobId: string, input?: BatchRunRetryInput): Promise<BatchRunDetail>;
    cancelBatchRun(batchJobId: string, input?: BatchRunCancelInput): Promise<BatchRunDetail>;
};
export type BatchRunsApiClient = ReturnType<typeof createBatchRunsApiClient>;
export declare function resolveApiUrl(baseUrl: string, url: string): string;
export type UploadRunAttachmentInput = {
    fileName: string;
    contentType?: string | null;
    sizeBytes?: number | null;
    content: Uint8Array | ArrayBuffer;
    label?: string;
};
export declare function uploadRunAttachment(client: Pick<RunsApiClient, "createRunUpload" | "uploadRunUploadContent" | "finalizeRunUpload">, runId: string, input: UploadRunAttachmentInput): Promise<RunConversationAttachment>;
export declare function getRunFileDownloadUrl(client: Pick<RunsApiClient, "createRunDownloadTicket">, baseUrl: string, runId: string, filePath: string): Promise<string>;
export declare function createAuthApiClient(config: ClientConfig): {
    register(input: RegisterAuthInput): Promise<AuthSessionResponse>;
    login(input: LoginAuthInput): Promise<AuthSessionResponse>;
    refresh(input: RefreshAuthInput): Promise<AuthSessionResponse>;
    logout(input?: LogoutAuthInput): Promise<{
        ok: boolean;
    }>;
    getSession(): Promise<AuthSessionEnvelope>;
    listWorkspaces(): Promise<{
        workspaceId: string;
        slug: string;
        name: string;
        type: "enterprise" | "personal" | "team";
        createdAt: string;
        updatedAt: string;
        contextKey: string;
        root: string;
        role: "owner" | "admin" | "operator" | "creator" | "viewer";
        membershipStatus: "active" | "suspended";
    }[]>;
    getWorkspaceSummary(workspaceId: string): Promise<WorkspaceProfileSummary>;
    listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberRecord[]>;
    updateWorkspaceMember(workspaceId: string, userId: string, input: UpdateWorkspaceMembershipInput): Promise<WorkspaceMemberRecord>;
    listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitationView[]>;
    createWorkspaceInvitation(workspaceId: string, input: CreateWorkspaceInvitationInput): Promise<CreateWorkspaceInvitationResponse>;
    revokeWorkspaceInvitation(workspaceId: string, invitationId: string): Promise<WorkspaceInvitationView>;
    listMyInvitations(): Promise<WorkspaceInvitationView[]>;
    acceptWorkspaceInvitation(invitationId: string, input: AcceptWorkspaceInvitationInput): Promise<AcceptWorkspaceInvitationResponse>;
    switchWorkspace(input: SwitchWorkspaceInput): Promise<AuthSessionResponse>;
};
export declare function createWorkshopCatalogApiClient(config: ClientConfig): {
    listWorkshops(query?: ListWorkshopsQuery): Promise<WorkshopCatalogEntry[]>;
    getWorkshop(workshopId: string, query?: ListWorkshopsQuery): Promise<WorkshopDetail>;
    listWorkshopServices(workshopId: string, query?: ListServicesQuery): Promise<ServiceCatalogEntry[]>;
    listServices(query?: ListServicesQuery): Promise<ServiceCatalogEntry[]>;
    getService(serviceId: string, query?: ListServicesQuery): Promise<ServiceDetail>;
    createLaunchTemplate(serviceId: string, input: CreateServiceLaunchTemplateInput): Promise<ServiceLaunchTemplate>;
};
export declare function createSessionsApiClient(config: ClientConfig): {
    listSessionPacks(query?: ListSessionPacksQuery): Promise<SessionPackSummary[]>;
    getSessionPack(sessionVersionId: string): Promise<SessionPackDetail>;
    getSessionPackLineage(sessionVersionId: string): Promise<SessionPackLineageResponse>;
    importSessionPackArchive(archive: Uint8Array | ArrayBuffer, query?: ImportSessionPackArchiveQuery): Promise<ImportSessionPackArchiveResponse>;
    inheritSessionPack(sessionVersionId: string, input?: InheritSessionPackInput): Promise<InheritSessionPackResponse>;
    publishSessionPack(sessionVersionId: string, input: PublishSessionPackInput): Promise<PublishSessionPackResponse>;
    rollbackSessionPack(sessionVersionId: string, input: RollbackSessionPackInput): Promise<RollbackSessionPackResponse>;
    unpublishSessionPack(sessionVersionId: string, input: UnpublishSessionPackInput): Promise<UnpublishSessionPackResponse>;
    updateSessionPackRedactionMap(sessionVersionId: string, input: UpdateSessionPackRedactionMapInput): Promise<UpdateSessionPackRedactionMapResponse>;
    reviewSessionPackRedaction(sessionVersionId: string, input: ReviewSessionPackRedactionInput): Promise<ReviewSessionPackRedactionResponse>;
    downloadSessionPackArchive(sessionVersionId: string, query?: DownloadSessionPackArchiveQuery): Promise<{
        content: Uint8Array;
        contentType: string | null;
        fileName: string | null;
        redacted: boolean;
    }>;
};
export declare function createSearchApiClient(config: ClientConfig): {
    listSearchHistory(query?: ListSearchHistoryQuery): Promise<SearchHistoryListResponse>;
    listSearchResults(query: ListSearchResultsQuery): Promise<SearchResultListResponse>;
    listSearchSuggestions(query: ListSearchSuggestionsQuery): Promise<SearchSuggestionListResponse>;
    recordSearchClick(input: RecordSearchClickInput): Promise<RecordSearchClickResult>;
};
export declare function createCreatorApiClient(config: ClientConfig): {
    listPackages(query?: ListCreatorPackagesQuery): Promise<CreatorPackageSummary[]>;
    getPackage(packageId: string): Promise<CreatorPackageDetail>;
    getGovernanceSectionSummary(packageId: string, section: CreatorGovernanceDynamicSection, query?: CreatorGovernanceSectionSummaryQuery): Promise<CreatorGovernanceSectionSummary>;
    listAuditExports(packageId: string, query?: ListCreatorAuditExportsQuery): Promise<CreatorAuditExportRecord[]>;
    createAuditExport(packageId: string, input: CreateCreatorAuditExportInput): Promise<CreatorAuditExportResponse>;
    downloadAuditExport(packageId: string, exportId: string): Promise<{
        fileName: string;
        contentType: string | null;
        blob: Blob;
    }>;
    listPackageReleases(packageId: string): Promise<CreatorReleaseSummary[]>;
    createPackageRelease(packageId: string, input: CreateCreatorReleaseInput): Promise<CreatorReleaseSummary>;
    listReleaseGates(releaseId: string): Promise<CreatorReleaseGate[]>;
    decideReleaseGate(releaseId: string, gateId: string, input: DecideCreatorReleaseGateInput): Promise<CreatorReleaseGate>;
    updatePackageRelease(packageId: string, releaseId: string, input: UpdateCreatorReleaseInput): Promise<CreatorReleaseSummary>;
    listPackageReplays(packageId: string): Promise<CreatorReplaySummary[]>;
    createPackageReplay(packageId: string, input: CreateCreatorReplayInput): Promise<CreatorReplaySummary>;
    listReleaseActivations(releaseId: string): Promise<CreatorReleaseActivation[]>;
    activateRelease(releaseId: string, input?: ActivateCreatorReleaseInput): Promise<CreatorReleaseActivation>;
    updatePackageReplay(packageId: string, replayId: string, input: UpdateCreatorReplayInput): Promise<CreatorReplaySummary>;
};
export declare function createMeApiClient(config: ClientConfig): {
    getSummary(): Promise<MeProfileSummary>;
    listAssets(query?: ListMeAssetsQuery): Promise<MeAssetListResponse>;
    getAuthorizationSummary(query?: ListMeAuthorizationsQuery): Promise<MeAuthorizationSummary>;
    listFavoriteWorkshops(query?: ListMeFavoriteWorkshopsQuery): Promise<MeFavoriteWorkshopListResponse>;
    setFavoriteWorkshop(workshopId: string, input: SetMeFavoriteWorkshopInput): Promise<SetMeFavoriteWorkshopResult>;
    listRecentActivities(query?: ListMeRecentActivitiesQuery): Promise<MeRecentActivityListResponse>;
    recordRecentActivity(input: RecordMeRecentActivityInput): Promise<MeRecentActivityRecord>;
    listNotices(query?: ListMeNoticesQuery): Promise<MeNotice[]>;
    getNoticeSummary(): Promise<MeNoticeSummary>;
};
export type MeApiClient = ReturnType<typeof createMeApiClient>;
export declare function createNotificationsApiClient(config: ClientConfig): {
    listNotifications(query?: ListNotificationsQuery): Promise<NotificationRecord[]>;
    getNotificationSummary(): Promise<NotificationSummary>;
    markNotificationRead(notificationId: string): Promise<NotificationRecord>;
    markAllNotificationsRead(): Promise<NotificationSummary>;
};
export type NotificationsApiClient = ReturnType<typeof createNotificationsApiClient>;
export type SearchApiClient = ReturnType<typeof createSearchApiClient>;
export type CreatorApiClient = ReturnType<typeof createCreatorApiClient>;
export declare function createBillingApiClient(config: ClientConfig): {
    listEntries(query?: ListBillingEntriesQuery): Promise<BillingEntry[]>;
    getSummary(query?: BillingLedgerSummaryQuery): Promise<BillingLedgerSummary>;
};
export type BillingApiClient = ReturnType<typeof createBillingApiClient>;
export declare function createQuotaApiClient(config: ClientConfig): {
    listPolicies(query?: ListQuotaPoliciesQuery): Promise<QuotaPolicy[]>;
    createPolicy(input: CreateQuotaPolicyInput): Promise<QuotaPolicy>;
    updatePolicy(policyId: string, input: UpdateQuotaPolicyInput): Promise<QuotaPolicy>;
    listCounters(query?: ListQuotaCountersQuery): Promise<QuotaCounter[]>;
    listEvents(query?: ListQuotaEventsQuery): Promise<QuotaEvent[]>;
    listOverrides(query?: ListQuotaOverridesQuery): Promise<QuotaOverrideRecord[]>;
    approveOverride(overrideId: string, input?: DecideQuotaOverrideInput): Promise<QuotaOverrideRecord>;
    rejectOverride(overrideId: string, input?: DecideQuotaOverrideInput): Promise<QuotaOverrideRecord>;
};
export type QuotaApiClient = ReturnType<typeof createQuotaApiClient>;
export declare function createCredentialsApiClient(config: ClientConfig): {
    listCredentials(query?: ListCredentialsQuery): Promise<CredentialSummary[]>;
    getCredential(credentialId: string): Promise<CredentialDetail>;
    createCredential(input: CreateCredentialInput): Promise<CredentialDetail>;
    updateCredential(credentialId: string, input: UpdateCredentialInput): Promise<CredentialDetail>;
    rotateCredential(credentialId: string, input: RotateCredentialInput): Promise<CredentialDetail>;
    getCredentialUsage(credentialId: string): Promise<CredentialUsageResponse>;
    listCredentialAuditEvents(credentialId: string, query?: ListCredentialAuditEventsQuery): Promise<CredentialAuditEvent[]>;
    suspendCredential(credentialId: string, input?: ChangeCredentialLifecycleInput): Promise<CredentialLifecycleChangeResult>;
    revokeCredential(credentialId: string, input?: ChangeCredentialLifecycleInput): Promise<CredentialLifecycleChangeResult>;
};
export type CredentialsApiClient = ReturnType<typeof createCredentialsApiClient>;
export declare function createMcpGovernanceApiClient(config: ClientConfig): {
    listMcps(query?: ListMcpsQuery): Promise<McpRegistryEntry[]>;
    getMcp(mcpId: string): Promise<McpRegistryEntry>;
    createMcp(input: CreateMcpInput): Promise<McpRegistryEntry>;
    updateMcp(mcpId: string, input: UpdateMcpInput): Promise<McpRegistryEntry>;
    listBindings(query?: ListMcpBindingsQuery): Promise<McpBindingRecord[]>;
    listCalls(query?: ListMcpCallsQuery): Promise<McpCallRecord[]>;
    createBinding(input: CreateMcpBindingInput): Promise<McpBindingRecord>;
    updateBinding(bindingId: string, input: UpdateMcpBindingInput): Promise<McpBindingRecord>;
};
export type McpGovernanceApiClient = ReturnType<typeof createMcpGovernanceApiClient>;
export declare function createRunsRealtimeClient(config: RunsRealtimeClientConfig): {
    connect(runId: string, handlers?: RunRealtimeHandlers): RunRealtimeConnection;
};
export declare function buildRunDownloadTicketUrl(baseUrl: string, ticketId: string): string;
export {};
//# sourceMappingURL=index.d.ts.map