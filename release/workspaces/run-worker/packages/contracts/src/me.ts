import { z } from "zod";
import { authUserSchema, workspaceProfileMetricsSchema, workspaceSummarySchema } from "./auth.js";
import {
  localizedTextSchema,
  serviceIdSchema,
  workshopIdSchema,
  workspaceContextKeySchema,
} from "./catalog.js";
import {
  entrySurfaceSchema,
  fileKindSchema,
  isoDatetimeSchema,
  runIdSchema,
  workspaceIdSchema,
} from "./common.js";
import { notificationTargetSchema } from "./notifications.js";
import { runFilePreviewModeSchema } from "./runs.js";

export const meNoticeToneSchema = z.enum(["active", "warn", "success", "danger"]);
export const meNoticeTypeSchema = z.enum([
  "approval_pending",
  "result_ready",
  "run_failed",
  "run_succeeded",
]);

export const meNoticeRunTargetViewSchema = z.enum(["detail", "audit", "files"]);
export const meNoticeTargetSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("run"),
    runId: runIdSchema,
    view: meNoticeRunTargetViewSchema,
  }),
  z.object({
    resource: z.literal("workspace"),
    workspaceId: workspaceIdSchema,
    view: z.literal("me"),
  }),
]);

export const meNoticeSchema = z.object({
  noticeId: z.string().trim().min(1).max(200),
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  type: meNoticeTypeSchema,
  tone: meNoticeToneSchema,
  title: localizedTextSchema,
  summary: localizedTextSchema,
  occurredAt: isoDatetimeSchema,
  target: meNoticeTargetSchema,
});

export const listMeNoticesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const meNoticeSummaryBucketSchema = z.object({
  type: meNoticeTypeSchema,
  count: z.number().int().nonnegative(),
});

export const meNoticeSummarySchema = z.object({
  totalCount: z.number().int().nonnegative(),
  latestOccurredAt: isoDatetimeSchema.nullable(),
  byType: z.array(meNoticeSummaryBucketSchema),
});

export const meProfileMetricsSchema = z.object({
  totalAssetsCount: z.number().int().nonnegative(),
  receiptAssetsCount: z.number().int().nonnegative(),
  visibleWorkshopsCount: z.number().int().nonnegative(),
  favoriteWorkshopsCount: z.number().int().nonnegative(),
  pendingActionsCount: z.number().int().nonnegative(),
});

export const meProfileSummarySchema = z.object({
  user: authUserSchema,
  currentWorkspace: workspaceSummarySchema,
  metrics: workspaceProfileMetricsSchema,
  profileMetrics: meProfileMetricsSchema,
  updatedAt: isoDatetimeSchema,
});

export const meAssetKindSchema = z.enum([
  "general_file",
  "receipt",
  "result_bundle",
  "archive_record",
  "evidence",
]);

export const meAssetRecordSchema = z.object({
  assetId: z.string().trim().min(1).max(240),
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  runId: runIdSchema,
  runTitle: localizedTextSchema,
  title: z.string().min(1),
  filePath: z.string().min(1),
  fileKind: fileKindSchema,
  assetKind: meAssetKindSchema,
  previewMode: runFilePreviewModeSchema,
  previewAvailable: z.boolean(),
  downloadable: z.boolean(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  updatedAt: isoDatetimeSchema,
  sourceSummary: localizedTextSchema,
  target: notificationTargetSchema,
});

export const listMeAssetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  kind: meAssetKindSchema.optional(),
});

export const meAssetSummaryBucketSchema = z.object({
  kind: meAssetKindSchema,
  count: z.number().int().nonnegative(),
});

export const meAssetListResponseSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  updatedAt: isoDatetimeSchema.nullable(),
  byKind: z.array(meAssetSummaryBucketSchema),
  items: z.array(meAssetRecordSchema),
});

export const meFavoriteTargetSchema = z.object({
  resource: z.literal("workshop"),
  workshopId: workshopIdSchema,
  view: z.literal("detail"),
});

