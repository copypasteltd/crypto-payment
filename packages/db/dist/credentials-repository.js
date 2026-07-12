import { credentialDetailSchema, credentialIdSchema, credentialSecretEnvelopeSchema, } from "@lingban/contracts";
import { z } from "zod";
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
function replaceByKey(items, nextItem, getKey) {
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
export class CachedCredentialsRepository {
    #initialized = false;
    #state = credentialsStateSchema.parse({
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
        return [...this.#state.credentials].sort((left, right) => left.createdAt.localeCompare(right.createdAt) ||
            left.credentialId.localeCompare(right.credentialId));
    }
    getById(credentialId) {
        return this.#state.credentials.find((item) => item.credentialId === credentialId) ?? null;
    }
    async save(record) {
        await this.init();
        const parsed = storedCredentialRecordSchema.parse(record);
        await this.updateState((state) => ({
            ...state,
            credentials: replaceByKey(state.credentials, parsed, (item) => item.credentialId),
        }));
        return parsed;
    }
    async replaceState(state) {
        const nextState = credentialsStateSchema.parse(state);
        this.#state = nextState;
        await this.writeState(nextState);
    }
    getState() {
        return this.#state;
    }
    async updateState(mutator) {
        const nextState = credentialsStateSchema.parse(mutator(this.#state));
        this.#state = nextState;
        await this.writeState(nextState);
    }
}
export class PostgresCredentialsRepository extends CachedCredentialsRepository {
    #options;
    constructor(options) {
        super();
        this.#options = options;
    }
    async #getQueryable() {
        await this.#options.ensureReady?.();
        return this.#options.getQueryable();
    }
    async loadState() {
        const queryable = await this.#getQueryable();
        const result = await queryable.query("SELECT credential_json FROM lingban_credentials ORDER BY credential_id ASC");
        return credentialsStateSchema.parse({
            credentials: result.rows.map((row) => row.credential_json),
        });
    }
    async writeState(state) {
        const parsed = credentialsStateSchema.parse(state);
        await this.#options.withTransaction(async (queryable) => {
            await queryable.query("DELETE FROM lingban_credentials");
            for (const record of parsed.credentials) {
                await queryable.query(`
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
          `, [
                    record.credentialId,
                    record.workspaceId,
                    record.ownerUserId,
                    record.scope,
                    record.status,
                    record.provider,
                    JSON.stringify(record),
                ]);
            }
        });
    }
}
//# sourceMappingURL=credentials-repository.js.map