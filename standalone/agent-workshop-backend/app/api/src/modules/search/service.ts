import { randomUUID } from "node:crypto";
import {
  listSearchHistoryQuerySchema,
  listSearchResultsQuerySchema,
  listSearchSuggestionsQuerySchema,
  recordSearchClickInputSchema,
  recordSearchClickResultSchema,
  searchHistoryListResponseSchema,
  searchHistoryRecordSchema,
  searchResultListResponseSchema,
  searchSuggestionListResponseSchema,
  type ListSearchHistoryQuery,
  type ListSearchResultsQuery,
  type ListSearchSuggestionsQuery,
  type LocalizedText,
  type RecordSearchClickInput,
  type RunSnapshot,
  type SearchHistoryRecord,
  type SearchMatchField,
  type SearchResourceType,
  type SearchResultRecord,
  type SearchSuggestion,
  type WorkspaceRole,
} from "@lingban/contracts";
import { resolveRunListViewStatus } from "@lingban/domain-models";
import { AppError } from "../../app/errors.js";
import { creatorService } from "../creator/service.js";
import { meFavoritesRepository } from "../me/repository.js";
import { meRecentActivitiesRepository } from "../me/recent-repository.js";
import { runsService } from "../runs/service.js";
import { workshopCatalogService } from "../workshops/service.js";
import { searchRepository } from "./repository.js";
import type { StoredSearchHistoryRecord } from "./storage-schema.js";

type SearchActorContext = {
  userId: string;
  workspaceId: string;
  workspaceContextKey: string;
  role: WorkspaceRole;
};

type SearchCandidate = SearchResultRecord & {
  score: number;
};

const DEFAULT_SEARCH_LIMIT = 8;
const DEFAULT_SUGGESTION_LIMIT = 6;
const CREATOR_SEARCH_ROLES = new Set<WorkspaceRole>(["owner", "admin", "creator"]);
const RESOURCE_BASE_BOOST: Record<SearchResourceType, number> = {
  workshop: 18,
  service: 20,
  run: 22,
  package: 16,
};

function l(zh: string, en = zh): LocalizedText {
  return {
    zh,
    en,
  };
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function tokenizeSearchValue(value: string) {
  return normalizeSearchValue(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveMatchScore(
  query: string,
  tokens: string[],
  values: Array<string | null | undefined>,
  weights: {
    exact: number;
    prefix: number;
    contains: number;
    multiToken: number;
  }
) {
  let best = 0;

  for (const raw of values) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      continue;
    }

    const normalized = normalizeSearchValue(raw);
    if (!normalized) {
      continue;
    }

    if (normalized === query) {
      best = Math.max(best, weights.exact);
      continue;
    }

    if (normalized.startsWith(query)) {
      best = Math.max(best, weights.prefix);
    }

    if (normalized.includes(query)) {
      best = Math.max(best, weights.contains);
    }

    if (tokens.length > 1 && tokens.every((token) => normalized.includes(token))) {
      best = Math.max(best, weights.multiToken);
    }
  }

  return best;
}

function buildMatchedFieldScore(
  query: string,
  tokens: string[],
  field: SearchMatchField,
  values: Array<string | null | undefined>,
  weights: {
    exact: number;
    prefix: number;
    contains: number;
    multiToken: number;
  }
) {
  const score = resolveMatchScore(query, tokens, values, weights);
  return score > 0
    ? {
        score,
        field,
      }
    : null;
}

function getRecentBoost(
  recentRanks: Map<string, number>,
  resourceType: SearchResourceType,
  resourceId: string
) {
  const rank = recentRanks.get(`${resourceType}:${resourceId}`);
  if (rank == null) {
    return 0;
  }

  return Math.max(8, 32 - rank * 4);
}

function getRunTone(snapshot: RunSnapshot): SearchResultRecord["tone"] {
  switch (snapshot.run.status) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
    case "CANCELLED":
      return "danger";
    case "WAITING_APPROVAL":
      return "warn";
    default:
      return "active";
  }
}