export const meFavoriteWorkshopRecordSchema = z.object({
  favoriteId: z.string().trim().min(1).max(240),
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  workshopId: workshopIdSchema,
  title: localizedTextSchema,
  ownerLabel: localizedTextSchema,
  badge: localizedTextSchema,
  summary: localizedTextSchema,
  coverAssetUrl: z.string().min(1),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  target: meFavoriteTargetSchema,
});

export const listMeFavoriteWorkshopsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const meFavoriteWorkshopListResponseSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  updatedAt: isoDatetimeSchema.nullable(),
  items: z.array(meFavoriteWorkshopRecordSchema),
});

export const setMeFavoriteWorkshopInputSchema = z.object({
  favorited: z.boolean(),
});

export const setMeFavoriteWorkshopResultSchema = z.object({
  favorited: z.boolean(),
  favorite: meFavoriteWorkshopRecordSchema.nullable(),
});

const meRecentQueryTypesSchema = z.preprocess((value) => {
  if (value == null) {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const normalized = rawValues.flatMap((item) =>
    typeof item === "string"
      ? item
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : []
  );

  return normalized.length > 0 ? normalized : undefined;
}, z.array(z.string().trim().min(1)).min(1).max(3).optional());

export const meRecentResourceTypeSchema = z.enum(["workshop", "service", "run"]);
export const meRecentInteractionSchema = z.enum(["open", "launch", "resume"]);
export const meRecentToneSchema = z.enum(["active", "warn", "success", "danger"]);

export const meRecentTargetSchema = z.discriminatedUnion("resource", [
  z.object({
    resource: z.literal("workshop"),
    workshopId: workshopIdSchema,
    view: z.literal("detail"),
  }),
  z.object({
    resource: z.literal("service"),
    serviceId: serviceIdSchema,
    view: z.literal("detail"),
  }),
  z.object({
    resource: z.literal("run"),
    runId: runIdSchema,
    view: z.enum(["detail", "files"]),
  }),
]);

export const meRecentActivityRecordSchema = z.object({
  activityId: z.string().trim().min(1).max(240),
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  resourceType: meRecentResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  interaction: meRecentInteractionSchema,
  sourceSurface: entrySurfaceSchema,
  title: localizedTextSchema,
  summary: localizedTextSchema,
  badge: localizedTextSchema.nullable(),
  tone: meRecentToneSchema,
  workshopId: workshopIdSchema.nullable(),
  serviceId: serviceIdSchema.nullable(),
  runId: runIdSchema.nullable(),
  lastAccessedAt: isoDatetimeSchema,
  target: meRecentTargetSchema,
});

export const listMeRecentActivitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
  types: meRecentQueryTypesSchema.pipe(z.array(meRecentResourceTypeSchema).min(1).max(3).optional()),
});

export const meRecentActivityListResponseSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  updatedAt: isoDatetimeSchema.nullable(),
  items: z.array(meRecentActivityRecordSchema),
});

export const recordMeRecentActivityInputSchema = z.discriminatedUnion("resourceType", [
  z.object({
    resourceType: z.literal("workshop"),
    workshopId: workshopIdSchema,
    interaction: meRecentInteractionSchema,
    sourceSurface: entrySurfaceSchema,
  }),
  z.object({
    resourceType: z.literal("service"),
    serviceId: serviceIdSchema,
    interaction: meRecentInteractionSchema,
    sourceSurface: entrySurfaceSchema,
  }),
  z.object({
    resourceType: z.literal("run"),
    runId: runIdSchema,
    interaction: meRecentInteractionSchema,
    sourceSurface: entrySurfaceSchema,
  }),
]);

export const meAuthorizationCategorySchema = z.enum([
  "account",
  "workspace",
  "credential",
  "mcp",
  "quota",
  "billing",
]);

export const meAuthorizationToneSchema = z.enum([
  "active",
  "warn",
  "success",
  "danger",
]);

