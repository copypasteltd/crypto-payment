import { z } from "zod";
import { workspaceRoleSchema } from "./auth.js";
import { localizedTextSchema, serviceIdSchema, workspaceContextKeySchema } from "./catalog.js";
import { approvalIdSchema, entrySurfaceSchema, isoDatetimeSchema, runIdSchema, sessionVersionIdSchema, taskVersionIdSchema, userIdSchema, workspaceIdSchema, } from "./common.js";
const quotaKeySchema = z.string().trim().min(1).max(160);
const creatorPackageIdSchema = z.string().trim().min(1).max(120);
export const quotaScopeTypeSchema = z.enum([
    "user",
    "workspace",
    "workspace-context",
    "service",
    "task-version",
    "session-version",
    "package",
    "entry-surface",
]);
export const quotaMetricSchema = z.enum([
    "active_runs",
    "daily_runs",
    "browser_minutes",
    "model_tokens",
    "image_credits",
    "mcp_calls",
    "storage_bytes",
    "download_bytes",
    "audit_exports",
    "replays",
    "ws_connections",
]);
export const quotaWindowTypeSchema = z.enum(["instant", "daily", "monthly"]);
export const quotaPolicyStatusSchema = z.enum([
    "draft",
    "active",
    "paused",
    "replaced",
    "archived",
]);
export const quotaSoftActionSchema = z.enum(["warn", "require_approval"]);
export const quotaHardActionSchema = z.enum(["block", "require_override"]);
export const quotaEventDecisionSchema = z.enum([
    "healthy",
    "warned",
    "blocked",
    "approval_pending",
    "approved_override",
    "rejected_override",
]);
export const quotaOverrideStatusSchema = z.enum([
    "pending",
    "approved",
    "rejected",
    "expired",
]);
export const quotaDecisionKindSchema = z.enum([
    "allow",
    "warn",
    "require_approval",
    "block",
]);
export const quotaPolicyIdSchema = quotaKeySchema;
export const quotaCounterIdSchema = quotaKeySchema;
export const quotaEventIdSchema = quotaKeySchema;
export const quotaOverrideIdSchema = quotaKeySchema;
const quotaBaseMetadataShape = {
    workspaceContextKey: workspaceContextKeySchema.nullable().default(null),
    packageId: creatorPackageIdSchema.nullable().default(null),
    serviceId: serviceIdSchema.nullable().default(null),
    taskVersionId: taskVersionIdSchema.nullable().default(null),
    sessionVersionId: sessionVersionIdSchema.nullable().default(null),
    entrySurface: entrySurfaceSchema.nullable().default(null),
};
export const quotaPolicySchema = z.object({
    policyId: quotaPolicyIdSchema,
    workspaceId: workspaceIdSchema,
    scopeType: quotaScopeTypeSchema,
    scopeRefId: quotaKeySchema,
    metric: quotaMetricSchema,
    windowType: quotaWindowTypeSchema,
    limitValue: z.number().nonnegative(),
    softLimitValue: z.number().nonnegative().nullable().default(null),
    hardLimitValue: z.number().nonnegative().nullable().default(null),
    actionOnSoftLimit: quotaSoftActionSchema,
    actionOnHardLimit: quotaHardActionSchema,
    status: quotaPolicyStatusSchema,
    enabled: z.boolean().default(true),
    priority: z.number().int().default(100),
    summary: localizedTextSchema.nullable().default(null),
    notes: z.string().trim().min(1).max(2000).nullable().default(null),
    ...quotaBaseMetadataShape,
    createdByUserId: userIdSchema.nullable().default(null),
    updatedByUserId: userIdSchema.nullable().default(null),
    createdAt: isoDatetimeSchema,
    updatedAt: isoDatetimeSchema,
});
export const quotaCounterSchema = z.object({
    counterId: quotaCounterIdSchema,
    policyId: quotaPolicyIdSchema,
    workspaceId: workspaceIdSchema,
    scopeType: quotaScopeTypeSchema,
    scopeRefId: quotaKeySchema,
    metric: quotaMetricSchema,
    windowType: quotaWindowTypeSchema,
    windowStartedAt: isoDatetimeSchema,
    windowEndsAt: isoDatetimeSchema,
    currentValue: z.number().nonnegative(),
    ...quotaBaseMetadataShape,
    updatedAt: isoDatetimeSchema,
});
export const quotaEventSchema = z.object({
    eventId: quotaEventIdSchema,
    policyId: quotaPolicyIdSchema,
    workspaceId: workspaceIdSchema,
    scopeType: quotaScopeTypeSchema,
    scopeRefId: quotaKeySchema,
    metric: quotaMetricSchema,
    decision: quotaEventDecisionSchema,
    currentValue: z.number().nonnegative(),
    limitValue: z.number().nonnegative(),
    runId: runIdSchema.nullable().default(null),
    approvalId: approvalIdSchema.nullable().default(null),
    overrideId: quotaOverrideIdSchema.nullable().default(null),
    note: z.string().trim().min(1).max(2000).nullable().default(null),
    ...quotaBaseMetadataShape,
    occurredAt: isoDatetimeSchema,
});
export const quotaOverrideRecordSchema = z.object({
    overrideId: quotaOverrideIdSchema,
    policyId: quotaPolicyIdSchema,
    workspaceId: workspaceIdSchema,
    scopeType: quotaScopeTypeSchema,
    scopeRefId: quotaKeySchema,
    metric: quotaMetricSchema,
    status: quotaOverrideStatusSchema,
    requiredRole: workspaceRoleSchema,
    currentValue: z.number().nonnegative(),
    limitValue: z.number().nonnegative(),
    requestedDelta: z.number().nonnegative(),
    reasonSummary: localizedTextSchema,
    runId: runIdSchema.nullable().default(null),
    approvalId: approvalIdSchema.nullable().default(null),
    ...quotaBaseMetadataShape,
    requestedByUserId: userIdSchema.nullable().default(null),
    requestedAt: isoDatetimeSchema,
    decidedByUserId: userIdSchema.nullable().default(null),
    decidedAt: isoDatetimeSchema.nullable().default(null),
    decisionNote: z.string().trim().min(1).max(2000).nullable().default(null),
    updatedAt: isoDatetimeSchema,
});
export const quotaDecisionPreviewSchema = z.object({
    decision: quotaDecisionKindSchema,
    policyId: quotaPolicyIdSchema.nullable().default(null),
    metric: quotaMetricSchema.nullable().default(null),
    currentValue: z.number().nonnegative().nullable().default(null),
    limitValue: z.number().nonnegative().nullable().default(null),
    summary: localizedTextSchema.nullable().default(null),
    overrideId: quotaOverrideIdSchema.nullable().default(null),
});
export const listQuotaPoliciesQuerySchema = z.object({
    workspaceContextKey: workspaceContextKeySchema.optional(),
    packageId: creatorPackageIdSchema.optional(),
    serviceId: serviceIdSchema.optional(),
    metric: quotaMetricSchema.optional(),
    scopeType: quotaScopeTypeSchema.optional(),
    status: quotaPolicyStatusSchema.optional(),
    enabled: z.boolean().optional(),
});
export const createQuotaPolicyInputSchema = z.object({
    scopeType: quotaScopeTypeSchema,
    scopeRefId: quotaKeySchema,
    metric: quotaMetricSchema,
    windowType: quotaWindowTypeSchema,
    limitValue: z.number().nonnegative(),
    softLimitValue: z.number().nonnegative().nullable().default(null),
    hardLimitValue: z.number().nonnegative().nullable().default(null),
    actionOnSoftLimit: quotaSoftActionSchema.default("warn"),
    actionOnHardLimit: quotaHardActionSchema.default("block"),
    status: quotaPolicyStatusSchema.default("active"),
    enabled: z.boolean().default(true),
    priority: z.number().int().default(100),
    summary: localizedTextSchema.nullable().default(null),
    notes: z.string().trim().min(1).max(2000).nullable().default(null),
    ...quotaBaseMetadataShape,
});
export const updateQuotaPolicyInputSchema = z
    .object({
    scopeType: quotaScopeTypeSchema.optional(),
    scopeRefId: quotaKeySchema.optional(),
    metric: quotaMetricSchema.optional(),
    windowType: quotaWindowTypeSchema.optional(),
    limitValue: z.number().nonnegative().optional(),
    softLimitValue: z.number().nonnegative().nullable().optional(),
    hardLimitValue: z.number().nonnegative().nullable().optional(),
    actionOnSoftLimit: quotaSoftActionSchema.optional(),
    actionOnHardLimit: quotaHardActionSchema.optional(),
    status: quotaPolicyStatusSchema.optional(),
    enabled: z.boolean().optional(),
    priority: z.number().int().optional(),
    summary: localizedTextSchema.nullable().optional(),
    notes: z.string().trim().min(1).max(2000).nullable().optional(),
    workspaceContextKey: workspaceContextKeySchema.nullable().optional(),
    packageId: creatorPackageIdSchema.nullable().optional(),
    serviceId: serviceIdSchema.nullable().optional(),
    taskVersionId: taskVersionIdSchema.nullable().optional(),
    sessionVersionId: sessionVersionIdSchema.nullable().optional(),
    entrySurface: entrySurfaceSchema.nullable().optional(),
})
    .refine((value) => Object.values(value).some((item) => item !== undefined), "At least one quota policy field must be updated");