function getRunSummary(snapshot: RunSnapshot) {
  const status = snapshot.run.status;
  const path = snapshot.run.targetPath;
  return l(`${status} / ${path}`, `${status} / ${path}`);
}

function getRunSubtitle(snapshot: RunSnapshot) {
  const serviceName = snapshot.run.catalogMetadata?.serviceName;
  const workshopName = snapshot.run.catalogMetadata?.workshopName;
  return serviceName ?? workshopName ?? null;
}

function getSearchUpdatedAt(items: SearchResultRecord[]) {
  return items.reduce<string | null>((latest, item) => {
    if (!item.updatedAt) {
      return latest;
    }

    if (!latest || item.updatedAt.localeCompare(latest) > 0) {
      return item.updatedAt;
    }

    return latest;
  }, null);
}

function getSearchHistoryUpdatedAt(items: SearchHistoryRecord[]) {
  return items.reduce<string | null>((latest, item) => {
    if (!latest || item.lastUsedAt.localeCompare(latest) > 0) {
      return item.lastUsedAt;
    }

    return latest;
  }, null);
}

function getQueryBoost(
  clickBoosts: Map<string, number>,
  documentId: string
) {
  return clickBoosts.get(documentId) ?? 0;
}

function buildQueryClickBoosts(
  userId: string,
  workspaceContextKey: string,
  normalizedQuery: string
) {
  const clickEvents = searchRepository.listSearchClickEvents(
    userId,
    workspaceContextKey,
    normalizedQuery,
    24
  );
  const boosts = new Map<string, number>();

  clickEvents.forEach((event, index) => {
    const recencyBoost = Math.max(3, 14 - index * 2);
    const existing = boosts.get(event.documentId) ?? 0;
    boosts.set(event.documentId, Math.min(18, existing + recencyBoost));
  });

  return boosts;
}

function mapStoredHistoryRecord(
  record: StoredSearchHistoryRecord
): SearchHistoryRecord {
  return searchHistoryRecordSchema.parse({
    historyId: record.historyId,
    workspaceId: record.workspaceId,
    workspaceContextKey: record.workspaceContextKey,
    query: record.query,
    resourceTypes: record.resourceTypes,
    lastUsedAt: record.updatedAt,
  });
}

function scoreHistorySuggestion(
  normalizedQuery: string,
  historyQuery: string,
  index: number
) {
  const normalizedHistory = normalizeSearchValue(historyQuery);
  if (!normalizedHistory) {
    return 0;
  }

  const prefixBoost = normalizedHistory.startsWith(normalizedQuery) ? 24 : 0;
  const containsBoost = normalizedHistory.includes(normalizedQuery) ? 12 : 0;
  return prefixBoost + containsBoost + Math.max(1, 8 - index);
}

function sortSearchCandidates(left: SearchCandidate, right: SearchCandidate) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const leftUpdatedAt = left.updatedAt ?? "";
  const rightUpdatedAt = right.updatedAt ?? "";
  if (rightUpdatedAt !== leftUpdatedAt) {
    return rightUpdatedAt.localeCompare(leftUpdatedAt);
  }

  return left.documentId.localeCompare(right.documentId);
}

export class SearchService {
  async #collectCandidates(actor: SearchActorContext, query: ListSearchResultsQuery) {
    const parsed = listSearchResultsQuerySchema.parse(query);
    const typeSet = parsed.types ? new Set(parsed.types) : null;
    const normalizedQuery = normalizeSearchValue(parsed.q);
    const queryTokens = tokenizeSearchValue(parsed.q);
    const favorites = meFavoritesRepository.listFavoriteWorkshops(
      actor.userId,
      actor.workspaceContextKey
    );
    const favoriteWorkshopIds = new Set(favorites.map((item) => item.workshopId));
    const recentActivities = meRecentActivitiesRepository.listRecentActivities(
      actor.userId,
      actor.workspaceContextKey
    );
    const clickBoosts = buildQueryClickBoosts(
      actor.userId,
      actor.workspaceContextKey,
      normalizedQuery
    );
    const recentRanks = new Map(
      recentActivities.map((item, index) => [
        `${item.resourceType}:${item.resourceId}`,
        index,
      ])
    );
    const candidates: SearchCandidate[] = [];