export const meAuthorizationRecordSchema = z.object({
  authorizationId: z.string().trim().min(1).max(240),
  category: meAuthorizationCategorySchema,
  provider: z.string().min(1).max(160).nullable(),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  statusLabel: localizedTextSchema,
  tone: meAuthorizationToneSchema,
  updatedAt: isoDatetimeSchema.nullable(),
});

export const listMeAuthorizationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const meAuthorizationSummarySchema = z.object({
  totalCount: z.number().int().nonnegative(),
  attentionCount: z.number().int().nonnegative(),
  updatedAt: isoDatetimeSchema.nullable(),
  entries: z.array(meAuthorizationRecordSchema),
});

export type MeNoticeTone = z.infer<typeof meNoticeToneSchema>;
export type MeNoticeType = z.infer<typeof meNoticeTypeSchema>;
export type MeNoticeRunTargetView = z.infer<typeof meNoticeRunTargetViewSchema>;
export type MeNoticeTarget = z.infer<typeof meNoticeTargetSchema>;
export type MeNotice = z.infer<typeof meNoticeSchema>;
export type ListMeNoticesQuery = z.infer<typeof listMeNoticesQuerySchema>;
export type MeNoticeSummaryBucket = z.infer<typeof meNoticeSummaryBucketSchema>;
export type MeNoticeSummary = z.infer<typeof meNoticeSummarySchema>;
export type MeProfileMetrics = z.infer<typeof meProfileMetricsSchema>;
export type MeProfileSummary = z.infer<typeof meProfileSummarySchema>;
export type MeAssetKind = z.infer<typeof meAssetKindSchema>;
export type MeAssetRecord = z.infer<typeof meAssetRecordSchema>;
export type ListMeAssetsQuery = z.infer<typeof listMeAssetsQuerySchema>;
export type MeAssetSummaryBucket = z.infer<typeof meAssetSummaryBucketSchema>;
export type MeAssetListResponse = z.infer<typeof meAssetListResponseSchema>;
export type MeFavoriteTarget = z.infer<typeof meFavoriteTargetSchema>;
export type MeFavoriteWorkshopRecord = z.infer<typeof meFavoriteWorkshopRecordSchema>;
export type ListMeFavoriteWorkshopsQuery = z.infer<typeof listMeFavoriteWorkshopsQuerySchema>;
export type MeFavoriteWorkshopListResponse = z.infer<typeof meFavoriteWorkshopListResponseSchema>;
export type SetMeFavoriteWorkshopInput = z.infer<typeof setMeFavoriteWorkshopInputSchema>;
export type SetMeFavoriteWorkshopResult = z.infer<typeof setMeFavoriteWorkshopResultSchema>;
export type MeRecentResourceType = z.infer<typeof meRecentResourceTypeSchema>;
export type MeRecentInteraction = z.infer<typeof meRecentInteractionSchema>;
export type MeRecentTone = z.infer<typeof meRecentToneSchema>;
export type MeRecentTarget = z.infer<typeof meRecentTargetSchema>;
export type MeRecentActivityRecord = z.infer<typeof meRecentActivityRecordSchema>;
export type ListMeRecentActivitiesQuery = z.infer<typeof listMeRecentActivitiesQuerySchema>;
export type MeRecentActivityListResponse = z.infer<typeof meRecentActivityListResponseSchema>;
export type RecordMeRecentActivityInput = z.infer<typeof recordMeRecentActivityInputSchema>;
export type MeAuthorizationCategory = z.infer<typeof meAuthorizationCategorySchema>;
export type MeAuthorizationTone = z.infer<typeof meAuthorizationToneSchema>;
export type MeAuthorizationRecord = z.infer<typeof meAuthorizationRecordSchema>;
export type ListMeAuthorizationsQuery = z.infer<typeof listMeAuthorizationsQuerySchema>;
export type MeAuthorizationSummary = z.infer<typeof meAuthorizationSummarySchema>;
