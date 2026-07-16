import {
  creatorPackageSessionBindingSchema,
  serviceSessionBindingSchema,
  sealedSessionVersionRecordSchema,
  sessionAssetRecordSchema,
  sessionDraftRecordSchema,
  sessionDraftRevisionSchema,
  sessionDraftReplayRecordSchema,
  sessionRedactionReviewRecordSchema,
  sessionVersionLineageRecordSchema,
  type CreatorPackageSessionBinding,
  type SealedSessionVersionRecord,
  type SessionAssetRecord,
  type SessionDraftRecord,
  type SessionDraftRevision,
  type SessionDraftReplayRecord,
  type SessionRedactionReviewRecord,
  type SessionVersionLineageRecord,
  type ServiceSessionBinding,
} from "@lingban/contracts";
import type { PostgresQueryExecutor, PostgresRepositoryOptions } from "./postgres-types.js";

export interface SessionAssetRepository {
  createSession(record: SessionAssetRecord): Promise<SessionAssetRecord>;
  getSession(sessionId: string): Promise<SessionAssetRecord | null>;
  createDraft(record: SessionDraftRecord): Promise<SessionDraftRecord>;
  getDraft(draftId: string): Promise<SessionDraftRecord | null>;
  listDrafts(workspaceId: string): Promise<SessionDraftRecord[]>;
  addRevision(draft: SessionDraftRecord, revision: SessionDraftRevision, expectedVersion: number): Promise<SessionDraftRecord | null>;
  getRevision(revisionId: string): Promise<SessionDraftRevision | null>;
  listRevisions(draftId: string): Promise<SessionDraftRevision[]>;
  addReview(review: SessionRedactionReviewRecord, draft: SessionDraftRecord, expectedVersion: number): Promise<SessionDraftRecord | null>;
  listReviews(draftId: string): Promise<SessionRedactionReviewRecord[]>;
  addReplay(replay: SessionDraftReplayRecord, draft: SessionDraftRecord, expectedVersion: number): Promise<SessionDraftRecord | null>;
  listReplays(draftId: string): Promise<SessionDraftReplayRecord[]>;
  sealVersion(input: {
    version: SealedSessionVersionRecord;
    draft: SessionDraftRecord;
    expectedDraftVersion: number;
    lineage: SessionVersionLineageRecord | null;
  }): Promise<SealedSessionVersionRecord | null>;
  importDetachedVersion(input: {
    session: SessionAssetRecord;
    version: SealedSessionVersionRecord;
  }): Promise<SealedSessionVersionRecord>;
  getVersion(sessionVersionId: string): Promise<SealedSessionVersionRecord | null>;
  listVersions(sessionId: string): Promise<SealedSessionVersionRecord[]>;
  listAllVersions(): Promise<SealedSessionVersionRecord[]>;
  getPackageBinding(packageId: string, state?: "candidate" | "active" | "inactive"): Promise<CreatorPackageSessionBinding | null>;
  putPackageBinding(binding: CreatorPackageSessionBinding, expectedVersion: number): Promise<CreatorPackageSessionBinding | null>;
  getServiceBinding(input: {
    serviceId: string;
    workspaceContextKey: string;
    entrySurface: string;
    state?: "candidate" | "active" | "inactive";
  }): Promise<ServiceSessionBinding | null>;
  listAllServiceBindings(): Promise<ServiceSessionBinding[]>;
  putServiceBinding(binding: ServiceSessionBinding, expectedVersion: number): Promise<ServiceSessionBinding | null>;
}

export class InMemorySessionAssetRepository implements SessionAssetRepository {
  #sessions = new Map<string, SessionAssetRecord>();
  #drafts = new Map<string, SessionDraftRecord>();
  #revisions = new Map<string, SessionDraftRevision>();
  #reviews = new Map<string, SessionRedactionReviewRecord>();
  #replays = new Map<string, SessionDraftReplayRecord>();
  #versions = new Map<string, SealedSessionVersionRecord>();
  #packageBindings = new Map<string, CreatorPackageSessionBinding>();
  #serviceBindings = new Map<string, ServiceSessionBinding>();

