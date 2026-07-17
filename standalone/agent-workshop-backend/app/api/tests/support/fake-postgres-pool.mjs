function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function cloneDate(value) {
  return value == null ? value : new Date(value);
}

function compareValues(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  return String(left).localeCompare(String(right));
}

export function createFakePostgresPool() {
  const tables = {
    lingban_schema_migrations: [],
    lingban_users: [],
    lingban_workspaces: [],
    lingban_workspace_memberships: [],
    lingban_workspace_invitations: [],
    lingban_auth_sessions: [],
    lingban_run_uploads: [],
    lingban_download_tickets: [],
    lingban_workshop_contexts: [],
    lingban_catalog_workshops: [],
    lingban_catalog_services: [],
    lingban_catalog_launch_templates: [],
    lingban_creator_packages: [],
    lingban_creator_releases: [],
    lingban_creator_replays: [],
    lingban_creator_release_gates: [],
    lingban_creator_release_activations: [],
    lingban_creator_audit_exports: [],
    lingban_quota_policies: [],
    lingban_quota_counters: [],
    lingban_quota_events: [],
    lingban_quota_overrides: [],
    lingban_billing_entries: [],
    lingban_credentials: [],
    lingban_credential_materializations: [],
    lingban_credential_audit_events: [],
    lingban_credential_lifecycle_callback_deliveries: [],
    lingban_mcp_registry: [],
    lingban_mcp_bindings: [],
    lingban_mcp_network_policies: [],
    lingban_mcp_call_audits: [],
    lingban_mcp_health_snapshots: [],
    lingban_mcp_governance_events: [],
    lingban_me_favorite_workshops: [],
    lingban_me_recent_activities: [],
    lingban_notification_read_receipts: [],
    lingban_notification_read_cursors: [],
    lingban_search_history_entries: [],
    lingban_search_click_events: [],
    lingban_batch_run_jobs: [],
    lingban_batch_run_items: [],
    lingban_session_archives: [],
    lingban_session_capture_jobs: [],
    lingban_session_capture_access_audit: [],
    lingban_session_versions: [],
    lingban_service_session_bindings: [],
    lingban_runs: [],
    lingban_run_events: [],
    lingban_run_files: [],
    lingban_bridge_registrations: [],
    lingban_internal_callbacks: [],
    lingban_admin_resource_states: [],
    lingban_admin_audit_events: [],
    lingban_admin_settings: [],
    lingban_admin_operations: [],
  };

  async function query(sql, params = []) {
    const normalized = normalizeSql(sql);

    if (
      normalized.startsWith("create table") ||
      normalized.startsWith("create index") ||
      normalized.startsWith("create unique index") ||
      normalized === "begin" ||
      normalized === "commit" ||
      normalized === "rollback"
    ) {
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "select 1 as ready" || normalized === "select 1") {
      return {
        rows: [{ ready: 1 }],
        rowCount: 1,
      };
    }

    if (normalized === "select record_json from lingban_session_versions order by sealed_at desc") {
      const rows = [...tables.lingban_session_versions]
        .sort((left, right) => compareValues(right.sealed_at, left.sealed_at))
        .map((row) => ({ record_json: clone(row.record_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select record_json from lingban_session_capture_jobs where status in ('requested', 'retry_wait') and (next_retry_at is null or next_retry_at <= now()) and (lease_expires_at is null or lease_expires_at <= now()) and ($1::text is null or run_id = $1) order by requested_at asc"
    ) {
      const now = Date.now();
      const runId = params[0] ?? null;
      const rows = tables.lingban_session_capture_jobs
        .filter((row) => ["REQUESTED", "RETRY_WAIT"].includes(row.status))
        .filter((row) => !runId || row.run_id === runId)
        .filter((row) => !row.next_retry_at || Date.parse(row.next_retry_at) <= now)
        .filter((row) => !row.lease_expires_at || Date.parse(row.lease_expires_at) <= now)
        .sort((left, right) => compareValues(left.requested_at, right.requested_at))
        .map((row) => ({ record_json: clone(row.record_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select record_json from lingban_service_session_bindings order by updated_at desc") {
      const rows = [...tables.lingban_service_session_bindings]
        .sort((left, right) => compareValues(right.updated_at, left.updated_at))
        .map((row) => ({ record_json: clone(row.record_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select version from lingban_schema_migrations where version = $1") {
      const rows = tables.lingban_schema_migrations
        .filter((row) => row.version === params[0])
        .map((row) => ({ version: row.version }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select version, applied_at from lingban_schema_migrations order by applied_at asc, version asc"
    ) {
      const rows = [...tables.lingban_schema_migrations]
        .sort((left, right) =>
          compareValues(left.applied_at?.toISOString?.() ?? left.applied_at, right.applied_at?.toISOString?.() ?? right.applied_at) ||
          compareValues(left.version, right.version)
        )
        .map((row) => ({
          version: row.version,
          applied_at: cloneDate(row.applied_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "insert into lingban_schema_migrations (version) values ($1) on conflict (version) do nothing"
    ) {
      if (!tables.lingban_schema_migrations.some((row) => row.version === params[0])) {
        tables.lingban_schema_migrations.push({
          version: params[0],
          applied_at: new Date(),
        });
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized ===
      "select state_json from lingban_admin_resource_states order by updated_at desc"
    ) {
      const rows = [...tables.lingban_admin_resource_states]
        .sort((left, right) => compareValues(right.updated_at, left.updated_at))
        .map((row) => ({ state_json: clone(row.state_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select event_json from lingban_admin_audit_events order by occurred_at desc"
    ) {
      const rows = [...tables.lingban_admin_audit_events]
        .sort((left, right) => compareValues(right.occurred_at, left.occurred_at))
        .map((row) => ({ event_json: clone(row.event_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select setting_json from lingban_admin_settings order by setting_key asc"
    ) {
      const rows = [...tables.lingban_admin_settings]
        .sort((left, right) => compareValues(left.setting_key, right.setting_key))
        .map((row) => ({ setting_json: clone(row.setting_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select operation_json from lingban_admin_operations order by expires_at desc"
    ) {
      const rows = [...tables.lingban_admin_operations]
        .sort((left, right) => compareValues(right.expires_at, left.expires_at))
        .map((row) => ({ operation_json: clone(row.operation_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized.startsWith("insert into lingban_admin_resource_states")) {
      const record = {
        resource_type: params[0],
        resource_id: params[1],
        status: params[2],
        updated_at: params[3],
        state_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      };
      const index = tables.lingban_admin_resource_states.findIndex(
        (item) => item.resource_type === record.resource_type && item.resource_id === record.resource_id
      );
      if (index >= 0) tables.lingban_admin_resource_states[index] = record;
      else tables.lingban_admin_resource_states.push(record);
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_admin_audit_events")) {
      if (!tables.lingban_admin_audit_events.some((item) => item.event_id === params[0])) {
        tables.lingban_admin_audit_events.push({
          event_id: params[0],
          actor_user_id: params[1],
          action: params[2],
          resource_type: params[3],
          resource_id: params[4],
          outcome: params[5],
          occurred_at: params[6],
          event_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
        });
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_admin_settings")) {
      const record = {
        setting_key: params[0],
        version: params[1],
        updated_at: params[2],
        setting_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      };
      const index = tables.lingban_admin_settings.findIndex(
        (item) => item.setting_key === record.setting_key
      );
      if (index >= 0) tables.lingban_admin_settings[index] = record;
      else tables.lingban_admin_settings.push(record);
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_admin_operations")) {
      const record = {
        operation_id: params[0],
        resource_type: params[1],
        resource_id: params[2],
        action: params[3],
        expires_at: params[4],
        consumed_at: params[5],
        operation_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
      };
      const index = tables.lingban_admin_operations.findIndex(
        (item) => item.operation_id === record.operation_id
      );
      if (index >= 0) tables.lingban_admin_operations[index] = record;
      else tables.lingban_admin_operations.push(record);
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized ===
      "select idempotency_key, request_kind, run_id, trace_id, processed_at, response_json from lingban_internal_callbacks where idempotency_key = $1"
    ) {
      const row = tables.lingban_internal_callbacks.find(
        (item) => item.idempotency_key === params[0]
      );
      if (!row) {
        return { rows: [], rowCount: 0 };
      }

      return {
        rows: [
          {
            idempotency_key: row.idempotency_key,
            request_kind: row.request_kind,
            run_id: row.run_id,
            trace_id: row.trace_id,
            processed_at: row.processed_at,
            response_json: clone(row.response_json),
          },
        ],
        rowCount: 1,
      };
    }

    if (normalized.startsWith("insert into lingban_internal_callbacks")) {
      if (!tables.lingban_internal_callbacks.some((item) => item.idempotency_key === params[0])) {
        tables.lingban_internal_callbacks.push({
          idempotency_key: params[0],
          request_kind: params[1],
          run_id: params[2],
          trace_id: params[3],
          processed_at: new Date(params[4]),
          response_json: typeof params[5] === "string" ? JSON.parse(params[5]) : clone(params[5]),
        });
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select * from lingban_users order by created_at asc, user_id asc") {
      const rows = [...tables.lingban_users]
        .sort((left, right) =>
          compareValues(left.created_at.toISOString(), right.created_at.toISOString()) ||
          compareValues(left.user_id, right.user_id)
        )
        .map((row) => ({ ...row, created_at: cloneDate(row.created_at), updated_at: cloneDate(row.updated_at) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select * from lingban_workspaces order by created_at asc, workspace_id asc") {
      const rows = [...tables.lingban_workspaces]
        .sort((left, right) =>
          compareValues(left.created_at.toISOString(), right.created_at.toISOString()) ||
          compareValues(left.workspace_id, right.workspace_id)
        )
        .map((row) => ({ ...row, created_at: cloneDate(row.created_at), updated_at: cloneDate(row.updated_at) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select * from lingban_workspace_memberships order by created_at asc, workspace_id asc, user_id asc"
    ) {
      const rows = [...tables.lingban_workspace_memberships]
        .sort((left, right) =>
          compareValues(left.created_at.toISOString(), right.created_at.toISOString()) ||
          compareValues(left.workspace_id, right.workspace_id) ||
          compareValues(left.user_id, right.user_id)
        )
        .map((row) => ({ ...row, created_at: cloneDate(row.created_at), updated_at: cloneDate(row.updated_at) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select * from lingban_auth_sessions order by created_at asc, session_id asc") {
      const rows = [...tables.lingban_auth_sessions]
        .sort((left, right) =>
          compareValues(left.created_at.toISOString(), right.created_at.toISOString()) ||
          compareValues(left.session_id, right.session_id)
        )
        .map((row) => ({
          ...row,
          access_token_expires_at: cloneDate(row.access_token_expires_at),
          refresh_token_expires_at: cloneDate(row.refresh_token_expires_at),
          revoked_at: cloneDate(row.revoked_at),
          created_at: cloneDate(row.created_at),
          updated_at: cloneDate(row.updated_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select * from lingban_workspace_invitations order by created_at desc, invitation_id asc"
    ) {
      const rows = [...tables.lingban_workspace_invitations]
        .sort((left, right) =>
          compareValues(right.created_at.toISOString(), left.created_at.toISOString()) ||
          compareValues(left.invitation_id, right.invitation_id)
        )
        .map((row) => ({
          ...row,
          expires_at: cloneDate(row.expires_at),
          accepted_at: cloneDate(row.accepted_at),
          revoked_at: cloneDate(row.revoked_at),
          created_at: cloneDate(row.created_at),
          updated_at: cloneDate(row.updated_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_auth_sessions") {
      tables.lingban_auth_sessions = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_workspace_invitations") {
      tables.lingban_workspace_invitations = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_workspace_memberships") {
      tables.lingban_workspace_memberships = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_workspaces") {
      tables.lingban_workspaces = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_users") {
      tables.lingban_users = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_users")) {
      const row = {
        user_id: params[0],
        email: params[1],
        display_name: params[2],
        password_hash: params[3],
        created_at: new Date(params[4]),
        updated_at: new Date(params[5]),
      };
      const existingIndex = tables.lingban_users.findIndex((item) => item.user_id === row.user_id);
      if (existingIndex >= 0) {
        tables.lingban_users[existingIndex] = row;
      } else {
        tables.lingban_users.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_workspaces")) {
      const row = {
        workspace_id: params[0],
        slug: params[1],
        name: params[2],
        workspace_type: params[3],
        created_at: new Date(params[4]),
        updated_at: new Date(params[5]),
      };
      const existingIndex = tables.lingban_workspaces.findIndex(
        (item) => item.workspace_id === row.workspace_id
      );
      if (existingIndex >= 0) {
        tables.lingban_workspaces[existingIndex] = row;
      } else {
        tables.lingban_workspaces.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_workspace_memberships")) {
      const row = {
        workspace_id: params[0],
        user_id: params[1],
        role: params[2],
        status: params[3],
        created_at: new Date(params[4]),
        updated_at: new Date(params[5]),
      };
      const existingIndex = tables.lingban_workspace_memberships.findIndex(
        (item) => item.workspace_id === row.workspace_id && item.user_id === row.user_id
      );
      if (existingIndex >= 0) {
        tables.lingban_workspace_memberships[existingIndex] = row;
      } else {
        tables.lingban_workspace_memberships.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_auth_sessions")) {
      const row = {
        session_id: params[0],
        user_id: params[1],
        current_workspace_id: params[2],
        access_token_hash: params[3],
        refresh_token_hash: params[4],
        access_token_expires_at: new Date(params[5]),
        refresh_token_expires_at: new Date(params[6]),
        revoked_at: params[7] ? new Date(params[7]) : null,
        created_at: new Date(params[8]),
        updated_at: new Date(params[9]),
      };
      const existingIndex = tables.lingban_auth_sessions.findIndex(
        (item) => item.session_id === row.session_id
      );
      if (existingIndex >= 0) {
        tables.lingban_auth_sessions[existingIndex] = row;
      } else {
        tables.lingban_auth_sessions.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_workspace_invitations")) {
      const row = {
        invitation_id: params[0],
        workspace_id: params[1],
        email: params[2],
        role: params[3],
        status: params[4],
        invited_by_user_id: params[5],
        accepted_by_user_id: params[6],
        accept_token_hash: params[7],
        accept_token_preview: params[8],
        note: params[9],
        expires_at: new Date(params[10]),
        accepted_at: params[11] ? new Date(params[11]) : null,
        revoked_at: params[12] ? new Date(params[12]) : null,
        created_at: new Date(params[13]),
        updated_at: new Date(params[14]),
      };
      const existingIndex = tables.lingban_workspace_invitations.findIndex(
        (item) => item.invitation_id === row.invitation_id
      );
      if (existingIndex >= 0) {
        tables.lingban_workspace_invitations[existingIndex] = row;
      } else {
        tables.lingban_workspace_invitations.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized ===
      "select job_json from lingban_batch_run_jobs order by updated_at desc, batch_job_id asc"
    ) {
      const rows = [...tables.lingban_batch_run_jobs]
        .sort((left, right) =>
          compareValues(right.updated_at, left.updated_at) ||
          compareValues(left.batch_job_id, right.batch_job_id)
        )
        .map((row) => ({ job_json: clone(row.job_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select item_json from lingban_batch_run_items order by batch_job_id asc, row_index asc, batch_item_id asc"
    ) {
      const rows = [...tables.lingban_batch_run_items]
        .sort((left, right) =>
          compareValues(left.batch_job_id, right.batch_job_id) ||
          Number(left.row_index) - Number(right.row_index) ||
          compareValues(left.batch_item_id, right.batch_item_id)
        )
        .map((row) => ({ item_json: clone(row.item_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_batch_run_items") {
      tables.lingban_batch_run_items = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_batch_run_jobs") {
      tables.lingban_batch_run_jobs = [];
      return { rows: [], rowCount: 0 };
    }

    if (
      normalized ===
      "select archive_record_json from lingban_session_archives order by updated_at desc, session_version_id asc"
    ) {
      const rows = [...tables.lingban_session_archives]
        .sort((left, right) =>
          compareValues(right.updated_at, left.updated_at) ||
          compareValues(left.session_version_id, right.session_version_id)
        )
        .map((row) => ({ archive_record_json: clone(row.archive_record_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_session_archives") {
      tables.lingban_session_archives = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_batch_run_items where batch_job_id = $1") {
      tables.lingban_batch_run_items = tables.lingban_batch_run_items.filter(
        (row) => row.batch_job_id !== params[0]
      );
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_batch_run_jobs")) {
      const row = {
        batch_job_id: params[0],
        workspace_id: params[1],
        workspace_context_key: params[2],
        service_id: params[3],
        status: params[4],
        created_at: params[5],
        updated_at: params[6],
        job_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
      };
      const existingIndex = tables.lingban_batch_run_jobs.findIndex(
        (item) => item.batch_job_id === row.batch_job_id
      );
      if (existingIndex >= 0) {
        tables.lingban_batch_run_jobs[existingIndex] = row;
      } else {
        tables.lingban_batch_run_jobs.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_batch_run_items")) {
      const row = {
        batch_item_id: params[0],
        batch_job_id: params[1],
        row_index: params[2],
        status: params[3],
        run_id: params[4],
        created_at: params[5],
        updated_at: params[6],
        item_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
      };
      const existingIndex = tables.lingban_batch_run_items.findIndex(
        (item) => item.batch_item_id === row.batch_item_id
      );
      if (existingIndex >= 0) {
        tables.lingban_batch_run_items[existingIndex] = row;
      } else {
        tables.lingban_batch_run_items.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_session_archives")) {
      const row = {
        session_version_id: params[0],
        archive_source: params[1],
        imported_at: params[2],
        updated_at: params[3],
        runtime_source_run_id: params[4],
        archive_record_json:
          typeof params[5] === "string" ? JSON.parse(params[5]) : clone(params[5]),
      };
      const existingIndex = tables.lingban_session_archives.findIndex(
        (item) => item.session_version_id === row.session_version_id
      );
      if (existingIndex >= 0) {
        tables.lingban_session_archives[existingIndex] = row;
      } else {
        tables.lingban_session_archives.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select upload_json from lingban_run_uploads order by created_at asc, upload_id asc") {
      const rows = [...tables.lingban_run_uploads]
        .sort((left, right) =>
          compareValues(left.created_at, right.created_at) ||
          compareValues(left.upload_id, right.upload_id)
        )
        .map((row) => ({ upload_json: clone(row.upload_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select ticket_json from lingban_download_tickets order by created_at asc, ticket_id asc") {
      const rows = [...tables.lingban_download_tickets]
        .sort((left, right) =>
          compareValues(left.created_at, right.created_at) ||
          compareValues(left.ticket_id, right.ticket_id)
        )
        .map((row) => ({ ticket_json: clone(row.ticket_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_download_tickets") {
      tables.lingban_download_tickets = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_run_uploads") {
      tables.lingban_run_uploads = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_run_uploads")) {
      const row = {
        upload_id: params[0],
        run_id: params[1],
        workspace_id: params[2],
        status: params[3],
        file_name: params[4],
        object_key: params[5],
        created_at: params[6],
        updated_at: params[7],
        upload_json: typeof params[8] === "string" ? JSON.parse(params[8]) : clone(params[8]),
      };
      const existingIndex = tables.lingban_run_uploads.findIndex(
        (item) => item.upload_id === row.upload_id
      );
      if (existingIndex >= 0) {
        tables.lingban_run_uploads[existingIndex] = row;
      } else {
        tables.lingban_run_uploads.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_download_tickets")) {
      const row = {
        ticket_id: params[0],
        run_id: params[1],
        workspace_id: params[2],
        expires_at: params[3],
        created_at: params[4],
        ticket_json: typeof params[5] === "string" ? JSON.parse(params[5]) : clone(params[5]),
      };
      const existingIndex = tables.lingban_download_tickets.findIndex(
        (item) => item.ticket_id === row.ticket_id
      );
      if (existingIndex >= 0) {
        tables.lingban_download_tickets[existingIndex] = row;
      } else {
        tables.lingban_download_tickets.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select context_json from lingban_workshop_contexts order by context_key asc") {
      const rows = [...tables.lingban_workshop_contexts]
        .sort((left, right) => compareValues(left.context_key, right.context_key))
        .map((row) => ({ context_json: clone(row.context_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select workshop_json from lingban_catalog_workshops order by workshop_id asc") {
      const rows = [...tables.lingban_catalog_workshops]
        .sort((left, right) => compareValues(left.workshop_id, right.workshop_id))
        .map((row) => ({ workshop_json: clone(row.workshop_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select service_json from lingban_catalog_services order by service_id asc") {
      const rows = [...tables.lingban_catalog_services]
        .sort((left, right) => compareValues(left.service_id, right.service_id))
        .map((row) => ({ service_json: clone(row.service_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select template_json from lingban_catalog_launch_templates order by template_key asc") {
      const rows = [...tables.lingban_catalog_launch_templates]
        .sort((left, right) => compareValues(left.template_key, right.template_key))
        .map((row) => ({ template_json: clone(row.template_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_catalog_launch_templates") {
      tables.lingban_catalog_launch_templates = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_catalog_services") {
      tables.lingban_catalog_services = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_catalog_workshops") {
      tables.lingban_catalog_workshops = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_workshop_contexts") {
      tables.lingban_workshop_contexts = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_workshop_contexts")) {
      tables.lingban_workshop_contexts.push({
        context_key: params[0],
        runtime_workspace_id: params[1],
        context_json: typeof params[2] === "string" ? JSON.parse(params[2]) : clone(params[2]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_catalog_workshops")) {
      tables.lingban_catalog_workshops.push({
        workshop_id: params[0],
        scope: params[1],
        status: params[2],
        workshop_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_catalog_services")) {
      tables.lingban_catalog_services.push({
        service_id: params[0],
        workshop_id: params[1],
        status: params[2],
        service_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_catalog_launch_templates")) {
      tables.lingban_catalog_launch_templates.push({
        template_key: params[0],
        service_id: params[1],
        workspace_context_key: params[2],
        entry_surface: params[3],
        template_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select package_json from lingban_creator_packages order by package_id asc") {
      const rows = [...tables.lingban_creator_packages]
        .sort((left, right) => compareValues(left.package_id, right.package_id))
        .map((row) => ({ package_json: clone(row.package_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select release_json from lingban_creator_releases order by release_id asc") {
      const rows = [...tables.lingban_creator_releases]
        .sort((left, right) => compareValues(left.release_id, right.release_id))
        .map((row) => ({ release_json: clone(row.release_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select replay_json from lingban_creator_replays order by replay_id asc") {
      const rows = [...tables.lingban_creator_replays]
        .sort((left, right) => compareValues(left.replay_id, right.replay_id))
        .map((row) => ({ replay_json: clone(row.replay_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select gate_json from lingban_creator_release_gates order by gate_id asc") {
      const rows = [...tables.lingban_creator_release_gates]
        .sort((left, right) => compareValues(left.gate_id, right.gate_id))
        .map((row) => ({ gate_json: clone(row.gate_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select activation_json from lingban_creator_release_activations order by activation_id asc") {
      const rows = [...tables.lingban_creator_release_activations]
        .sort((left, right) => compareValues(left.activation_id, right.activation_id))
        .map((row) => ({ activation_json: clone(row.activation_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select export_json from lingban_creator_audit_exports order by created_at desc, export_id asc") {
      const rows = [...tables.lingban_creator_audit_exports]
        .sort((left, right) =>
          compareValues(right.created_at, left.created_at) ||
          compareValues(left.export_id, right.export_id)
        )
        .map((row) => ({ export_json: clone(row.export_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select policy_json from lingban_quota_policies order by updated_at desc, policy_id asc") {
      const rows = [...tables.lingban_quota_policies]
        .sort((left, right) =>
          compareValues(right.updated_at, left.updated_at) ||
          compareValues(left.policy_id, right.policy_id)
        )
        .map((row) => ({ policy_json: clone(row.policy_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select counter_json from lingban_quota_counters order by updated_at desc, counter_id asc") {
      const rows = [...tables.lingban_quota_counters]
        .sort((left, right) =>
          compareValues(right.updated_at, left.updated_at) ||
          compareValues(left.counter_id, right.counter_id)
        )
        .map((row) => ({ counter_json: clone(row.counter_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select event_json from lingban_quota_events order by occurred_at desc, event_id asc") {
      const rows = [...tables.lingban_quota_events]
        .sort((left, right) =>
          compareValues(right.occurred_at, left.occurred_at) ||
          compareValues(left.event_id, right.event_id)
        )
        .map((row) => ({ event_json: clone(row.event_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select override_json from lingban_quota_overrides order by requested_at desc, override_id asc") {
      const rows = [...tables.lingban_quota_overrides]
        .sort((left, right) =>
          compareValues(right.requested_at, left.requested_at) ||
          compareValues(left.override_id, right.override_id)
        )
        .map((row) => ({ override_json: clone(row.override_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select entry_json from lingban_billing_entries order by occurred_at desc, entry_id asc") {
      const rows = [...tables.lingban_billing_entries]
        .sort((left, right) =>
          compareValues(right.occurred_at, left.occurred_at) ||
          compareValues(left.entry_id, right.entry_id)
        )
        .map((row) => ({ entry_json: clone(row.entry_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_creator_replays") {
      tables.lingban_creator_replays = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_creator_release_activations") {
      tables.lingban_creator_release_activations = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_creator_release_gates") {
      tables.lingban_creator_release_gates = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_creator_releases") {
      tables.lingban_creator_releases = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_creator_packages") {
      tables.lingban_creator_packages = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_creator_audit_exports") {
      tables.lingban_creator_audit_exports = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_quota_overrides") {
      tables.lingban_quota_overrides = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_quota_events") {
      tables.lingban_quota_events = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_quota_counters") {
      tables.lingban_quota_counters = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_quota_policies") {
      tables.lingban_quota_policies = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_billing_entries") {
      tables.lingban_billing_entries = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_creator_packages")) {
      tables.lingban_creator_packages.push({
        package_id: params[0],
        state: params[1],
        package_json: typeof params[2] === "string" ? JSON.parse(params[2]) : clone(params[2]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_releases")) {
      tables.lingban_creator_releases.push({
        release_id: params[0],
        package_id: params[1],
        state: params[2],
        release_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_replays")) {
      tables.lingban_creator_replays.push({
        replay_id: params[0],
        package_id: params[1],
        state: params[2],
        replay_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_release_gates")) {
      tables.lingban_creator_release_gates.push({
        gate_id: params[0],
        release_id: params[1],
        package_id: params[2],
        status: params[3],
        gate_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_release_activations")) {
      tables.lingban_creator_release_activations.push({
        activation_id: params[0],
        release_id: params[1],
        package_id: params[2],
        state: params[3],
        activation_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_audit_exports")) {
      tables.lingban_creator_audit_exports.push({
        export_id: params[0],
        package_id: params[1],
        workspace_context_key: params[2],
        export_format: params[3],
        status: params[4],
        created_at: params[5],
        export_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_quota_policies")) {
      tables.lingban_quota_policies.push({
        policy_id: params[0],
        workspace_id: params[1],
        scope_type: params[2],
        scope_ref_id: params[3],
        metric: params[4],
        status: params[5],
        enabled: params[6],
        updated_at: params[7],
        policy_json: typeof params[8] === "string" ? JSON.parse(params[8]) : clone(params[8]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_quota_counters")) {
      tables.lingban_quota_counters.push({
        counter_id: params[0],
        policy_id: params[1],
        workspace_id: params[2],
        scope_type: params[3],
        scope_ref_id: params[4],
        metric: params[5],
        window_started_at: params[6],
        window_ends_at: params[7],
        updated_at: params[8],
        counter_json: typeof params[9] === "string" ? JSON.parse(params[9]) : clone(params[9]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_quota_events")) {
      tables.lingban_quota_events.push({
        event_id: params[0],
        policy_id: params[1],
        workspace_id: params[2],
        scope_type: params[3],
        scope_ref_id: params[4],
        metric: params[5],
        decision: params[6],
        occurred_at: params[7],
        event_json: typeof params[8] === "string" ? JSON.parse(params[8]) : clone(params[8]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_quota_overrides")) {
      tables.lingban_quota_overrides.push({
        override_id: params[0],
        policy_id: params[1],
        workspace_id: params[2],
        scope_type: params[3],
        scope_ref_id: params[4],
        metric: params[5],
        status: params[6],
        requested_at: params[7],
        override_json: typeof params[8] === "string" ? JSON.parse(params[8]) : clone(params[8]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_billing_entries")) {
      const row = {
        entry_id: params[0],
        workspace_id: params[1],
        package_id: params[2],
        service_id: params[3],
        run_id: params[4],
        metric: params[5],
        source: params[6],
        occurred_at: params[7],
        entry_json: typeof params[8] === "string" ? JSON.parse(params[8]) : clone(params[8]),
      };
      const existingIndex = tables.lingban_billing_entries.findIndex(
        (item) => item.entry_id === row.entry_id
      );
      if (existingIndex >= 0) {
        tables.lingban_billing_entries[existingIndex] = row;
      } else {
        tables.lingban_billing_entries.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select credential_json from lingban_credentials order by credential_id asc") {
      const rows = [...tables.lingban_credentials]
        .sort((left, right) => compareValues(left.credential_id, right.credential_id))
        .map((row) => ({ credential_json: clone(row.credential_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select lease_json from lingban_credential_materializations order by issued_at asc, lease_id asc"
    ) {
      const rows = [...tables.lingban_credential_materializations]
        .sort((left, right) =>
          compareValues(left.issued_at, right.issued_at) ||
          compareValues(left.lease_id, right.lease_id)
        )
        .map((row) => ({ lease_json: clone(row.lease_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select event_json from lingban_credential_audit_events order by occurred_at desc, event_id asc"
    ) {
      const rows = [...tables.lingban_credential_audit_events]
        .sort((left, right) =>
          compareValues(right.occurred_at, left.occurred_at) ||
          compareValues(left.event_id, right.event_id)
        )
        .map((row) => ({ event_json: clone(row.event_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select delivery_json from lingban_credential_lifecycle_callback_deliveries order by created_at desc, delivery_id asc"
    ) {
      const rows = [...tables.lingban_credential_lifecycle_callback_deliveries]
        .sort((left, right) =>
          compareValues(right.created_at, left.created_at) ||
          compareValues(left.delivery_id, right.delivery_id)
        )
        .map((row) => ({ delivery_json: clone(row.delivery_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_credentials") {
      tables.lingban_credentials = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_credential_materializations") {
      tables.lingban_credential_materializations = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_credential_audit_events") {
      tables.lingban_credential_audit_events = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_credential_lifecycle_callback_deliveries") {
      tables.lingban_credential_lifecycle_callback_deliveries = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_credentials")) {
      tables.lingban_credentials.push({
        credential_id: params[0],
        workspace_id: params[1],
        owner_user_id: params[2],
        scope: params[3],
        status: params[4],
        provider: params[5],
        credential_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_credential_materializations")) {
      tables.lingban_credential_materializations.push({
        lease_id: params[0],
        run_id: params[1],
        workspace_id: params[2],
        issued_at: params[3],
        expires_at: params[4],
        lease_json: typeof params[5] === "string" ? JSON.parse(params[5]) : clone(params[5]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_credential_audit_events")) {
      tables.lingban_credential_audit_events.push({
        event_id: params[0],
        credential_id: params[1],
        workspace_id: params[2],
        run_id: params[3],
        action: params[4],
        outcome: params[5],
        occurred_at: params[6],
        event_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_credential_lifecycle_callback_deliveries")) {
      tables.lingban_credential_lifecycle_callback_deliveries.push({
        delivery_id: params[0],
        credential_id: params[1],
        workspace_id: params[2],
        provider: params[3],
        target_status: params[4],
        status: params[5],
        next_attempt_at: params[6],
        created_at: params[7],
        updated_at: params[8],
        delivery_json: typeof params[9] === "string" ? JSON.parse(params[9]) : clone(params[9]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select mcp_json from lingban_mcp_registry order by mcp_id asc") {
      const rows = [...tables.lingban_mcp_registry]
        .sort((left, right) => compareValues(left.mcp_id, right.mcp_id))
        .map((row) => ({ mcp_json: clone(row.mcp_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select binding_json from lingban_mcp_bindings order by binding_id asc") {
      const rows = [...tables.lingban_mcp_bindings]
        .sort((left, right) => compareValues(left.binding_id, right.binding_id))
        .map((row) => ({ binding_json: clone(row.binding_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select policy_json from lingban_mcp_network_policies order by policy_ref asc") {
      const rows = [...tables.lingban_mcp_network_policies]
        .sort((left, right) => compareValues(left.policy_ref, right.policy_ref))
        .map((row) => ({ policy_json: clone(row.policy_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select snapshot_json from lingban_mcp_health_snapshots order by probed_at desc, snapshot_id asc"
    ) {
      const rows = [...tables.lingban_mcp_health_snapshots]
        .sort((left, right) =>
          compareValues(right.probed_at, left.probed_at) ||
          compareValues(left.snapshot_id, right.snapshot_id)
        )
        .map((row) => ({ snapshot_json: clone(row.snapshot_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select call_json from lingban_mcp_call_audits order by occurred_at desc, call_id asc"
    ) {
      const rows = [...tables.lingban_mcp_call_audits]
        .sort((left, right) =>
          compareValues(right.occurred_at, left.occurred_at) ||
          compareValues(left.call_id, right.call_id)
        )
        .map((row) => ({ call_json: clone(row.call_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select event_json from lingban_mcp_governance_events order by occurred_at desc, event_id asc"
    ) {
      const rows = [...tables.lingban_mcp_governance_events]
        .sort((left, right) =>
          compareValues(right.occurred_at, left.occurred_at) ||
          compareValues(left.event_id, right.event_id)
        )
        .map((row) => ({ event_json: clone(row.event_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select favorite_json from lingban_me_favorite_workshops order by updated_at desc, workshop_id asc"
    ) {
      const rows = [...tables.lingban_me_favorite_workshops]
        .sort((left, right) =>
          compareValues(right.updated_at, left.updated_at) ||
          compareValues(left.workshop_id, right.workshop_id)
        )
        .map((row) => ({ favorite_json: clone(row.favorite_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select activity_json from lingban_me_recent_activities order by updated_at desc, resource_type asc, resource_id asc"
    ) {
      const rows = [...tables.lingban_me_recent_activities]
        .sort((left, right) =>
          compareValues(right.updated_at, left.updated_at) ||
          compareValues(left.resource_type, right.resource_type) ||
          compareValues(left.resource_id, right.resource_id)
        )
        .map((row) => ({ activity_json: clone(row.activity_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select receipt_json from lingban_notification_read_receipts order by read_at desc, notification_id asc"
    ) {
      const rows = [...tables.lingban_notification_read_receipts]
        .sort((left, right) =>
          compareValues(right.read_at, left.read_at) ||
          compareValues(left.notification_id, right.notification_id)
        )
        .map((row) => ({ receipt_json: clone(row.receipt_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select cursor_json from lingban_notification_read_cursors order by marked_all_read_at desc, workspace_id asc, user_id asc"
    ) {
      const rows = [...tables.lingban_notification_read_cursors]
        .sort((left, right) =>
          compareValues(right.marked_all_read_at, left.marked_all_read_at) ||
          compareValues(left.workspace_id, right.workspace_id) ||
          compareValues(left.user_id, right.user_id)
        )
        .map((row) => ({ cursor_json: clone(row.cursor_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select history_json from lingban_search_history_entries order by updated_at desc, query asc"
    ) {
      const rows = [...tables.lingban_search_history_entries]
        .sort((left, right) =>
          compareValues(right.updated_at, left.updated_at) ||
          compareValues(left.query, right.query)
        )
        .map((row) => ({ history_json: clone(row.history_json) }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select event_json from lingban_search_click_events order by occurred_at desc, rank asc, event_id asc"
    ) {
      const rows = [...tables.lingban_search_click_events]
        .sort((left, right) =>
          compareValues(right.occurred_at, left.occurred_at) ||
          compareValues(left.rank, right.rank) ||
          compareValues(left.event_id, right.event_id)
        )
        .map((row) => ({ event_json: clone(row.event_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_mcp_bindings") {
      tables.lingban_mcp_bindings = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_network_policies") {
      tables.lingban_mcp_network_policies = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_health_snapshots") {
      tables.lingban_mcp_health_snapshots = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_registry") {
      tables.lingban_mcp_registry = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_call_audits") {
      tables.lingban_mcp_call_audits = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_governance_events") {
      tables.lingban_mcp_governance_events = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_me_favorite_workshops") {
      tables.lingban_me_favorite_workshops = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_me_recent_activities") {
      tables.lingban_me_recent_activities = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_notification_read_receipts") {
      tables.lingban_notification_read_receipts = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_notification_read_cursors") {
      tables.lingban_notification_read_cursors = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_search_history_entries") {
      tables.lingban_search_history_entries = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_search_click_events") {
      tables.lingban_search_click_events = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_mcp_registry")) {
      tables.lingban_mcp_registry.push({
        mcp_id: params[0],
        workspace_id: params[1],
        source: params[2],
        status: params[3],
        risk_level: params[4],
        mcp_json: typeof params[5] === "string" ? JSON.parse(params[5]) : clone(params[5]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_mcp_bindings")) {
      tables.lingban_mcp_bindings.push({
        binding_id: params[0],
        mcp_id: params[1],
        workspace_id: params[2],
        scope: params[3],
        scope_ref: params[4],
        status: params[5],
        credential_id: params[6],
        binding_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_mcp_network_policies")) {
      tables.lingban_mcp_network_policies.push({
        policy_ref: params[0],
        workspace_id: params[1],
        status: params[2],
        policy_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_mcp_health_snapshots")) {
      tables.lingban_mcp_health_snapshots.push({
        snapshot_id: params[0],
        mcp_id: params[1],
        binding_id: params[2],
        workspace_id: params[3],
        status: params[4],
        probed_at: params[5],
        snapshot_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_mcp_call_audits")) {
      const row = {
        call_id: params[0],
        run_id: params[1],
        workspace_id: params[2],
        mcp_id: params[3],
        tool_name: params[4],
        status: params[5],
        occurred_at: params[6],
        call_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
      };
      const existingIndex = tables.lingban_mcp_call_audits.findIndex(
        (item) => item.call_id === row.call_id
      );
      if (existingIndex >= 0) {
        tables.lingban_mcp_call_audits[existingIndex] = row;
      } else {
        tables.lingban_mcp_call_audits.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_mcp_governance_events")) {
      const row = {
        event_id: params[0],
        workspace_id: params[1],
        run_id: params[2],
        mcp_id: params[3],
        binding_id: params[4],
        action: params[5],
        outcome: params[6],
        occurred_at: params[7],
        event_json: typeof params[8] === "string" ? JSON.parse(params[8]) : clone(params[8]),
      };
      const existingIndex = tables.lingban_mcp_governance_events.findIndex(
        (item) => item.event_id === row.event_id
      );
      if (existingIndex >= 0) {
        tables.lingban_mcp_governance_events[existingIndex] = row;
      } else {
        tables.lingban_mcp_governance_events.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized.startsWith("insert into lingban_notification_read_receipts") &&
      normalized.includes("on conflict (user_id, workspace_id, notification_id) do update set")
    ) {
      const row = {
        notification_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        read_at: params[3],
        receipt_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      };
      const existingIndex = tables.lingban_notification_read_receipts.findIndex(
        (item) =>
          item.user_id === row.user_id &&
          item.workspace_id === row.workspace_id &&
          item.notification_id === row.notification_id
      );
      if (existingIndex >= 0) {
        tables.lingban_notification_read_receipts[existingIndex] = row;
      } else {
        tables.lingban_notification_read_receipts.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized.startsWith("insert into lingban_notification_read_cursors") &&
      normalized.includes("on conflict (user_id, workspace_id) do update set")
    ) {
      const row = {
        user_id: params[0],
        workspace_id: params[1],
        marked_all_read_at: params[2],
        cursor_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      };
      const existingIndex = tables.lingban_notification_read_cursors.findIndex(
        (item) => item.user_id === row.user_id && item.workspace_id === row.workspace_id
      );
      if (existingIndex >= 0) {
        tables.lingban_notification_read_cursors[existingIndex] = row;
      } else {
        tables.lingban_notification_read_cursors.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized.startsWith("insert into lingban_me_favorite_workshops") &&
      normalized.includes("on conflict (user_id, workspace_context_key, workshop_id) do update set")
    ) {
      const row = {
        favorite_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        workspace_context_key: params[3],
        workshop_id: params[4],
        created_at: params[5],
        updated_at: params[6],
        favorite_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
      };
      const existingIndex = tables.lingban_me_favorite_workshops.findIndex(
        (item) =>
          item.user_id === row.user_id &&
          item.workspace_context_key === row.workspace_context_key &&
          item.workshop_id === row.workshop_id
      );
      if (existingIndex >= 0) {
        tables.lingban_me_favorite_workshops[existingIndex] = row;
      } else {
        tables.lingban_me_favorite_workshops.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized.startsWith("insert into lingban_me_recent_activities") &&
      normalized.includes("on conflict (user_id, workspace_context_key, resource_type, resource_id) do update set")
    ) {
      const row = {
        activity_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        workspace_context_key: params[3],
        resource_type: params[4],
        resource_id: params[5],
        interaction: params[6],
        source_surface: params[7],
        workshop_id: params[8],
        service_id: params[9],
        run_id: params[10],
        created_at: params[11],
        updated_at: params[12],
        activity_json: typeof params[13] === "string" ? JSON.parse(params[13]) : clone(params[13]),
      };
      const existingIndex = tables.lingban_me_recent_activities.findIndex(
        (item) =>
          item.user_id === row.user_id &&
          item.workspace_context_key === row.workspace_context_key &&
          item.resource_type === row.resource_type &&
          item.resource_id === row.resource_id
      );
      if (existingIndex >= 0) {
        tables.lingban_me_recent_activities[existingIndex] = row;
      } else {
        tables.lingban_me_recent_activities.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized.startsWith("insert into lingban_search_history_entries") &&
      normalized.includes("on conflict (user_id, workspace_context_key, normalized_query) do update set")
    ) {
      const row = {
        history_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        workspace_context_key: params[3],
        normalized_query: params[4],
        query: params[5],
        resource_types_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
        created_at: params[7],
        updated_at: params[8],
        history_json: typeof params[9] === "string" ? JSON.parse(params[9]) : clone(params[9]),
      };
      const existingIndex = tables.lingban_search_history_entries.findIndex(
        (item) =>
          item.user_id === row.user_id &&
          item.workspace_context_key === row.workspace_context_key &&
          item.normalized_query === row.normalized_query
      );
      if (existingIndex >= 0) {
        tables.lingban_search_history_entries[existingIndex] = row;
      } else {
        tables.lingban_search_history_entries.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "delete from lingban_me_favorite_workshops where user_id = $1 and workspace_context_key = $2 and workshop_id = $3") {
      const before = tables.lingban_me_favorite_workshops.length;
      tables.lingban_me_favorite_workshops = tables.lingban_me_favorite_workshops.filter(
        (item) =>
          !(
            item.user_id === params[0] &&
            item.workspace_context_key === params[1] &&
            item.workshop_id === params[2]
          )
      );
      return {
        rows: [],
        rowCount: before - tables.lingban_me_favorite_workshops.length,
      };
    }

    if (normalized === "delete from lingban_search_history_entries where user_id = $1 and workspace_context_key = $2") {
      const before = tables.lingban_search_history_entries.length;
      tables.lingban_search_history_entries = tables.lingban_search_history_entries.filter(
        (item) => !(item.user_id === params[0] && item.workspace_context_key === params[1])
      );
      return {
        rows: [],
        rowCount: before - tables.lingban_search_history_entries.length,
      };
    }

    if (normalized.startsWith("delete from lingban_search_history_entries where user_id = $1 and workspace_context_key = $2 and history_id not in (")) {
      const retainedIds = new Set(params.slice(2));
      const before = tables.lingban_search_history_entries.length;
      tables.lingban_search_history_entries = tables.lingban_search_history_entries.filter(
        (item) =>
          !(
            item.user_id === params[0] &&
            item.workspace_context_key === params[1] &&
            !retainedIds.has(item.history_id)
          )
      );
      return {
        rows: [],
        rowCount: before - tables.lingban_search_history_entries.length,
      };
    }

    if (normalized === "delete from lingban_search_click_events where user_id = $1 and workspace_context_key = $2") {
      const before = tables.lingban_search_click_events.length;
      tables.lingban_search_click_events = tables.lingban_search_click_events.filter(
        (item) => !(item.user_id === params[0] && item.workspace_context_key === params[1])
      );
      return {
        rows: [],
        rowCount: before - tables.lingban_search_click_events.length,
      };
    }

    if (normalized.startsWith("delete from lingban_search_click_events where user_id = $1 and workspace_context_key = $2 and event_id not in (")) {
      const retainedIds = new Set(params.slice(2));
      const before = tables.lingban_search_click_events.length;
      tables.lingban_search_click_events = tables.lingban_search_click_events.filter(
        (item) =>
          !(
            item.user_id === params[0] &&
            item.workspace_context_key === params[1] &&
            !retainedIds.has(item.event_id)
          )
      );
      return {
        rows: [],
        rowCount: before - tables.lingban_search_click_events.length,
      };
    }

    if (normalized.startsWith("insert into lingban_me_favorite_workshops")) {
      tables.lingban_me_favorite_workshops.push({
        favorite_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        workspace_context_key: params[3],
        workshop_id: params[4],
        created_at: params[5],
        updated_at: params[6],
        favorite_json: typeof params[7] === "string" ? JSON.parse(params[7]) : clone(params[7]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_me_recent_activities")) {
      tables.lingban_me_recent_activities.push({
        activity_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        workspace_context_key: params[3],
        resource_type: params[4],
        resource_id: params[5],
        interaction: params[6],
        source_surface: params[7],
        workshop_id: params[8],
        service_id: params[9],
        run_id: params[10],
        created_at: params[11],
        updated_at: params[12],
        activity_json: typeof params[13] === "string" ? JSON.parse(params[13]) : clone(params[13]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_notification_read_receipts")) {
      tables.lingban_notification_read_receipts.push({
        notification_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        read_at: params[3],
        receipt_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_notification_read_cursors")) {
      tables.lingban_notification_read_cursors.push({
        user_id: params[0],
        workspace_id: params[1],
        marked_all_read_at: params[2],
        cursor_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_search_history_entries")) {
      tables.lingban_search_history_entries.push({
        history_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        workspace_context_key: params[3],
        normalized_query: params[4],
        query: params[5],
        resource_types_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
        created_at: params[7],
        updated_at: params[8],
        history_json: typeof params[9] === "string" ? JSON.parse(params[9]) : clone(params[9]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_search_click_events")) {
      tables.lingban_search_click_events.push({
        event_id: params[0],
        user_id: params[1],
        workspace_id: params[2],
        workspace_context_key: params[3],
        normalized_query: params[4],
        query: params[5],
        document_id: params[6],
        resource_type: params[7],
        resource_id: params[8],
        rank: params[9],
        source_surface: params[10],
        occurred_at: params[11],
        event_json: typeof params[12] === "string" ? JSON.parse(params[12]) : clone(params[12]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select aggregate_json from lingban_runs order by created_at asc, run_id asc") {
      const rows = [...tables.lingban_runs]
        .sort((left, right) =>
          compareValues(left.created_at, right.created_at) ||
          compareValues(left.run_id, right.run_id)
        )
        .map((row) => ({ aggregate_json: clone(row.aggregate_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_runs") {
      tables.lingban_runs = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_runs")) {
      const existingIndex = tables.lingban_runs.findIndex((row) => row.run_id === params[0]);
      const row = {
        run_id: params[0],
        workspace_id: params[1],
        status: params[2],
        title: params[3],
        target_path: params[4],
        run_purpose: params[5],
        session_bootstrap_mode: params[6],
        session_project_id: params[7],
        task_version_id: params[8],
        session_version_id: params[9],
        workspace_context_key: params[10],
        service_id: params[11],
        created_at: params[12],
        updated_at: params[13],
        aggregate_json: typeof params[14] === "string" ? JSON.parse(params[14]) : clone(params[14]),
      };
      if (existingIndex >= 0) {
        tables.lingban_runs[existingIndex] = row;
      } else {
        tables.lingban_runs.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select event_id, run_id, event_json from lingban_run_events order by occurred_at asc, event_id asc") {
      const rows = [...tables.lingban_run_events]
        .sort((left, right) =>
          compareValues(left.occurred_at, right.occurred_at) ||
          compareValues(left.event_id, right.event_id)
        )
        .map((row) => ({
          event_id: row.event_id,
          run_id: row.run_id,
          event_json: clone(row.event_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "insert into lingban_run_events (event_id, run_id, event_type, occurred_at, event_json) values ($1, $2, $3, $4, $5::jsonb) on conflict (event_id) do nothing"
    ) {
      if (!tables.lingban_run_events.some((row) => row.event_id === params[0])) {
        tables.lingban_run_events.push({
          event_id: params[0],
          run_id: params[1],
          event_type: params[2],
          occurred_at: params[3],
          event_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
        });
      }
      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select file_json from lingban_run_files order by run_id asc, logical_path asc") {
      const rows = [...tables.lingban_run_files]
        .sort((left, right) =>
          compareValues(left.run_id, right.run_id) ||
          compareValues(left.logical_path, right.logical_path)
        )
        .map((row) => ({ file_json: clone(row.file_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select bridge_json from lingban_bridge_registrations order by run_id asc") {
      const rows = [...tables.lingban_bridge_registrations]
        .sort((left, right) => compareValues(left.run_id, right.run_id))
        .map((row) => ({ bridge_json: clone(row.bridge_json) }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_run_files") {
      tables.lingban_run_files = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_bridge_registrations") {
      tables.lingban_bridge_registrations = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_run_files where run_id = $1") {
      tables.lingban_run_files = tables.lingban_run_files.filter((row) => row.run_id !== params[0]);
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_bridge_registrations where run_id = $1") {
      tables.lingban_bridge_registrations = tables.lingban_bridge_registrations.filter(
        (row) => row.run_id !== params[0]
      );
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_run_files")) {
      tables.lingban_run_files.push({
        run_id: params[0],
        workspace_id: params[1],
        logical_path: params[2],
        file_path: params[3],
        source: params[4],
        kind: params[5],
        mime_type: params[6],
        object_key: params[7],
        upload_id: params[8],
        updated_at: params[9],
        indexed_at: params[10],
        file_json: typeof params[11] === "string" ? JSON.parse(params[11]) : clone(params[11]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_bridge_registrations")) {
      const existingIndex = tables.lingban_bridge_registrations.findIndex(
        (row) => row.run_id === params[0]
      );
      const row = {
        run_id: params[0],
        bridge_id: params[1],
        workspace_id: params[2],
        target_path: params[3],
        connected_at: params[4],
        last_seen_at: params[5],
        bridge_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
      };
      if (existingIndex >= 0) {
        tables.lingban_bridge_registrations[existingIndex] = row;
      } else {
        tables.lingban_bridge_registrations.push(row);
      }
      return { rows: [], rowCount: 1 };
    }

    if (
      normalized ===
        "alter table lingban_mcp_registry alter column workspace_id drop not null" ||
      normalized ===
        "alter table lingban_mcp_bindings alter column workspace_id drop not null" ||
      normalized ===
        "alter table lingban_credentials alter column owner_user_id drop not null"
    ) {
      return { rows: [], rowCount: 0 };
    }

    if (
      normalized.startsWith("alter table lingban_session_") ||
      normalized.startsWith("alter table lingban_runs add column if not exists") ||
      normalized.startsWith("alter table lingban_runs drop constraint if exists") ||
      normalized.startsWith("alter table lingban_runs add constraint") ||
      normalized.startsWith("update lingban_runs set run_purpose =") ||
      normalized.startsWith("create or replace function lingban_reject_sealed_session_version_content_update") ||
      normalized.startsWith("create or replace function lingban_reject_session_capture_content_update") ||
      normalized.startsWith("drop trigger if exists trg_lingban_session_version_immutable") ||
      normalized.startsWith("create trigger trg_lingban_session_version_immutable") ||
      normalized.startsWith("drop trigger if exists trg_lingban_session_capture_") ||
      normalized.startsWith("create trigger trg_lingban_session_capture_")
    ) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unsupported fake postgres query: ${normalized}`);
  }

  return {
    async query(sql, params) {
      return query(sql, params);
    },
    async connect() {
      return {
        query,
        release() {
          return undefined;
        },
      };
    },
    async end() {
      return undefined;
    },
    __debugTables() {
      return clone(tables);
    },
  };
}
