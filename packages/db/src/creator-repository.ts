import {
  creatorAuditExportIdSchema,
  creatorAuditExportRecordSchema,
  creatorGovernanceDynamicSectionSchema,
  creatorPackageDetailSchema,
  creatorPackageIdSchema,
  creatorReleaseActivationIdSchema,
  creatorReleaseActivationSchema,
  creatorReleaseGateIdSchema,
  creatorReleaseGateSchema,
  creatorReleaseIdSchema,
  creatorReleaseSummarySchema,
  creatorReplayIdSchema,
  creatorReplaySummarySchema,
  type CreatorAuditExportRecord,
  type CreatorPackageDetail,
  type CreatorReleaseActivation,
  type CreatorReleaseGate,
  type CreatorReleaseSummary,
  type CreatorReplaySummary,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const creatorStateSchema = z.object({
  packages: z.array(creatorPackageDetailSchema),
  releases: z.array(creatorReleaseSummarySchema),
  replays: z.array(creatorReplaySummarySchema),
  releaseGates: z.array(creatorReleaseGateSchema).default([]),
  activations: z.array(creatorReleaseActivationSchema).default([]),
  auditExports: z.array(creatorAuditExportRecordSchema).default([]),
});

export const creatorPackageIdParamsSchema = z.object({
  packageId: creatorPackageIdSchema,
});

export const creatorReleaseIdParamsSchema = z.object({
  packageId: creatorPackageIdSchema,
  releaseId: creatorReleaseIdSchema,
});

export const creatorReplayIdParamsSchema = z.object({
  packageId: creatorPackageIdSchema,
  replayId: creatorReplayIdSchema,
});

export const creatorReleaseGateIdParamsSchema = z.object({
  releaseId: creatorReleaseIdSchema,
  gateId: creatorReleaseGateIdSchema,
});

export const creatorReleaseIdOnlyParamsSchema = z.object({
  releaseId: creatorReleaseIdSchema,
});

export const creatorGovernanceSectionParamsSchema = z.object({
  packageId: creatorPackageIdSchema,
  section: creatorGovernanceDynamicSectionSchema,
});

export const creatorReleaseActivationIdParamsSchema = z.object({
  releaseId: creatorReleaseIdSchema,
  activationId: creatorReleaseActivationIdSchema,
});

export const creatorAuditExportIdParamsSchema = z.object({
  packageId: creatorPackageIdSchema,
  exportId: creatorAuditExportIdSchema,
});

export type CreatorState = z.infer<typeof creatorStateSchema>;

export interface CreatorRepository {
  init(): Promise<void>;
  listPackages(): CreatorPackageDetail[];
  getPackageById(packageId: string): CreatorPackageDetail | null;
  listReleases(): CreatorReleaseSummary[];
  getReleaseById(releaseId: string): CreatorReleaseSummary | null;
  listReleasesByPackage(packageId: string): CreatorReleaseSummary[];
  listReplays(): CreatorReplaySummary[];
  listReplaysByPackage(packageId: string): CreatorReplaySummary[];
  listReleaseGates(): CreatorReleaseGate[];
  listReleaseGatesByRelease(releaseId: string): CreatorReleaseGate[];
  listReleaseActivations(): CreatorReleaseActivation[];
  listReleaseActivationsByRelease(releaseId: string): CreatorReleaseActivation[];
  listAuditExports(): CreatorAuditExportRecord[];
  listAuditExportsByPackage(packageId: string): CreatorAuditExportRecord[];
  getAuditExportById(exportId: string): CreatorAuditExportRecord | null;
  savePackage(pkg: CreatorPackageDetail): Promise<void>;
  saveRelease(release: CreatorReleaseSummary): Promise<void>;
  saveReplay(replay: CreatorReplaySummary): Promise<void>;
  saveReleaseGate(gate: CreatorReleaseGate): Promise<void>;
  saveReleaseActivation(activation: CreatorReleaseActivation): Promise<void>;
  saveAuditExport(record: CreatorAuditExportRecord): Promise<void>;
}

function replaceByKey<T>(items: T[], nextItem: T, getKey: (item: T) => string) {
  const key = getKey(nextItem);
  const nextItems = [...items];
  const existingIndex = nextItems.findIndex((item) => getKey(item) === key);

  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
    return nextItems;
  }

  nextItems.push(nextItem);
  return nextItems;
}