    if (!typeSet || typeSet.has("workshop")) {
      const workshops = workshopCatalogService.listWorkshops({
        workspaceContextKey: actor.workspaceContextKey,
        entrySurface: parsed.entrySurface,
      });

      for (const workshop of workshops) {
        const matchedFields = new Set<SearchMatchField>();
        let score = RESOURCE_BASE_BOOST.workshop;
        const titleMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "title",
          [workshop.displayName.zh, workshop.displayName.en],
          { exact: 120, prefix: 100, contains: 84, multiToken: 92 }
        );
        const idMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "id",
          [workshop.workshopId],
          { exact: 112, prefix: 88, contains: 66, multiToken: 72 }
        );
        const summaryMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "summary",
          [
            workshop.summary.zh,
            workshop.summary.en,
            workshop.ownerLabel.zh,
            workshop.ownerLabel.en,
            workshop.audience.zh,
            workshop.audience.en,
          ],
          { exact: 72, prefix: 56, contains: 40, multiToken: 48 }
        );
        const tagMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "tag",
          workshop.tagList,
          { exact: 60, prefix: 48, contains: 36, multiToken: 42 }
        );

        for (const match of [titleMatch, idMatch, summaryMatch, tagMatch]) {
          if (!match) {
            continue;
          }
          score += match.score;
          matchedFields.add(match.field);
        }

        if (score === RESOURCE_BASE_BOOST.workshop) {
          continue;
        }

        const favorited = favoriteWorkshopIds.has(workshop.workshopId);
        if (favorited) {
          score += 18;
        }
        score += getQueryBoost(
          clickBoosts,
          `search:workshop:${workshop.workshopId}`
        );

        const recentBoost = getRecentBoost(
          recentRanks,
          "workshop",
          workshop.workshopId
        );
        score += recentBoost;

        candidates.push({
          documentId: `search:workshop:${workshop.workshopId}`,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          resourceType: "workshop",
          resourceId: workshop.workshopId,
          title: workshop.displayName,
          subtitle: workshop.ownerLabel,
          summary: workshop.summary,
          badge: workshop.badge,
          tone: favorited ? "success" : "active",
          matchedFields: [...matchedFields],
          recent: recentBoost > 0,
          favorited,
          updatedAt: null,
          target: {
            resource: "workshop",
            workshopId: workshop.workshopId,
            view: "detail",
          },
          score,
        });
      }
    }

    if (!typeSet || typeSet.has("service")) {
      const services = workshopCatalogService.listServices({
        workspaceContextKey: actor.workspaceContextKey,
        entrySurface: parsed.entrySurface,
      });

      for (const service of services) {
        const matchedFields = new Set<SearchMatchField>();
        let score = RESOURCE_BASE_BOOST.service;
        const titleMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "title",
          [service.displayName.zh, service.displayName.en],
          { exact: 118, prefix: 98, contains: 82, multiToken: 90 }
        );
        const idMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "id",
          [service.serviceId],
          { exact: 110, prefix: 86, contains: 64, multiToken: 70 }
        );
        const summaryMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "summary",
          [
            service.summary.zh,
            service.summary.en,
            service.authRequirementText.zh,
            service.authRequirementText.en,
            service.outputContractSummary.zh,
            service.outputContractSummary.en,
            service.targetPathHint,
            service.estimatedDuration,
          ],
          { exact: 72, prefix: 56, contains: 42, multiToken: 50 }
        );

        for (const match of [titleMatch, idMatch, summaryMatch]) {
          if (!match) {
            continue;
          }
          score += match.score;
          matchedFields.add(match.field);
        }

        if (score === RESOURCE_BASE_BOOST.service) {
          continue;
        }

        score += getQueryBoost(
          clickBoosts,
          `search:service:${service.serviceId}`
        );
        const recentBoost = getRecentBoost(
          recentRanks,
          "service",
          service.serviceId
        );
        score += recentBoost;

        candidates.push({
          documentId: `search:service:${service.serviceId}`,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          resourceType: "service",
          resourceId: service.serviceId,
          title: service.displayName,
          subtitle: service.authRequirementText,
          summary: service.outputContractSummary,
          badge: l(service.estimatedDuration),
          tone: recentBoost > 0 ? "success" : "active",
          matchedFields: [...matchedFields],
          recent: recentBoost > 0,
          favorited: false,
          updatedAt: null,
          target: {
            resource: "service",
            serviceId: service.serviceId,
            view: "detail",
          },
          score,
        });
      }
    }

    if (!typeSet || typeSet.has("run")) {
      const runs = runsService.listRuns(
        {},
        {
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
        }
      );

      for (const snapshot of runs) {
        const tags = [
          snapshot.run.catalogMetadata?.workspaceContextKey,
          snapshot.run.catalogMetadata?.workshopId,
          snapshot.run.catalogMetadata?.serviceId,
        ];
        const matchedFields = new Set<SearchMatchField>();
        let score = RESOURCE_BASE_BOOST.run;
        const titleMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "title",
          [snapshot.run.title],
          { exact: 124, prefix: 102, contains: 86, multiToken: 94 }
        );
        const idMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "id",
          [snapshot.run.runId],
          { exact: 120, prefix: 92, contains: 70, multiToken: 78 }
        );
        const summaryMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "summary",
          [
            snapshot.run.targetPath,
            snapshot.run.status,
            snapshot.run.statusReason,
            snapshot.run.catalogMetadata?.workshopName?.zh,
            snapshot.run.catalogMetadata?.workshopName?.en,
            snapshot.run.catalogMetadata?.serviceName?.zh,
            snapshot.run.catalogMetadata?.serviceName?.en,
            ...snapshot.messages.slice(-3).map((item) => item.text),
          ],
          { exact: 76, prefix: 60, contains: 44, multiToken: 54 }
        );
        const tagMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "tag",
          tags,
          { exact: 58, prefix: 44, contains: 34, multiToken: 40 }
        );

        for (const match of [titleMatch, idMatch, summaryMatch, tagMatch]) {
          if (!match) {
            continue;
          }
          score += match.score;
          matchedFields.add(match.field);
        }

        if (score === RESOURCE_BASE_BOOST.run) {
          continue;
        }

        const recentBoost = getRecentBoost(recentRanks, "run", snapshot.run.runId);
        score += recentBoost;
        score += getQueryBoost(clickBoosts, `search:run:${snapshot.run.runId}`);
        if (snapshot.run.status === "WAITING_APPROVAL") {
          score += 10;
        } else if (snapshot.run.status === "RUNNING") {
          score += 6;
        }

        candidates.push({
          documentId: `search:run:${snapshot.run.runId}`,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          resourceType: "run",
          resourceId: snapshot.run.runId,
          title: l(snapshot.run.title),
          subtitle: getRunSubtitle(snapshot),
          summary: getRunSummary(snapshot),
          badge: l(resolveRunListViewStatus(snapshot.run.status)),
          tone: getRunTone(snapshot),
          matchedFields: [...matchedFields],
          recent: recentBoost > 0,
          favorited: false,
          updatedAt: snapshot.run.updatedAt,
          target: {
            resource: "run",
            runId: snapshot.run.runId,
            view: "detail",
          },
          score,
        });
      }
    }

    if ((!typeSet || typeSet.has("package")) && CREATOR_SEARCH_ROLES.has(actor.role)) {
      const packages = creatorService.listPackages(
        {
          workspaceContextKey: actor.workspaceContextKey,
        },
        {
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
        }
      );

      for (const pkg of packages) {
        const matchedFields = new Set<SearchMatchField>();
        let score = RESOURCE_BASE_BOOST.package;
        const titleMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "title",
          [pkg.title.zh, pkg.title.en],
          { exact: 116, prefix: 96, contains: 80, multiToken: 88 }
        );
        const idMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "id",
          [pkg.packageId],
          { exact: 108, prefix: 84, contains: 62, multiToken: 70 }
        );
        const summaryMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "summary",
          [
            pkg.source.zh,
            pkg.source.en,
            pkg.statusLabel.zh,
            pkg.statusLabel.en,
            pkg.ownerLabel.zh,
            pkg.ownerLabel.en,
            pkg.releaseChannel.zh,
            pkg.releaseChannel.en,
          ],
          { exact: 72, prefix: 56, contains: 40, multiToken: 48 }
        );
        const tagMatch = buildMatchedFieldScore(
          normalizedQuery,
          queryTokens,
          "tag",
          pkg.workspaceContextKeys,
          { exact: 52, prefix: 40, contains: 30, multiToken: 36 }
        );

        for (const match of [titleMatch, idMatch, summaryMatch, tagMatch]) {
          if (!match) {
            continue;
          }
          score += match.score;
          matchedFields.add(match.field);
        }

        if (score === RESOURCE_BASE_BOOST.package) {
          continue;
        }

        score += getQueryBoost(clickBoosts, `search:package:${pkg.packageId}`);
        candidates.push({
          documentId: `search:package:${pkg.packageId}`,
          workspaceId: actor.workspaceId,
          workspaceContextKey: actor.workspaceContextKey,
          resourceType: "package",
          resourceId: pkg.packageId,
          title: pkg.title,
          subtitle: pkg.statusLabel,
          summary: pkg.source,
          badge: pkg.releaseChannel,
          tone: pkg.tone,
          matchedFields: [...matchedFields],
          recent: false,
          favorited: false,
          updatedAt: pkg.updatedAt,
          target: {
            resource: "package",
            packageId: pkg.packageId,
            view: "detail",
          },
          score,
        });
      }
    }

    return candidates.sort(sortSearchCandidates);
  }

  async listSearchResults(actor: SearchActorContext, query: ListSearchResultsQuery) {
    const parsed = listSearchResultsQuerySchema.parse(query);
    const candidates = await this.#collectCandidates(actor, parsed);
    const items = candidates
      .slice(0, parsed.limit ?? DEFAULT_SEARCH_LIMIT)
      .map(({ score, ...item }) => item);

    return searchResultListResponseSchema.parse({
      totalCount: candidates.length,
      updatedAt: getSearchUpdatedAt(items),
      items,
    });
  }

  async listSearchHistory(
    actor: SearchActorContext,
    query: ListSearchHistoryQuery = {}
  ) {
    const parsed = listSearchHistoryQuerySchema.parse(query);
    const normalizedFilter = parsed.q ? normalizeSearchValue(parsed.q) : null;
    const items = searchRepository
      .listSearchHistory(actor.userId, actor.workspaceContextKey)
      .filter(
        (item) =>
          !normalizedFilter ||
          item.normalizedQuery.includes(normalizedFilter) ||
          normalizeSearchValue(item.query).includes(normalizedFilter)
      )
      .slice(0, parsed.limit ?? DEFAULT_SUGGESTION_LIMIT)
      .map((item) => mapStoredHistoryRecord(item));

    return searchHistoryListResponseSchema.parse({
      totalCount: items.length,
      updatedAt: getSearchHistoryUpdatedAt(items),
      items,
    });
  }

  async recordSearchClick(
    actor: SearchActorContext,
    input: RecordSearchClickInput
  ) {
    const parsed = recordSearchClickInputSchema.parse(input);
    const normalizedQuery = normalizeSearchValue(parsed.query);
    const candidates = await this.#collectCandidates(actor, {
      q: parsed.query,
      limit: 20,
      entrySurface: parsed.entrySurface,
    });
    const selectedIndex = candidates.findIndex(
      (item) => item.documentId === parsed.documentId
    );

    if (selectedIndex < 0) {
      throw new AppError(
        404,
        "SEARCH_RESULT_NOT_FOUND",
        "Search result is no longer available in the current workspace"
      );
    }

    const selected = candidates[selectedIndex];
    const now = new Date().toISOString();
    const existingHistory = searchRepository.getSearchHistory(
      actor.userId,
      actor.workspaceContextKey,
      normalizedQuery
    );
    const historyRecord = await searchRepository.saveSearchHistory({
      historyId: existingHistory?.historyId ?? randomUUID(),
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      workspaceContextKey: actor.workspaceContextKey,
      query: parsed.query.trim(),
      normalizedQuery,
      resourceTypes: [
        ...new Set([
          ...(existingHistory?.resourceTypes ?? []),
          selected.resourceType,
        ]),
      ],
      createdAt: existingHistory?.createdAt ?? now,
      updatedAt: now,
    });

    const clickEvent = await searchRepository.appendSearchClickEvent({
      eventId: randomUUID(),
      userId: actor.userId,
      workspaceId: actor.workspaceId,
      workspaceContextKey: actor.workspaceContextKey,
      query: parsed.query.trim(),
      normalizedQuery,
      documentId: selected.documentId,
      resourceType: selected.resourceType,
      resourceId: selected.resourceId,
      rank: selectedIndex,
      sourceSurface: parsed.entrySurface,
      createdAt: now,
      updatedAt: now,
    });

    return recordSearchClickResultSchema.parse({
      eventId: clickEvent.eventId,
      documentId: selected.documentId,
      resourceType: selected.resourceType,
      resourceId: selected.resourceId,
      rank: selectedIndex,
      acceptedAt: now,
      history: mapStoredHistoryRecord(historyRecord),
    });
  }

  async listSearchSuggestions(
    actor: SearchActorContext,
    query: ListSearchSuggestionsQuery
  ) {
    const parsed = listSearchSuggestionsQuerySchema.parse(query);
    const results = await this.listSearchResults(actor, {
      q: parsed.q,
      types: parsed.types,
      limit: Math.max(parsed.limit ?? DEFAULT_SUGGESTION_LIMIT, 12),
      entrySurface: parsed.entrySurface,
    });

    const seen = new Set<string>();
    const suggestions: SearchSuggestion[] = [];
    const historySuggestions = searchRepository
      .listSearchHistory(actor.userId, actor.workspaceContextKey)
      .map((item, index) => ({
        item,
        score: scoreHistorySuggestion(parsed.q, item.query, index),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    for (const entry of historySuggestions) {
      const key = normalizeSearchValue(entry.item.query);
      if (seen.has(key)) {
        continue;
      }

      suggestions.push({
        suggestionId: `history:${entry.item.historyId}`,
        resourceTypes: entry.item.resourceTypes,
        text: l(entry.item.query),
      });
      seen.add(key);

      if (suggestions.length >= (parsed.limit ?? DEFAULT_SUGGESTION_LIMIT)) {
        break;
      }
    }

    for (const item of results.items) {
      const key = normalizeSearchValue(item.title.zh || item.title.en);
      if (seen.has(key)) {
        continue;
      }

      suggestions.push({
        suggestionId: item.documentId,
        resourceTypes: [item.resourceType],
        text: item.title,
      });
      seen.add(key);

      if (suggestions.length >= (parsed.limit ?? DEFAULT_SUGGESTION_LIMIT)) {
        break;
      }
    }

    return searchSuggestionListResponseSchema.parse({
      items: suggestions,
    });
  }
}

export async function initializeSearchInfrastructure() {
  await Promise.all([
    meFavoritesRepository.init(),
    meRecentActivitiesRepository.init(),
    searchRepository.init(),
  ]);
}

export const searchService = new SearchService();
