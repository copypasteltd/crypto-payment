import {
  credentialDetailSchema,
  credentialIdSchema,
  credentialSecretEnvelopeSchema,
  type CredentialDetail,
} from "@lingban/contracts";
import { z } from "zod";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export const storedCredentialRecordSchema = credentialDetailSchema.extend({
  redactedSecretRef: z.string().min(1).nullable().optional(),
  secretRef: z.string().min(1).nullable().default(null),
  secretEnvelope: credentialSecretEnvelopeSchema.nullable().default(null),
  lastMaterializationLeaseId: z.string().min(1).nullable().default(null),
  activeRunGraceIssuedAt: z.string().min(1).nullable().default(null),
});

export const credentialsStateSchema = z.object({
  credentials: z.array(storedCredentialRecordSchema).default([]),
});

export const credentialIdParamsSchema = z.object({
  credentialId: credentialIdSchema,
});

export type StoredCredentialRecord = z.infer<typeof storedCredentialRecordSchema>;
export type CredentialsState = z.infer<typeof credentialsStateSchema>;

export interface CredentialsRepository {
  init(): Promise<void>;
  list(): StoredCredentialRecord[];
  getById(credentialId: string): StoredCredentialRecord | null;
  save(record: StoredCredentialRecord): Promise<StoredCredentialRecord>;
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

export abstract class CachedCredentialsRepository implements CredentialsRepository {
  #initialized = false;
  #state: CredentialsState = credentialsStateSchema.parse({
    credentials: [],
  });

  async init() {
    if (this.#initialized) {
      return;
    }

    this.#state = credentialsStateSchema.parse(await this.loadState());
    this.#initialized = true;
  }

  list() {
    return [...this.#state.credentials].sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.credentialId.localeCompare(right.credentialId)
    );
  }

  getById(credentialId: string) {
    return this.#state.credentials.find((item) => item.credentialId === credentialId) ?? null;
  }

  async save(record: StoredCredentialRecord) {
    await this.init();
    const parsed = storedCredentialRecordSchema.parse(record);
    await this.updateState((state) => ({
      ...state,
      credentials: replaceByKey(state.credentials, parsed, (item) => item.credentialId),
    }));
    return parsed;
  }

  protected async replaceState(state: CredentialsState) {
    const nextState = credentialsStateSchema.parse(state);
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected getState() {
    return this.#state;
  }

  protected async updateState(mutator: (state: CredentialsState) => CredentialsState) {
    const nextState = credentialsStateSchema.parse(mutator(this.#state));
    this.#state = nextState;
    await this.writeState(nextState);
  }

  protected abstract loadState(): Promise<CredentialsState>;
  protected abstract writeState(state: CredentialsState): Promise<void>;
}

export interface PostgresCredentialsRepositoryOptions extends PostgresRepositoryOptions {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
}

export class PostgresCredentialsRepository extends CachedCredentialsRepository {
  #options: PostgresCredentialsRepositoryOptions;

  constructor(options: PostgresCredentialsRepositoryOptions) {
    super();
    this.#options = options;
  }

  async #getQueryable() {
    await this.#options.ensureReady?.();
    return this.#options.getQueryable();
  }

  protected async loadState() {
    const queryable = await this.#getQueryable();
    const result = await queryable.query<{ credential_json: CredentialDetail }>(
      "SELECT credential_json FROM lingban_credentials ORDER BY credential_id ASC"
    );

    return credentialsStateSchema.parse({
      credentials: result.rows.map((row) => row.credential_json),
    });
  }

  protected async writeState(state: CredentialsState) {
    const parsed = credentialsStateSchema.parse(state);
    await this.#options.withTransaction(async (queryable) => {
      await queryable.query("DELETE FROM lingban_credentials");

      for (const record of parsed.credentials) {
        await queryable.query(
          `
          INSERT INTO lingban_credentials (
            credential_id,
            workspace_id,
            owner_user_id,
            scope,
            status,
            provider,
            credential_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
          [
            record.credentialId,
            record.workspaceId,
            record.ownerUserId,
            record.scope,
            record.status,
            record.provider,
            JSON.stringify(record),
          ]
        );
      }
    });
  }
}