export abstract class CachedCreatorRepository implements CreatorRepository {
  #initialized = false;
  #state: CreatorState = creatorStateSchema.parse({
    packages: [],
    releases: [],
    replays: [],
    releaseGates: [],
    activations: [],
    auditExports: [],
  });

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = creatorStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  listPackages() {
    return [...this.#state.packages].sort((left, right) => left.packageId.localeCompare(right.packageId));
  }

  getPackageById(packageId: string) {
    return this.#state.packages.find((item) => item.packageId === packageId) ?? null;
  }

  listReleases() {
    return [...this.#state.releases].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }

  getReleaseById(releaseId: string) {
    return this.#state.releases.find((item) => item.releaseId === releaseId) ?? null;
  }

  listReleasesByPackage(packageId: string) {
    return this.listReleases().filter((item) => item.packageId === packageId);
  }

  listReplays() {
    return [...this.#state.replays].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }

  listReplaysByPackage(packageId: string) {
    return this.listReplays().filter((item) => item.packageId === packageId);
  }

  listReleaseGates() {
    return [...this.#state.releaseGates].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }

  listReleaseGatesByRelease(releaseId: string) {
    return this.listReleaseGates().filter((item) => item.releaseId === releaseId);
  }

  listReleaseActivations() {
    return [...this.#state.activations].sort((left, right) => left.updatedAt.localeCompare(right.updatedAt));
  }

  listReleaseActivationsByRelease(releaseId: string) {
    return this.listReleaseActivations().filter((item) => item.releaseId === releaseId);
  }

  listAuditExports() {
    return [...this.#state.auditExports].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  listAuditExportsByPackage(packageId: string) {
    return this.listAuditExports().filter((item) => item.packageId === packageId);
  }

  getAuditExportById(exportId: string) {
    return this.#state.auditExports.find((item) => item.exportId === exportId) ?? null;
  }

  async savePackage(pkg: CreatorPackageDetail) {
    await this.init();
    const parsed = creatorPackageDetailSchema.parse(pkg);
    await this.updateState((state) => ({
      ...state,
      packages: replaceByKey(state.packages, parsed, (item) => item.packageId),
    }));
  }

  async saveRelease(release: CreatorReleaseSummary) {
    await this.init();
    const parsed = creatorReleaseSummarySchema.parse(release);
    await this.updateState((state) => ({
      ...state,
      releases: replaceByKey(state.releases, parsed, (item) => item.releaseId),
    }));
  }

  async saveReplay(replay: CreatorReplaySummary) {
    await this.init();
    const parsed = creatorReplaySummarySchema.parse(replay);
    await this.updateState((state) => ({
      ...state,
      replays: replaceByKey(state.replays, parsed, (item) => item.replayId),
    }));
  }

  async saveReleaseGate(gate: CreatorReleaseGate) {
    await this.init();
    const parsed = creatorReleaseGateSchema.parse(gate);
    await this.updateState((state) => ({
      ...state,
      releaseGates: replaceByKey(state.releaseGates, parsed, (item) => item.gateId),
    }));
  }

  async saveReleaseActivation(activation: CreatorReleaseActivation) {
    await this.init();
    const parsed = creatorReleaseActivationSchema.parse(activation);
    await this.updateState((state) => ({
      ...state,
      activations: replaceByKey(state.activations, parsed, (item) => item.activationId),
    }));
  }

  async saveAuditExport(record: CreatorAuditExportRecord) {
    await this.init();
    const parsed = creatorAuditExportRecordSchema.parse(record);
    await this.updateState((state) => ({
      ...state,
      auditExports: replaceByKey(state.auditExports, parsed, (item) => item.exportId),
    }));
  }

  protected async replaceState(state: CreatorState) {
    const nextState = creatorStateSchema.parse(state);
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected getState() {
    return this.#state;
  }

  protected async updateState(mutator: (state: CreatorState) => CreatorState) {
    const nextState = creatorStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected abstract loadState(): Promise<CreatorState>;
  protected abstract writeState(state: CreatorState): Promise<void>;
}

export interface PostgresCreatorRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresCreatorRepository extends CachedCreatorRepository {
  #options: PostgresCreatorRepositoryOptions;

  constructor(options: PostgresCreatorRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const [packages, releases, replays, releaseGates, activations, auditExports] = await Promise.all([
      queryable.query<{ package_json: CreatorPackageDetail }>(
        "SELECT package_json FROM lingban_creator_packages ORDER BY package_id ASC"
      ),
      queryable.query<{ release_json: CreatorReleaseSummary }>(
        "SELECT release_json FROM lingban_creator_releases ORDER BY release_id ASC"
      ),
      queryable.query<{ replay_json: CreatorReplaySummary }>(
        "SELECT replay_json FROM lingban_creator_replays ORDER BY replay_id ASC"
      ),
      queryable.query<{ gate_json: CreatorReleaseGate }>(
        "SELECT gate_json FROM lingban_creator_release_gates ORDER BY gate_id ASC"
      ),
      queryable.query<{ activation_json: CreatorReleaseActivation }>(
        "SELECT activation_json FROM lingban_creator_release_activations ORDER BY activation_id ASC"
      ),
      queryable.query<{ export_json: CreatorAuditExportRecord }>(
        "SELECT export_json FROM lingban_creator_audit_exports ORDER BY created_at DESC, export_id ASC"
      ),
    ]);

    return creatorStateSchema.parse({
      packages: packages.rows.map((row) => row.package_json),
      releases: releases.rows.map((row) => row.release_json),
      replays: replays.rows.map((row) => row.replay_json),
      releaseGates: releaseGates.rows.map((row) => row.gate_json),
      activations: activations.rows.map((row) => row.activation_json),
      auditExports: auditExports.rows.map((row) => row.export_json),
    });
  }

  protected async writeState(state: CreatorState) {
    const parsed = creatorStateSchema.parse(state);
    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_creator_release_activations");
      await queryable.query("DELETE FROM lingban_creator_release_gates");
      await queryable.query("DELETE FROM lingban_creator_replays");
      await queryable.query("DELETE FROM lingban_creator_releases");
      await queryable.query("DELETE FROM lingban_creator_packages");
      await queryable.query("DELETE FROM lingban_creator_audit_exports");

      for (const pkg of parsed.packages) {
        await queryable.query(
          `
          INSERT INTO lingban_creator_packages (package_id, state, package_json)
          VALUES ($1, $2, $3::jsonb)
          `,
          [pkg.packageId, pkg.state, JSON.stringify(pkg)]
        );
      }

      for (const release of parsed.releases) {
        await queryable.query(
          `
          INSERT INTO lingban_creator_releases (release_id, package_id, state, release_json)
          VALUES ($1, $2, $3, $4::jsonb)
          `,
          [release.releaseId, release.packageId, release.state, JSON.stringify(release)]
        );
      }

      for (const replay of parsed.replays) {
        await queryable.query(
          `
          INSERT INTO lingban_creator_replays (replay_id, package_id, state, replay_json)
          VALUES ($1, $2, $3, $4::jsonb)
          `,
          [replay.replayId, replay.packageId, replay.state, JSON.stringify(replay)]
        );
      }

      for (const gate of parsed.releaseGates) {
        await queryable.query(
          `
          INSERT INTO lingban_creator_release_gates (gate_id, release_id, package_id, status, gate_json)
          VALUES ($1, $2, $3, $4, $5::jsonb)
          `,
          [gate.gateId, gate.releaseId, gate.packageId, gate.status, JSON.stringify(gate)]
        );
      }

      for (const activation of parsed.activations) {
        await queryable.query(
          `
          INSERT INTO lingban_creator_release_activations (activation_id, release_id, package_id, state, activation_json)
          VALUES ($1, $2, $3, $4, $5::jsonb)
          `,
          [
            activation.activationId,
            activation.releaseId,
            activation.packageId,
            activation.state,
            JSON.stringify(activation),
          ]
        );
      }

      for (const record of parsed.auditExports) {
        await queryable.query(
          `
          INSERT INTO lingban_creator_audit_exports (
            export_id,
            package_id,
            workspace_context_key,
            export_format,
            status,
            created_at,
            export_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
          [
            record.exportId,
            record.packageId,
            record.workspaceContextKey,
            record.format,
            record.status,
            record.createdAt,
            JSON.stringify(record),
          ]
        );
      }
    });
  }
}
