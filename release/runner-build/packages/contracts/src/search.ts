import { z } from "./zod.js";
import { creatorPackageIdSchema } from "./creator.js";
import {
  localizedTextSchema,
  serviceIdSchema,
  workshopIdSchema,
  workspaceContextKeySchema,
} from "./catalog.js";
import {
  entrySurfaceSchema,
  isoDatetimeSchema,
  runIdSchema,
  workspaceIdSchema,
} from "./common.js";

const searchQueryTypesSchema = z.preprocess((value) => {
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
}, z.array(z.string().trim().min(1)).min(1).max(4).optional());

export const searchResourceTypeSchema = z.enum([
  "workshop",
  "service",
  "run",
  "package",
]);

export const searchResultToneSchema = z.enum([
  "active",
  "warn",
  "success",
  "danger",
]);

export const searchMatchFieldSchema = z.enum([
  "id",
  "title",
  "subtitle",
  "summary",
  "tag",
]);

export const searchResultTargetSchema = z.discriminatedUnion("resource", [
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
  z.object({
    resource: z.literal("package"),
    packageId: creatorPackageIdSchema,
    view: z.literal("detail"),
  }),
]);

export const searchResultRecordSchema = z.object({
  documentId: z.string().trim().min(1).max(240),
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  resourceType: searchResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  title: localizedTextSchema,
  subtitle: localizedTextSchema.nullable().default(null),
  summary: localizedTextSchema,
  badge: localizedTextSchema.nullable().default(null),
  tone: searchResultToneSchema,
  matchedFields: z.array(searchMatchFieldSchema).default([]),
  recent: z.boolean().default(false),
  favorited: z.boolean().default(false),
  updatedAt: isoDatetimeSchema.nullable().default(null),
  target: searchResultTargetSchema,
});

export const searchResultListResponseSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  updatedAt: isoDatetimeSchema.nullable(),
  items: z.array(searchResultRecordSchema),
});

export const listSearchResultsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  types: searchQueryTypesSchema.pipe(
    z.array(searchResourceTypeSchema).min(1).max(4).optional()
  ),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  entrySurface: entrySurfaceSchema.optional(),
});

export const searchSuggestionSchema = z.object({
  suggestionId: z.string().trim().min(1).max(240),
  resourceTypes: z.array(searchResourceTypeSchema).min(1).max(4),
  text: localizedTextSchema,
});

export const searchSuggestionListResponseSchema = z.object({
  items: z.array(searchSuggestionSchema),
});

export const listSearchSuggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  types: searchQueryTypesSchema.pipe(
    z.array(searchResourceTypeSchema).min(1).max(4).optional()
  ),
  limit: z.coerce.number().int().min(1).max(12).optional(),
  entrySurface: entrySurfaceSchema.optional(),
});

export const searchHistoryRecordSchema = z.object({
  historyId: z.string().trim().min(1).max(240),
  workspaceId: workspaceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  query: z.string().trim().min(1).max(200),
  resourceTypes: z.array(searchResourceTypeSchema).min(1).max(4),
  lastUsedAt: isoDatetimeSchema,
});

export const searchHistoryListResponseSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  updatedAt: isoDatetimeSchema.nullable(),
  items: z.array(searchHistoryRecordSchema),
});

export const listSearchHistoryQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const recordSearchClickInputSchema = z.object({
  query: z.string().trim().min(1).max(200),
  documentId: z.string().trim().min(1).max(240),
  entrySurface: entrySurfaceSchema,
});

export const recordSearchClickResultSchema = z.object({
  eventId: z.string().trim().min(1).max(240),
  documentId: z.string().trim().min(1).max(240),
  resourceType: searchResourceTypeSchema,
  resourceId: z.string().trim().min(1).max(240),
  rank: z.number().int().min(0),
  acceptedAt: isoDatetimeSchema,
  history: searchHistoryRecordSchema,
});

export type SearchResourceType = z.infer<typeof searchResourceTypeSchema>;
export type SearchResultTone = z.infer<typeof searchResultToneSchema>;
export type SearchMatchField = z.infer<typeof searchMatchFieldSchema>;
export type SearchResultTarget = z.infer<typeof searchResultTargetSchema>;
export type SearchResultRecord = z.infer<typeof searchResultRecordSchema>;
export type SearchResultListResponse = z.infer<typeof searchResultListResponseSchema>;
export type ListSearchResultsQuery = z.infer<typeof listSearchResultsQuerySchema>;
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
export type SearchSuggestionListResponse = z.infer<typeof searchSuggestionListResponseSchema>;
export type ListSearchSuggestionsQuery = z.infer<typeof listSearchSuggestionsQuerySchema>;
export type SearchHistoryRecord = z.infer<typeof searchHistoryRecordSchema>;
export type SearchHistoryListResponse = z.infer<typeof searchHistoryListResponseSchema>;
export type ListSearchHistoryQuery = z.infer<typeof listSearchHistoryQuerySchema>;
export type RecordSearchClickInput = z.infer<typeof recordSearchClickInputSchema>;
export type RecordSearchClickResult = z.infer<typeof recordSearchClickResultSchema>;
