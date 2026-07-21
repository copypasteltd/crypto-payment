import { mkdirSync, readFileSync, renameSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { buildAtomicTempPath } from "@lingban/shared";
import { getApiRuntimeConfig } from "../../app/runtime.js";
import { resolveApiStorageDir } from "../../app/storage.js";
import { ensureApiDatabaseReady, getApiDatabasePool } from "../../app/database.js";

export const wechatIdentityRecordSchema = z.object({
  provider: z.literal("wechat_mini_program"),
  appId: z.string().min(1).max(128),
  providerSubject: z.string().min(1).max(256),
  unionId: z.string().min(1).max(256).nullable(),
  userId: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

const wechatIdentityStateSchema = z.object({
  identities: z.array(wechatIdentityRecordSchema).default([]),
});

export type WechatIdentityRecord = z.infer<typeof wechatIdentityRecordSchema>;

interface WechatIdentityRepository {
  findBySubject(appId: string, providerSubject: string): Promise<WechatIdentityRecord | null>;
  save(record: WechatIdentityRecord): Promise<WechatIdentityRecord>;
}

class FileWechatIdentityRepository implements WechatIdentityRepository {
  #statePath: string;
  #records = new Map<string, WechatIdentityRecord>();
  #initialized = false;
  #writeChain: Promise<void> = Promise.resolve();

  constructor(storageDir = resolveApiStorageDir("auth")) {
    mkdirSync(storageDir, { recursive: true });
    this.#statePath = path.join(storageDir, "wechat-identities.json");
  }

  #key(appId: string, providerSubject: string) {
    return `${appId}:${providerSubject}`;
  }

  #init() {
    if (this.#initialized) return;
    try {
      const state = wechatIdentityStateSchema.parse(
        JSON.parse(readFileSync(this.#statePath, "utf8")) as unknown
      );
      for (const record of state.identities) {
        this.#records.set(this.#key(record.appId, record.providerSubject), record);
      }
    } catch {
      this.#records.clear();
    }
    this.#initialized = true;
  }

  async findBySubject(appId: string, providerSubject: string) {
    this.#init();
    return this.#records.get(this.#key(appId, providerSubject)) ?? null;
  }

  async save(input: WechatIdentityRecord) {
    this.#init();
    const record = wechatIdentityRecordSchema.parse(input);
    this.#records.set(this.#key(record.appId, record.providerSubject), record);
    const next = this.#writeChain
      .catch(() => undefined)
      .then(async () => {
        const state = wechatIdentityStateSchema.parse({
          identities: [...this.#records.values()],
        });
        const tempPath = buildAtomicTempPath(this.#statePath);
        await fs.writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
        renameSync(tempPath, this.#statePath);
      });
    this.#writeChain = next;
    await next;
    return record;
  }
}

class PostgresWechatIdentityRepository implements WechatIdentityRepository {
  async #queryable() {
    await ensureApiDatabaseReady();
    return getApiDatabasePool();
  }

  async findBySubject(appId: string, providerSubject: string) {
    const queryable = await this.#queryable();
    const result = await queryable.query<{
      provider: "wechat_mini_program";
      app_id: string;
      provider_subject: string;
      union_id: string | null;
      user_id: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `
      SELECT *
      FROM lingban_auth_external_identities
      WHERE provider = 'wechat_mini_program'
        AND app_id = $1
        AND provider_subject = $2
      LIMIT 1
      `,
      [appId, providerSubject]
    );
    const row = result.rows[0];
    return row
      ? wechatIdentityRecordSchema.parse({
          provider: row.provider,
          appId: row.app_id,
          providerSubject: row.provider_subject,
          unionId: row.union_id,
          userId: row.user_id,
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        })
      : null;
  }

  async save(input: WechatIdentityRecord) {
    const record = wechatIdentityRecordSchema.parse(input);
    const queryable = await this.#queryable();
    await queryable.query(
      `
      INSERT INTO lingban_auth_external_identities (
        provider,
        app_id,
        provider_subject,
        union_id,
        user_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (provider, app_id, provider_subject) DO UPDATE
      SET
        union_id = EXCLUDED.union_id,
        user_id = EXCLUDED.user_id,
        updated_at = EXCLUDED.updated_at
      `,
      [
        record.provider,
        record.appId,
        record.providerSubject,
        record.unionId,
        record.userId,
        record.createdAt,
        record.updatedAt,
      ]
    );
    return record;
  }
}

function buildWechatIdentityRepository(): WechatIdentityRepository {
  return getApiRuntimeConfig().authStore === "postgres"
    ? new PostgresWechatIdentityRepository()
    : new FileWechatIdentityRepository();
}

export const wechatIdentityRepository = buildWechatIdentityRepository();
