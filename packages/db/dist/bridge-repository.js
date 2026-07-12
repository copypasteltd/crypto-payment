import { bridgeRegistrationSchema } from "@lingban/contracts";
import { z } from "zod";
export const bridgeRegistryStateSchema = z.object({
    connections: z.array(bridgeRegistrationSchema).default([]),
});
export class CachedBridgeRegistrationRepository {
    #initialized = false;
    #connections = new Map();
    async init() {
        if (this.#initialized) {
            return;
        }
        const state = bridgeRegistryStateSchema.parse(await this.loadState());
        this.#connections = new Map(state.connections.map((registration) => [registration.runId, registration]));
        this.#initialized = true;
    }
    async list() {
        await this.init();
        return [...this.#connections.values()].sort((left, right) => left.runId.localeCompare(right.runId));
    }
    async save(registration) {
        await this.init();
        const parsed = bridgeRegistrationSchema.parse(registration);
        this.#connections.set(parsed.runId, parsed);
        await this.persistRegistration(parsed);
    }
    async delete(runId) {
        await this.init();
        if (!this.#connections.has(runId)) {
            return;
        }
        this.#connections.delete(runId);
        await this.deleteRegistration(runId);
    }
    async clear() {
        await this.init();
        this.#connections.clear();
        await this.clearStorage();
    }
    getState() {
        return bridgeRegistryStateSchema.parse({
            connections: [...this.#connections.values()],
        });
    }
}
export class PostgresBridgeRegistrationRepository extends CachedBridgeRegistrationRepository {
    kind = "postgres";
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
        const result = await queryable.query(`
      SELECT bridge_json
      FROM lingban_bridge_registrations
      ORDER BY run_id ASC
      `);
        return bridgeRegistryStateSchema.parse({
            connections: result.rows.map((row) => row.bridge_json),
        });
    }
    async persistRegistration(registration) {
        const parsed = bridgeRegistrationSchema.parse(registration);
        const queryable = await this.#getQueryable();
        await queryable.query(`
      INSERT INTO lingban_bridge_registrations (
        run_id,
        bridge_id,
        workspace_id,
        target_path,
        connected_at,
        last_seen_at,
        bridge_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (run_id) DO UPDATE
      SET
        bridge_id = EXCLUDED.bridge_id,
        workspace_id = EXCLUDED.workspace_id,
        target_path = EXCLUDED.target_path,
        connected_at = EXCLUDED.connected_at,
        last_seen_at = EXCLUDED.last_seen_at,
        bridge_json = EXCLUDED.bridge_json
      `, [
            parsed.runId,
            parsed.bridgeId,
            parsed.workspaceId,
            parsed.targetPath,
            parsed.connectedAt,
            parsed.lastSeenAt ?? parsed.connectedAt,
            JSON.stringify(parsed),
        ]);
    }
    async deleteRegistration(runId) {
        const queryable = await this.#getQueryable();
        await queryable.query("DELETE FROM lingban_bridge_registrations WHERE run_id = $1", [runId]);
    }
    async clearStorage() {
        const queryable = await this.#getQueryable();
        await queryable.query("DELETE FROM lingban_bridge_registrations");
    }
}
//# sourceMappingURL=bridge-repository.js.map