  async createSession(record: SessionAssetRecord) {
    const parsed = sessionAssetRecordSchema.parse(record);
    const existing = this.#sessions.get(parsed.sessionId);
    if (existing) return existing;
    this.#sessions.set(parsed.sessionId, parsed);
    return parsed;
  }
  async getSession(sessionId: string) { return this.#sessions.get(sessionId) ?? null; }
  async createDraft(record: SessionDraftRecord) {
    const parsed = sessionDraftRecordSchema.parse(record);
    const existing = [...this.#drafts.values()].find((item) => item.sessionId === parsed.sessionId && item.sourceCaptureId === parsed.sourceCaptureId);
    if (existing) return existing;
    this.#drafts.set(parsed.draftId, parsed);
    return parsed;
  }
  async getDraft(draftId: string) { return this.#drafts.get(draftId) ?? null; }
  async listDrafts(workspaceId: string) {
    const sessionIds = new Set([...this.#sessions.values()].filter((item) => item.workspaceId === workspaceId).map((item) => item.sessionId));
    return [...this.#drafts.values()].filter((item) => sessionIds.has(item.sessionId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async addRevision(draft: SessionDraftRecord, revision: SessionDraftRevision, expectedVersion: number) {
    const current = this.#drafts.get(draft.draftId);
    if (!current || current.version !== expectedVersion) return null;
    const parsedDraft = sessionDraftRecordSchema.parse(draft);
    const parsedRevision = sessionDraftRevisionSchema.parse(revision);
    this.#revisions.set(parsedRevision.revisionId, parsedRevision);
    this.#drafts.set(parsedDraft.draftId, parsedDraft);
    return parsedDraft;
  }
  async getRevision(revisionId: string) { return this.#revisions.get(revisionId) ?? null; }
  async listRevisions(draftId: string) { return [...this.#revisions.values()].filter((item) => item.draftId === draftId).sort((a, b) => b.revisionNumber - a.revisionNumber); }
  async addReview(review: SessionRedactionReviewRecord, draft: SessionDraftRecord, expectedVersion: number) {
    const current = this.#drafts.get(draft.draftId);
    if (!current || current.version !== expectedVersion) return null;
    const parsedReview = sessionRedactionReviewRecordSchema.parse(review);
    const parsedDraft = sessionDraftRecordSchema.parse(draft);
    this.#reviews.set(parsedReview.reviewId, parsedReview);
    this.#drafts.set(parsedDraft.draftId, parsedDraft);
    return parsedDraft;
  }
  async listReviews(draftId: string) { return [...this.#reviews.values()].filter((item) => item.draftId === draftId).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)); }
  async addReplay(replay: SessionDraftReplayRecord, draft: SessionDraftRecord, expectedVersion: number) {
    const current = this.#drafts.get(draft.draftId);
    if (!current || current.version !== expectedVersion) return null;
    const parsedReplay = sessionDraftReplayRecordSchema.parse(replay);
    const parsedDraft = sessionDraftRecordSchema.parse(draft);
    this.#replays.set(parsedReplay.replayId, parsedReplay);
    this.#drafts.set(parsedDraft.draftId, parsedDraft);
    return parsedDraft;
  }
  async listReplays(draftId: string) { return [...this.#replays.values()].filter((item) => item.draftId === draftId).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)); }
  async sealVersion(input: { version: SealedSessionVersionRecord; draft: SessionDraftRecord; expectedDraftVersion: number; lineage: SessionVersionLineageRecord | null }) {
    const current = this.#drafts.get(input.draft.draftId);
    if (!current || current.version !== input.expectedDraftVersion) return null;
    const version = sealedSessionVersionRecordSchema.parse(input.version);
    this.#versions.set(version.sessionVersionId, version);
    this.#drafts.set(input.draft.draftId, sessionDraftRecordSchema.parse(input.draft));
    return version;
  }
  async importDetachedVersion(input: { session: SessionAssetRecord; version: SealedSessionVersionRecord }) {
    const session = await this.createSession(input.session);
    const version = sealedSessionVersionRecordSchema.parse(input.version);
    if (version.sourceType === "captured" || version.sealedFromRevisionId || version.sealedFromReplayId) {
      throw new Error(`Invalid detached Session Version provenance: ${version.sessionVersionId}`);
    }
    const existing = this.#versions.get(version.sessionVersionId);
    if (existing) return existing;
    if (session.sessionId !== version.sessionId) throw new Error("Legacy Session Version session mismatch");
    this.#versions.set(version.sessionVersionId, version);
    return version;
  }
  async getVersion(id: string) { return this.#versions.get(id) ?? null; }
  async listVersions(sessionId: string) { return [...this.#versions.values()].filter((item) => item.sessionId === sessionId).sort((a, b) => b.sealedAt.localeCompare(a.sealedAt)); }
  async listAllVersions() { return [...this.#versions.values()].sort((a, b) => b.sealedAt.localeCompare(a.sealedAt)); }
  async getPackageBinding(packageId: string, state?: "candidate" | "active" | "inactive") {
    return [...this.#packageBindings.values()].find((item) => item.packageId === packageId && (!state || item.state === state)) ?? null;
  }
  async putPackageBinding(binding: CreatorPackageSessionBinding, expectedVersion: number) {
    const current = await this.getPackageBinding(binding.packageId, binding.state);
    if ((current?.version ?? 0) !== expectedVersion) return null;
    if (binding.state === "active") {
      for (const [id, item] of this.#packageBindings) {
        if (item.packageId === binding.packageId && item.state === "active") {
          this.#packageBindings.set(id, { ...item, state: "inactive", version: item.version + 1, updatedAt: binding.updatedAt });
        }
      }
    }
    const parsed = creatorPackageSessionBindingSchema.parse(binding);
    this.#packageBindings.set(parsed.bindingId, parsed);
    return parsed;
  }
  async getServiceBinding(input: { serviceId: string; workspaceContextKey: string; entrySurface: string; state?: "candidate" | "active" | "inactive" }) {
    return [...this.#serviceBindings.values()]
      .filter((item) => item.serviceId === input.serviceId && item.workspaceContextKey === input.workspaceContextKey && item.entrySurface === input.entrySurface)
      .filter((item) => !input.state || item.state === input.state)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  }
  async listAllServiceBindings() {
    return [...this.#serviceBindings.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  async putServiceBinding(binding: ServiceSessionBinding, expectedVersion: number) {
    const parsed = serviceSessionBindingSchema.parse(binding);
    const current = await this.getServiceBinding({
      serviceId: parsed.serviceId,
      workspaceContextKey: parsed.workspaceContextKey,
      entrySurface: parsed.entrySurface,
      state: parsed.state,
    });
    if ((current?.version ?? 0) !== expectedVersion) return null;
    if (parsed.state === "active") {
      for (const [id, item] of this.#serviceBindings) {
        if (item.serviceId === parsed.serviceId && item.workspaceContextKey === parsed.workspaceContextKey && item.entrySurface === parsed.entrySurface && item.state === "active") {
          this.#serviceBindings.set(id, serviceSessionBindingSchema.parse({
            ...item,
            state: "inactive",
            version: item.version + 1,
            updatedAt: parsed.updatedAt,
          }));
        }
      }
    }
    this.#serviceBindings.set(parsed.bindingId, parsed);
    return parsed;
  }
}

type Options = PostgresRepositoryOptions & {
  withTransaction: <T>(fn: (queryable: PostgresQueryExecutor) => Promise<T>) => Promise<T>;
};

export class PostgresSessionAssetRepository implements SessionAssetRepository {
  #options: Options;
  constructor(options: Options) { this.#options = options; }
  async #queryable() { await this.#options.ensureReady?.(); return this.#options.getQueryable(); }

  async createSession(record: SessionAssetRecord) {
    const parsed = sessionAssetRecordSchema.parse(record);
    const q = await this.#queryable();
    const result = await q.query<{ record_json: SessionAssetRecord }>(`
      INSERT INTO lingban_sessions (session_id, workspace_id, name, description, task_family, status, created_by_user_id, created_at, updated_at, record_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
      ON CONFLICT (session_id) DO UPDATE SET session_id=EXCLUDED.session_id
      RETURNING record_json`, [parsed.sessionId, parsed.workspaceId, parsed.name, parsed.description, parsed.taskFamily, parsed.status, parsed.createdByUserId, parsed.createdAt, parsed.updatedAt, JSON.stringify(parsed)]);
    return sessionAssetRecordSchema.parse(result.rows[0]!.record_json);
  }
  async getSession(id: string) { const q=await this.#queryable(); const r=await q.query<{record_json:SessionAssetRecord}>("SELECT record_json FROM lingban_sessions WHERE session_id=$1",[id]); return r.rows[0]?sessionAssetRecordSchema.parse(r.rows[0].record_json):null; }
  async createDraft(record: SessionDraftRecord) {
    const p=sessionDraftRecordSchema.parse(record); const q=await this.#queryable();
    const r=await q.query<{record_json:SessionDraftRecord}>(`INSERT INTO lingban_session_drafts (draft_id,session_id,source_capture_id,parent_session_version_id,status,current_revision_id,created_by_user_id,version,created_at,updated_at,record_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT (session_id,source_capture_id) DO UPDATE SET session_id=EXCLUDED.session_id RETURNING record_json`,[p.draftId,p.sessionId,p.sourceCaptureId,p.parentSessionVersionId,p.status,p.currentRevisionId,p.createdByUserId,p.version,p.createdAt,p.updatedAt,JSON.stringify(p)]); return sessionDraftRecordSchema.parse(r.rows[0]!.record_json);
  }
  async getDraft(id:string){const q=await this.#queryable();const r=await q.query<{record_json:SessionDraftRecord}>("SELECT record_json FROM lingban_session_drafts WHERE draft_id=$1",[id]);return r.rows[0]?sessionDraftRecordSchema.parse(r.rows[0].record_json):null;}
  async listDrafts(workspaceId:string){const q=await this.#queryable();const r=await q.query<{record_json:SessionDraftRecord}>(`SELECT d.record_json FROM lingban_session_drafts d JOIN lingban_sessions s ON s.session_id=d.session_id WHERE s.workspace_id=$1 ORDER BY d.updated_at DESC`,[workspaceId]);return r.rows.map(x=>sessionDraftRecordSchema.parse(x.record_json));}
  async addRevision(draft:SessionDraftRecord,revision:SessionDraftRevision,expectedVersion:number){const d=sessionDraftRecordSchema.parse(draft);const v=sessionDraftRevisionSchema.parse(revision);return this.#options.withTransaction(async q=>{const lock=await q.query<{version:number}>("SELECT version FROM lingban_session_drafts WHERE draft_id=$1 FOR UPDATE",[d.draftId]);if(lock.rows[0]?.version!==expectedVersion)return null;await q.query(`INSERT INTO lingban_session_draft_revisions (revision_id,draft_id,revision_number,input_fingerprint,selection_json,redaction_map_json,candidate_object_key,candidate_sha256,candidate_size_bytes,validation_report_json,security_report_json,created_by_user_id,created_at,record_json) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14::jsonb)`,[v.revisionId,v.draftId,v.revisionNumber,v.inputFingerprint,JSON.stringify(v.workspaceSelection),JSON.stringify(v.redactionRules),v.candidateObjectKey,v.candidateSha256,v.candidateSizeBytes,JSON.stringify(v.validationReport),JSON.stringify(v.securityReport),v.createdByUserId,v.createdAt,JSON.stringify(v)]);await q.query(`UPDATE lingban_session_drafts SET status=$2,current_revision_id=$3,version=$4,updated_at=$5,record_json=$6::jsonb WHERE draft_id=$1`,[d.draftId,d.status,d.currentRevisionId,d.version,d.updatedAt,JSON.stringify(d)]);return d;});}
  async getRevision(id:string){const q=await this.#queryable();const r=await q.query<{record_json:SessionDraftRevision}>("SELECT record_json FROM lingban_session_draft_revisions WHERE revision_id=$1",[id]);return r.rows[0]?sessionDraftRevisionSchema.parse(r.rows[0].record_json):null;}
  async listRevisions(draftId:string){const q=await this.#queryable();const r=await q.query<{record_json:SessionDraftRevision}>("SELECT record_json FROM lingban_session_draft_revisions WHERE draft_id=$1 ORDER BY revision_number DESC",[draftId]);return r.rows.map(x=>sessionDraftRevisionSchema.parse(x.record_json));}
  async addReview(review:SessionRedactionReviewRecord,draft:SessionDraftRecord,expectedVersion:number){const reviewRecord=sessionRedactionReviewRecordSchema.parse(review);const d=sessionDraftRecordSchema.parse(draft);return this.#options.withTransaction(async q=>{const lock=await q.query<{version:number}>("SELECT version FROM lingban_session_drafts WHERE draft_id=$1 FOR UPDATE",[d.draftId]);if(lock.rows[0]?.version!==expectedVersion)return null;await q.query(`INSERT INTO lingban_session_redaction_reviews (review_id,draft_id,revision_id,decision,note,reviewed_by_user_id,reviewed_at,record_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[reviewRecord.reviewId,reviewRecord.draftId,reviewRecord.revisionId,reviewRecord.decision,reviewRecord.note,reviewRecord.reviewedByUserId,reviewRecord.reviewedAt,JSON.stringify(reviewRecord)]);await q.query(`UPDATE lingban_session_drafts SET status=$2,version=$3,updated_at=$4,record_json=$5::jsonb WHERE draft_id=$1`,[d.draftId,d.status,d.version,d.updatedAt,JSON.stringify(d)]);return d;});}
  async listReviews(draftId:string){const q=await this.#queryable();const r=await q.query<{record_json:SessionRedactionReviewRecord}>("SELECT record_json FROM lingban_session_redaction_reviews WHERE draft_id=$1 ORDER BY reviewed_at DESC",[draftId]);return r.rows.map(x=>sessionRedactionReviewRecordSchema.parse(x.record_json));}
  async addReplay(replay:SessionDraftReplayRecord,draft:SessionDraftRecord,expectedVersion:number){const replayRecord=sessionDraftReplayRecordSchema.parse(replay);const d=sessionDraftRecordSchema.parse(draft);return this.#options.withTransaction(async q=>{const lock=await q.query<{version:number}>("SELECT version FROM lingban_session_drafts WHERE draft_id=$1 FOR UPDATE",[d.draftId]);if(lock.rows[0]?.version!==expectedVersion)return null;await q.query(`INSERT INTO lingban_session_draft_replays (replay_id,draft_id,revision_id,replay_status,candidate_sha256,started_at,finished_at,record_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[replayRecord.replayId,replayRecord.draftId,replayRecord.revisionId,replayRecord.status,replayRecord.candidateSha256,replayRecord.startedAt,replayRecord.finishedAt,JSON.stringify(replayRecord)]);await q.query(`UPDATE lingban_session_drafts SET status=$2,version=$3,updated_at=$4,record_json=$5::jsonb WHERE draft_id=$1`,[d.draftId,d.status,d.version,d.updatedAt,JSON.stringify(d)]);return d;});}
  async listReplays(draftId:string){const q=await this.#queryable();const r=await q.query<{record_json:SessionDraftReplayRecord}>("SELECT record_json FROM lingban_session_draft_replays WHERE draft_id=$1 ORDER BY finished_at DESC",[draftId]);return r.rows.map(x=>sessionDraftReplayRecordSchema.parse(x.record_json));}
  async sealVersion(input:{version:SealedSessionVersionRecord;draft:SessionDraftRecord;expectedDraftVersion:number;lineage:SessionVersionLineageRecord|null}){const v=sealedSessionVersionRecordSchema.parse(input.version);const d=sessionDraftRecordSchema.parse(input.draft);return this.#options.withTransaction(async q=>{const lock=await q.query<{version:number}>("SELECT version FROM lingban_session_drafts WHERE draft_id=$1 FOR UPDATE",[d.draftId]);if(lock.rows[0]?.version!==input.expectedDraftVersion)return null;await q.query(`INSERT INTO lingban_session_versions (session_version_id,session_id,sealed_from_revision_id,sealed_from_replay_id,source_type,legacy_incomplete,migration_report_object_key,parent_session_version_id,manifest_version,pack_object_key,pack_sha256,pack_size_bytes,signature_algorithm,signature_key_id,signature_value,content_state,sealed_by_user_id,sealed_at,record_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)`,[v.sessionVersionId,v.sessionId,v.sealedFromRevisionId,v.sealedFromReplayId,v.sourceType,v.legacyIncomplete,v.migrationReportObjectKey,v.parentSessionVersionId,v.manifestVersion,v.packObjectKey,v.packSha256,v.packSizeBytes,v.signatureAlgorithm,v.signatureKeyId,v.signatureValue,v.contentState,v.sealedByUserId,v.sealedAt,JSON.stringify(v)]);if(input.lineage){const l=sessionVersionLineageRecordSchema.parse(input.lineage);await q.query(`INSERT INTO lingban_session_version_lineage (parent_version_id,child_version_id,relation_type,reason,created_at) VALUES ($1,$2,$3,$4,$5)`,[l.parentVersionId,l.childVersionId,l.relationType,l.reason,l.createdAt]);}await q.query(`UPDATE lingban_session_drafts SET status=$2,version=$3,updated_at=$4,record_json=$5::jsonb WHERE draft_id=$1`,[d.draftId,d.status,d.version,d.updatedAt,JSON.stringify(d)]);return v;});}
  async importDetachedVersion(input:{session:SessionAssetRecord;version:SealedSessionVersionRecord}){const s=sessionAssetRecordSchema.parse(input.session);const v=sealedSessionVersionRecordSchema.parse(input.version);if(v.sourceType==="captured"||v.sealedFromRevisionId||v.sealedFromReplayId)throw new Error(`Invalid detached Session Version provenance: ${v.sessionVersionId}`);return this.#options.withTransaction(async q=>{await q.query(`INSERT INTO lingban_sessions (session_id,workspace_id,name,description,task_family,status,created_by_user_id,created_at,updated_at,record_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT (session_id) DO UPDATE SET session_id=EXCLUDED.session_id`,[s.sessionId,s.workspaceId,s.name,s.description,s.taskFamily,s.status,s.createdByUserId,s.createdAt,s.updatedAt,JSON.stringify(s)]);const existing=await q.query<{record_json:SealedSessionVersionRecord}>("SELECT record_json FROM lingban_session_versions WHERE session_version_id=$1",[v.sessionVersionId]);if(existing.rows[0])return sealedSessionVersionRecordSchema.parse(existing.rows[0].record_json);const inserted=await q.query<{record_json:SealedSessionVersionRecord}>(`INSERT INTO lingban_session_versions (session_version_id,session_id,sealed_from_revision_id,sealed_from_replay_id,source_type,legacy_incomplete,migration_report_object_key,parent_session_version_id,manifest_version,pack_object_key,pack_sha256,pack_size_bytes,signature_algorithm,signature_key_id,signature_value,content_state,sealed_by_user_id,sealed_at,record_json) VALUES ($1,$2,NULL,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb) RETURNING record_json`,[v.sessionVersionId,v.sessionId,v.sourceType,v.legacyIncomplete,v.migrationReportObjectKey,v.parentSessionVersionId,v.manifestVersion,v.packObjectKey,v.packSha256,v.packSizeBytes,v.signatureAlgorithm,v.signatureKeyId,v.signatureValue,v.contentState,v.sealedByUserId,v.sealedAt,JSON.stringify(v)]);return sealedSessionVersionRecordSchema.parse(inserted.rows[0]!.record_json);});}
  async getVersion(id:string){const q=await this.#queryable();const r=await q.query<{record_json:SealedSessionVersionRecord}>("SELECT record_json FROM lingban_session_versions WHERE session_version_id=$1",[id]);return r.rows[0]?sealedSessionVersionRecordSchema.parse(r.rows[0].record_json):null;}
  async listVersions(sessionId:string){const q=await this.#queryable();const r=await q.query<{record_json:SealedSessionVersionRecord}>("SELECT record_json FROM lingban_session_versions WHERE session_id=$1 ORDER BY sealed_at DESC",[sessionId]);return r.rows.map(x=>sealedSessionVersionRecordSchema.parse(x.record_json));}
  async listAllVersions(){const q=await this.#queryable();const r=await q.query<{record_json:SealedSessionVersionRecord}>("SELECT record_json FROM lingban_session_versions ORDER BY sealed_at DESC");return r.rows.map(x=>sealedSessionVersionRecordSchema.parse(x.record_json));}
  async getPackageBinding(packageId:string,state?:"candidate"|"active"|"inactive"){const q=await this.#queryable();const r=await q.query<{record_json:CreatorPackageSessionBinding}>(`SELECT record_json FROM lingban_creator_package_session_bindings WHERE package_id=$1 AND ($2::text IS NULL OR binding_state=$2) ORDER BY updated_at DESC LIMIT 1`,[packageId,state??null]);return r.rows[0]?creatorPackageSessionBindingSchema.parse(r.rows[0].record_json):null;}
  async putPackageBinding(binding:CreatorPackageSessionBinding,expectedVersion:number){const b=creatorPackageSessionBindingSchema.parse(binding);return this.#options.withTransaction(async q=>{const current=await q.query<{version:number}>(`SELECT version FROM lingban_creator_package_session_bindings WHERE package_id=$1 AND binding_state=$2 ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,[b.packageId,b.state]);if((current.rows[0]?.version??0)!==expectedVersion)return null;if(b.state==="active")await q.query(`UPDATE lingban_creator_package_session_bindings SET binding_state='inactive',version=version+1,updated_at=$2,record_json=jsonb_set(jsonb_set(record_json,'{state}','"inactive"'::jsonb),'{version}',to_jsonb(version+1)) WHERE package_id=$1 AND binding_state='active'`,[b.packageId,b.updatedAt]);await q.query(`INSERT INTO lingban_creator_package_session_bindings (binding_id,package_id,session_version_id,binding_state,version,created_at,updated_at,record_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[b.bindingId,b.packageId,b.sessionVersionId,b.state,b.version,b.createdAt,b.updatedAt,JSON.stringify(b)]);return b;});}
  async getServiceBinding(input:{serviceId:string;workspaceContextKey:string;entrySurface:string;state?:"candidate"|"active"|"inactive"}){const q=await this.#queryable();const r=await q.query<{record_json:ServiceSessionBinding}>(`SELECT record_json FROM lingban_service_session_bindings WHERE service_id=$1 AND workspace_context_key=$2 AND entry_surface=$3 AND ($4::text IS NULL OR state=$4) ORDER BY updated_at DESC LIMIT 1`,[input.serviceId,input.workspaceContextKey,input.entrySurface,input.state??null]);return r.rows[0]?serviceSessionBindingSchema.parse(r.rows[0].record_json):null;}
  async listAllServiceBindings(){const q=await this.#queryable();const r=await q.query<{record_json:ServiceSessionBinding}>("SELECT record_json FROM lingban_service_session_bindings ORDER BY updated_at DESC");return r.rows.map(x=>serviceSessionBindingSchema.parse(x.record_json));}
  async putServiceBinding(binding:ServiceSessionBinding,expectedVersion:number){const b=serviceSessionBindingSchema.parse(binding);return this.#options.withTransaction(async q=>{const current=await q.query<{version:number}>(`SELECT version FROM lingban_service_session_bindings WHERE service_id=$1 AND workspace_context_key=$2 AND entry_surface=$3 AND state=$4 ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,[b.serviceId,b.workspaceContextKey,b.entrySurface,b.state]);if((current.rows[0]?.version??0)!==expectedVersion)return null;if(b.state==="active")await q.query(`UPDATE lingban_service_session_bindings SET state='inactive',version=version+1,updated_at=$4,record_json=jsonb_set(jsonb_set(record_json,'{state}','"inactive"'::jsonb),'{version}',to_jsonb(version+1)) WHERE service_id=$1 AND workspace_context_key=$2 AND entry_surface=$3 AND state='active'`,[b.serviceId,b.workspaceContextKey,b.entrySurface,b.updatedAt]);await q.query(`INSERT INTO lingban_service_session_bindings (binding_id,service_id,workspace_context_key,entry_surface,task_version_id,session_version_id,state,version,created_at,updated_at,record_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,[b.bindingId,b.serviceId,b.workspaceContextKey,b.entrySurface,b.taskVersionId,b.sessionVersionId,b.state,b.version,b.createdAt,b.updatedAt,JSON.stringify(b)]);return b;});}
}