export const listQuotaCountersQuerySchema = z.object({
    workspaceContextKey: workspaceContextKeySchema.optional(),
    packageId: creatorPackageIdSchema.optional(),
    serviceId: serviceIdSchema.optional(),
    metric: quotaMetricSchema.optional(),
    scopeType: quotaScopeTypeSchema.optional(),
    runId: runIdSchema.optional(),
});
export const listQuotaEventsQuerySchema = z.object({
    workspaceContextKey: workspaceContextKeySchema.optional(),
    packageId: creatorPackageIdSchema.optional(),
    serviceId: serviceIdSchema.optional(),
    metric: quotaMetricSchema.optional(),
    decision: quotaEventDecisionSchema.optional(),
    runId: runIdSchema.optional(),
    overrideId: quotaOverrideIdSchema.optional(),
});
export const listQuotaOverridesQuerySchema = z.object({
    workspaceContextKey: workspaceContextKeySchema.optional(),
    packageId: creatorPackageIdSchema.optional(),
    serviceId: serviceIdSchema.optional(),
    metric: quotaMetricSchema.optional(),
    status: quotaOverrideStatusSchema.optional(),
    runId: runIdSchema.optional(),
});
export const decideQuotaOverrideInputSchema = z.object({
    note: z.string().trim().max(2000).optional(),
});
//# sourceMappingURL=quota.js.map