import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createFakePostgresPool() {
  const applied = [];
  const history = [];
  let endCalls = 0;
  const tables = {
    lingban_users: [],
    lingban_workspaces: [],
    lingban_workspace_memberships: [],
    lingban_workspace_invitations: [],
    lingban_auth_sessions: [],
    lingban_runs: [],
    lingban_run_events: [],
    lingban_run_files: [],
    lingban_run_uploads: [],
    lingban_download_tickets: [],
    lingban_bridge_registrations: [],
    lingban_billing_entries: [],
    lingban_workshop_contexts: [],
    lingban_catalog_workshops: [],
    lingban_catalog_services: [],
    lingban_catalog_launch_templates: [],
    lingban_quota_policies: [],
    lingban_quota_counters: [],
    lingban_quota_events: [],
    lingban_quota_overrides: [],
    lingban_credentials: [],
    lingban_mcp_registry: [],
    lingban_mcp_bindings: [],
    lingban_mcp_network_policies: [],
    lingban_mcp_health_snapshots: [],
    lingban_creator_packages: [],
    lingban_creator_releases: [],
    lingban_creator_replays: [],
    lingban_creator_release_gates: [],
    lingban_creator_release_activations: [],
    lingban_creator_audit_exports: [],
    lingban_batch_run_jobs: [],
    lingban_batch_run_items: [],
    lingban_me_favorite_workshops: [],
    lingban_me_recent_activities: [],
    lingban_notification_read_receipts: [],
    lingban_notification_read_cursors: [],
    lingban_search_history_entries: [],
    lingban_search_click_events: [],
    lingban_session_archives: [],
  };

  async function query(sql, params = []) {
    const normalized = normalizeSql(sql);
    history.push(normalized);

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

    if (
      normalized ===
      "select version, applied_at from lingban_schema_migrations order by applied_at asc, version asc"
    ) {
      return {
        rows: applied
          .slice()
          .sort((left, right) => left.applied_at.localeCompare(right.applied_at) || left.version.localeCompare(right.version))
          .map((row) => ({ version: row.version, applied_at: new Date(row.applied_at) })),
        rowCount: applied.length,
      };
    }

    if (
      normalized ===
      "insert into lingban_schema_migrations (version) values ($1) on conflict (version) do nothing"
    ) {
      const version = String(params[0]);
      if (!applied.some((entry) => entry.version === version)) {
        applied.push({
          version,
          applied_at: new Date().toISOString(),
        });
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select * from lingban_users order by created_at asc, user_id asc") {
      const rows = [...tables.lingban_users]
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) || left.user_id.localeCompare(right.user_id)
        )
        .map((row) => ({
          user_id: row.user_id,
          email: row.email,
          display_name: row.display_name,
          password_hash: row.password_hash,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select * from lingban_workspaces order by created_at asc, workspace_id asc") {
      const rows = [...tables.lingban_workspaces]
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) ||
            left.workspace_id.localeCompare(right.workspace_id)
        )
        .map((row) => ({
          workspace_id: row.workspace_id,
          slug: row.slug,
          name: row.name,
          workspace_type: row.workspace_type,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select * from lingban_workspace_memberships order by created_at asc, workspace_id asc, user_id asc"
    ) {
      const rows = [...tables.lingban_workspace_memberships]
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) ||
            left.workspace_id.localeCompare(right.workspace_id) ||
            left.user_id.localeCompare(right.user_id)
        )
        .map((row) => ({
          workspace_id: row.workspace_id,
          user_id: row.user_id,
          role: row.role,
          status: row.status,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select * from lingban_workspace_invitations order by created_at desc, invitation_id asc"
    ) {
      const rows = [...tables.lingban_workspace_invitations]
        .sort(
          (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            left.invitation_id.localeCompare(right.invitation_id)
        )
        .map((row) => ({
          invitation_id: row.invitation_id,
          workspace_id: row.workspace_id,
          email: row.email,
          role: row.role,
          status: row.status,
          invited_by_user_id: row.invited_by_user_id,
          accepted_by_user_id: row.accepted_by_user_id,
          accept_token_hash: row.accept_token_hash,
          accept_token_preview: row.accept_token_preview,
          note: row.note,
          expires_at: new Date(row.expires_at),
          accepted_at: row.accepted_at ? new Date(row.accepted_at) : null,
          revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select * from lingban_auth_sessions order by created_at asc, session_id asc") {
      const rows = [...tables.lingban_auth_sessions]
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) ||
            left.session_id.localeCompare(right.session_id)
        )
        .map((row) => ({
          session_id: row.session_id,
          user_id: row.user_id,
          current_workspace_id: row.current_workspace_id,
          access_token_hash: row.access_token_hash,
          refresh_token_hash: row.refresh_token_hash,
          access_token_expires_at: new Date(row.access_token_expires_at),
          refresh_token_expires_at: new Date(row.refresh_token_expires_at),
          revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select aggregate_json from lingban_runs order by created_at asc, run_id asc") {
      const rows = [...tables.lingban_runs]
        .sort((left, right) => left.created_at.localeCompare(right.created_at) || left.run_id.localeCompare(right.run_id))
        .map((row) => ({
          aggregate_json: clone(row.aggregate_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_runs") {
      tables.lingban_runs = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_runs")) {
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
      const existingIndex = tables.lingban_runs.findIndex((item) => item.run_id === row.run_id);

      if (existingIndex >= 0) {
        tables.lingban_runs[existingIndex] = row;
      } else {
        tables.lingban_runs.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalized === "select event_id, run_id, event_json from lingban_run_events order by occurred_at asc, event_id asc") {
      const rows = [...tables.lingban_run_events]
        .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at) || left.event_id.localeCompare(right.event_id))
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
        .sort((left, right) => left.run_id.localeCompare(right.run_id) || left.logical_path.localeCompare(right.logical_path))
        .map((row) => ({
          file_json: clone(row.file_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_run_files") {
      tables.lingban_run_files = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_run_files where run_id = $1") {
      tables.lingban_run_files = tables.lingban_run_files.filter((row) => row.run_id !== params[0]);
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

    if (normalized === "select upload_json from lingban_run_uploads order by created_at asc, upload_id asc") {
      const rows = [...tables.lingban_run_uploads]
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) ||
            left.upload_id.localeCompare(right.upload_id)
        )
        .map((row) => ({
          upload_json: clone(row.upload_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized === "select ticket_json from lingban_download_tickets order by created_at asc, ticket_id asc"
    ) {
      const rows = [...tables.lingban_download_tickets]
        .sort(
          (left, right) =>
            left.created_at.localeCompare(right.created_at) ||
            left.ticket_id.localeCompare(right.ticket_id)
        )
        .map((row) => ({
          ticket_json: clone(row.ticket_json),
        }));
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

    if (normalized === "select bridge_json from lingban_bridge_registrations order by run_id asc") {
      const rows = [...tables.lingban_bridge_registrations]
        .sort((left, right) => left.run_id.localeCompare(right.run_id))
        .map((row) => ({
          bridge_json: clone(row.bridge_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized === "select entry_json from lingban_billing_entries order by occurred_at desc, entry_id asc"
    ) {
      const rows = [...tables.lingban_billing_entries]
        .sort(
          (left, right) =>
            right.occurred_at.localeCompare(left.occurred_at) ||
            left.entry_id.localeCompare(right.entry_id)
        )
        .map((row) => ({
          entry_json: clone(row.entry_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select context_json from lingban_workshop_contexts order by context_key asc") {
      const rows = [...tables.lingban_workshop_contexts]
        .sort((left, right) => left.context_key.localeCompare(right.context_key))
        .map((row) => ({
          context_json: clone(row.context_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select workshop_json from lingban_catalog_workshops order by workshop_id asc") {
      const rows = [...tables.lingban_catalog_workshops]
        .sort((left, right) => left.workshop_id.localeCompare(right.workshop_id))
        .map((row) => ({
          workshop_json: clone(row.workshop_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select service_json from lingban_catalog_services order by service_id asc") {
      const rows = [...tables.lingban_catalog_services]
        .sort((left, right) => left.service_id.localeCompare(right.service_id))
        .map((row) => ({
          service_json: clone(row.service_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select template_json from lingban_catalog_launch_templates order by template_key asc") {
      const rows = [...tables.lingban_catalog_launch_templates]
        .sort((left, right) => left.template_key.localeCompare(right.template_key))
        .map((row) => ({
          template_json: clone(row.template_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized === "select policy_json from lingban_quota_policies order by updated_at desc, policy_id asc"
    ) {
      const rows = [...tables.lingban_quota_policies]
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            left.policy_id.localeCompare(right.policy_id)
        )
        .map((row) => ({
          policy_json: clone(row.policy_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized === "select counter_json from lingban_quota_counters order by updated_at desc, counter_id asc"
    ) {
      const rows = [...tables.lingban_quota_counters]
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            left.counter_id.localeCompare(right.counter_id)
        )
        .map((row) => ({
          counter_json: clone(row.counter_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized === "select event_json from lingban_quota_events order by occurred_at desc, event_id asc"
    ) {
      const rows = [...tables.lingban_quota_events]
        .sort(
          (left, right) =>
            right.occurred_at.localeCompare(left.occurred_at) ||
            left.event_id.localeCompare(right.event_id)
        )
        .map((row) => ({
          event_json: clone(row.event_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized === "select override_json from lingban_quota_overrides order by requested_at desc, override_id asc"
    ) {
      const rows = [...tables.lingban_quota_overrides]
        .sort(
          (left, right) =>
            right.requested_at.localeCompare(left.requested_at) ||
            left.override_id.localeCompare(right.override_id)
        )
        .map((row) => ({
          override_json: clone(row.override_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select credential_json from lingban_credentials order by credential_id asc") {
      const rows = [...tables.lingban_credentials]
        .sort((left, right) => left.credential_id.localeCompare(right.credential_id))
        .map((row) => ({
          credential_json: clone(row.credential_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select mcp_json from lingban_mcp_registry order by mcp_id asc") {
      const rows = [...tables.lingban_mcp_registry]
        .sort((left, right) => left.mcp_id.localeCompare(right.mcp_id))
        .map((row) => ({
          mcp_json: clone(row.mcp_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select binding_json from lingban_mcp_bindings order by binding_id asc") {
      const rows = [...tables.lingban_mcp_bindings]
        .sort((left, right) => left.binding_id.localeCompare(right.binding_id))
        .map((row) => ({
          binding_json: clone(row.binding_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select policy_json from lingban_mcp_network_policies order by policy_ref asc") {
      const rows = [...tables.lingban_mcp_network_policies]
        .sort((left, right) => left.policy_ref.localeCompare(right.policy_ref))
        .map((row) => ({
          policy_json: clone(row.policy_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select snapshot_json from lingban_mcp_health_snapshots order by probed_at desc, snapshot_id asc"
    ) {
      const rows = [...tables.lingban_mcp_health_snapshots]
        .sort(
          (left, right) =>
            right.probed_at.localeCompare(left.probed_at) ||
            left.snapshot_id.localeCompare(right.snapshot_id)
        )
        .map((row) => ({
          snapshot_json: clone(row.snapshot_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select package_json from lingban_creator_packages order by package_id asc") {
      const rows = [...tables.lingban_creator_packages]
        .sort((left, right) => left.package_id.localeCompare(right.package_id))
        .map((row) => ({
          package_json: clone(row.package_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select release_json from lingban_creator_releases order by release_id asc") {
      const rows = [...tables.lingban_creator_releases]
        .sort((left, right) => left.release_id.localeCompare(right.release_id))
        .map((row) => ({
          release_json: clone(row.release_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select replay_json from lingban_creator_replays order by replay_id asc") {
      const rows = [...tables.lingban_creator_replays]
        .sort((left, right) => left.replay_id.localeCompare(right.replay_id))
        .map((row) => ({
          replay_json: clone(row.replay_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "select gate_json from lingban_creator_release_gates order by gate_id asc") {
      const rows = [...tables.lingban_creator_release_gates]
        .sort((left, right) => left.gate_id.localeCompare(right.gate_id))
        .map((row) => ({
          gate_json: clone(row.gate_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select activation_json from lingban_creator_release_activations order by activation_id asc"
    ) {
      const rows = [...tables.lingban_creator_release_activations]
        .sort((left, right) => left.activation_id.localeCompare(right.activation_id))
        .map((row) => ({
          activation_json: clone(row.activation_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select export_json from lingban_creator_audit_exports order by created_at desc, export_id asc"
    ) {
      const rows = [...tables.lingban_creator_audit_exports]
        .sort(
          (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            left.export_id.localeCompare(right.export_id)
        )
        .map((row) => ({
          export_json: clone(row.export_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_bridge_registrations") {
      tables.lingban_bridge_registrations = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_bridge_registrations where run_id = $1") {
      tables.lingban_bridge_registrations = tables.lingban_bridge_registrations.filter(
        (row) => row.run_id !== params[0]
      );
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_billing_entries") {
      tables.lingban_billing_entries = [];
      return { rows: [], rowCount: 0 };
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

    if (normalized === "delete from lingban_credentials") {
      tables.lingban_credentials = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_health_snapshots") {
      tables.lingban_mcp_health_snapshots = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_network_policies") {
      tables.lingban_mcp_network_policies = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_bindings") {
      tables.lingban_mcp_bindings = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_mcp_registry") {
      tables.lingban_mcp_registry = [];
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

    if (normalized === "delete from lingban_creator_replays") {
      tables.lingban_creator_replays = [];
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

    if (normalized.startsWith("insert into lingban_bridge_registrations")) {
      const row = {
        run_id: params[0],
        bridge_id: params[1],
        workspace_id: params[2],
        target_path: params[3],
        connected_at: params[4],
        last_seen_at: params[5],
        bridge_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
      };
      const existingIndex = tables.lingban_bridge_registrations.findIndex(
        (item) => item.run_id === row.run_id
      );

      if (existingIndex >= 0) {
        tables.lingban_bridge_registrations[existingIndex] = row;
      } else {
        tables.lingban_bridge_registrations.push(row);
      }

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

    if (normalized.startsWith("insert into lingban_users")) {
      const row = {
        user_id: params[0],
        email: params[1],
        display_name: params[2],
        password_hash: params[3],
        created_at: params[4],
        updated_at: params[5],
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
        created_at: params[4],
        updated_at: params[5],
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
        created_at: params[4],
        updated_at: params[5],
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
        expires_at: params[10],
        accepted_at: params[11],
        revoked_at: params[12],
        created_at: params[13],
        updated_at: params[14],
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

    if (normalized.startsWith("insert into lingban_auth_sessions")) {
      const row = {
        session_id: params[0],
        user_id: params[1],
        current_workspace_id: params[2],
        access_token_hash: params[3],
        refresh_token_hash: params[4],
        access_token_expires_at: params[5],
        refresh_token_expires_at: params[6],
        revoked_at: params[7],
        created_at: params[8],
        updated_at: params[9],
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

    if (normalized.startsWith("insert into lingban_creator_packages")) {
      const row = {
        package_id: params[0],
        state: params[1],
        package_json: typeof params[2] === "string" ? JSON.parse(params[2]) : clone(params[2]),
      };
      const existingIndex = tables.lingban_creator_packages.findIndex(
        (item) => item.package_id === row.package_id
      );

      if (existingIndex >= 0) {
        tables.lingban_creator_packages[existingIndex] = row;
      } else {
        tables.lingban_creator_packages.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_releases")) {
      const row = {
        release_id: params[0],
        package_id: params[1],
        state: params[2],
        release_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      };
      const existingIndex = tables.lingban_creator_releases.findIndex(
        (item) => item.release_id === row.release_id
      );

      if (existingIndex >= 0) {
        tables.lingban_creator_releases[existingIndex] = row;
      } else {
        tables.lingban_creator_releases.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_replays")) {
      const row = {
        replay_id: params[0],
        package_id: params[1],
        state: params[2],
        replay_json: typeof params[3] === "string" ? JSON.parse(params[3]) : clone(params[3]),
      };
      const existingIndex = tables.lingban_creator_replays.findIndex(
        (item) => item.replay_id === row.replay_id
      );

      if (existingIndex >= 0) {
        tables.lingban_creator_replays[existingIndex] = row;
      } else {
        tables.lingban_creator_replays.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_release_gates")) {
      const row = {
        gate_id: params[0],
        release_id: params[1],
        package_id: params[2],
        status: params[3],
        gate_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      };
      const existingIndex = tables.lingban_creator_release_gates.findIndex(
        (item) => item.gate_id === row.gate_id
      );

      if (existingIndex >= 0) {
        tables.lingban_creator_release_gates[existingIndex] = row;
      } else {
        tables.lingban_creator_release_gates.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_release_activations")) {
      const row = {
        activation_id: params[0],
        release_id: params[1],
        package_id: params[2],
        state: params[3],
        activation_json: typeof params[4] === "string" ? JSON.parse(params[4]) : clone(params[4]),
      };
      const existingIndex = tables.lingban_creator_release_activations.findIndex(
        (item) => item.activation_id === row.activation_id
      );

      if (existingIndex >= 0) {
        tables.lingban_creator_release_activations[existingIndex] = row;
      } else {
        tables.lingban_creator_release_activations.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (normalized.startsWith("insert into lingban_creator_audit_exports")) {
      const row = {
        export_id: params[0],
        package_id: params[1],
        workspace_context_key: params[2],
        export_format: params[3],
        status: params[4],
        created_at: params[5],
        export_json: typeof params[6] === "string" ? JSON.parse(params[6]) : clone(params[6]),
      };
      const existingIndex = tables.lingban_creator_audit_exports.findIndex(
        (item) => item.export_id === row.export_id
      );

      if (existingIndex >= 0) {
        tables.lingban_creator_audit_exports[existingIndex] = row;
      } else {
        tables.lingban_creator_audit_exports.push(row);
      }

      return { rows: [], rowCount: 1 };
    }

    if (
      normalized ===
      "select job_json from lingban_batch_run_jobs order by updated_at desc, batch_job_id asc"
    ) {
      const rows = [...tables.lingban_batch_run_jobs]
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            left.batch_job_id.localeCompare(right.batch_job_id)
        )
        .map((row) => ({
          job_json: clone(row.job_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select item_json from lingban_batch_run_items order by batch_job_id asc, row_index asc, batch_item_id asc"
    ) {
      const rows = [...tables.lingban_batch_run_items]
        .sort(
          (left, right) =>
            left.batch_job_id.localeCompare(right.batch_job_id) ||
            left.row_index - right.row_index ||
            left.batch_item_id.localeCompare(right.batch_item_id)
        )
        .map((row) => ({
          item_json: clone(row.item_json),
        }));
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

    if (
      normalized ===
      "select favorite_json from lingban_me_favorite_workshops order by updated_at desc, workshop_id asc"
    ) {
      const rows = [...tables.lingban_me_favorite_workshops]
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            left.workshop_id.localeCompare(right.workshop_id)
        )
        .map((row) => ({
          favorite_json: clone(row.favorite_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_me_favorite_workshops") {
      tables.lingban_me_favorite_workshops = [];
      return { rows: [], rowCount: 0 };
    }

    if (
      normalized ===
      "delete from lingban_me_favorite_workshops where user_id = $1 and workspace_context_key = $2 and workshop_id = $3"
    ) {
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

    if (normalized.startsWith("insert into lingban_me_favorite_workshops")) {
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

    if (
      normalized ===
      "select receipt_json from lingban_notification_read_receipts order by read_at desc, notification_id asc"
    ) {
      const rows = [...tables.lingban_notification_read_receipts]
        .sort(
          (left, right) =>
            right.read_at.localeCompare(left.read_at) ||
            left.notification_id.localeCompare(right.notification_id)
        )
        .map((row) => ({
          receipt_json: clone(row.receipt_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select cursor_json from lingban_notification_read_cursors order by marked_all_read_at desc, workspace_id asc, user_id asc"
    ) {
      const rows = [...tables.lingban_notification_read_cursors]
        .sort(
          (left, right) =>
            right.marked_all_read_at.localeCompare(left.marked_all_read_at) ||
            left.workspace_id.localeCompare(right.workspace_id) ||
            left.user_id.localeCompare(right.user_id)
        )
        .map((row) => ({
          cursor_json: clone(row.cursor_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_notification_read_receipts") {
      tables.lingban_notification_read_receipts = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_notification_read_cursors") {
      tables.lingban_notification_read_cursors = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_notification_read_receipts")) {
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

    if (normalized.startsWith("insert into lingban_notification_read_cursors")) {
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
      normalized ===
      "select activity_json from lingban_me_recent_activities order by updated_at desc, resource_type asc, resource_id asc"
    ) {
      const rows = [...tables.lingban_me_recent_activities]
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            left.resource_type.localeCompare(right.resource_type) ||
            left.resource_id.localeCompare(right.resource_id)
        )
        .map((row) => ({
          activity_json: clone(row.activity_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_me_recent_activities") {
      tables.lingban_me_recent_activities = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_me_recent_activities")) {
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
      normalized ===
      "select history_json from lingban_search_history_entries order by updated_at desc, query asc"
    ) {
      const rows = [...tables.lingban_search_history_entries]
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) || left.query.localeCompare(right.query)
        )
        .map((row) => ({
          history_json: clone(row.history_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (
      normalized ===
      "select event_json from lingban_search_click_events order by occurred_at desc, rank asc, event_id asc"
    ) {
      const rows = [...tables.lingban_search_click_events]
        .sort(
          (left, right) =>
            right.occurred_at.localeCompare(left.occurred_at) ||
            left.rank - right.rank ||
            left.event_id.localeCompare(right.event_id)
        )
        .map((row) => ({
          event_json: clone(row.event_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_search_history_entries") {
      tables.lingban_search_history_entries = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized === "delete from lingban_search_click_events") {
      tables.lingban_search_click_events = [];
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("delete from lingban_search_history_entries where user_id = $1 and workspace_context_key = $2")) {
      const retainedIds = params.slice(2);
      if (retainedIds.length === 0) {
        tables.lingban_search_history_entries = tables.lingban_search_history_entries.filter(
          (item) => !(item.user_id === params[0] && item.workspace_context_key === params[1])
        );
      } else {
        const retainedIdSet = new Set(retainedIds.map((value) => String(value)));
        tables.lingban_search_history_entries = tables.lingban_search_history_entries.filter(
          (item) =>
            item.user_id !== params[0] ||
            item.workspace_context_key !== params[1] ||
            retainedIdSet.has(item.history_id)
        );
      }
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("delete from lingban_search_click_events where user_id = $1 and workspace_context_key = $2")) {
      const retainedIds = params.slice(2);
      if (retainedIds.length === 0) {
        tables.lingban_search_click_events = tables.lingban_search_click_events.filter(
          (item) => !(item.user_id === params[0] && item.workspace_context_key === params[1])
        );
      } else {
        const retainedIdSet = new Set(retainedIds.map((value) => String(value)));
        tables.lingban_search_click_events = tables.lingban_search_click_events.filter(
          (item) =>
            item.user_id !== params[0] ||
            item.workspace_context_key !== params[1] ||
            retainedIdSet.has(item.event_id)
        );
      }
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into lingban_search_history_entries")) {
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

    if (
      normalized ===
      "select archive_record_json from lingban_session_archives order by updated_at desc, session_version_id asc"
    ) {
      const rows = [...tables.lingban_session_archives]
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            left.session_version_id.localeCompare(right.session_version_id)
        )
        .map((row) => ({
          archive_record_json: clone(row.archive_record_json),
        }));
      return { rows, rowCount: rows.length };
    }

    if (normalized === "delete from lingban_session_archives") {
      tables.lingban_session_archives = [];
      return { rows: [], rowCount: 0 };
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

    return { rows: [], rowCount: 0 };
  }

  return {
    history,
    tables,
    get endCalls() {
      return endCalls;
    },
    query,
    connect: async () => ({
      query,
      release() {},
    }),
    async end() {
      endCalls += 1;
    },
  };
}

async function createMigrationDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "lingban-db-"));
  await writeFile(
    path.join(directory, "0001_bootstrap.sql"),
    "CREATE TABLE foo (id TEXT PRIMARY KEY);\nCREATE INDEX foo_idx ON foo (id);\n",
    "utf8"
  );
  await writeFile(
    path.join(directory, "0002_seed.sql"),
    "INSERT INTO foo (id) VALUES ('a');\nINSERT INTO foo (id) VALUES ('b');\n",
    "utf8"
  );
  return directory;
}

function createRunAggregate(runId, status = "CREATED") {
  const run = {
    runId,
    workspaceId: "wsp_test_workspace",
    taskVersionId: "tsv_test_tax",
    sessionVersionId: "sev_test_agent",
    requestedByUserId: "usr_test_owner",
    title: "Tax filing",
    targetPath: `workspace://runs/${runId}/`,
    entrySurface: "dashboard",
    catalogMetadata: null,
    status,
    statusReason: null,
    createdAt: "2026-07-10T10:00:00.000Z",
    updatedAt: status === "CREATED" ? "2026-07-10T10:00:00.000Z" : "2026-07-10T10:10:00.000Z",
  };

  return {
    run,
    runtime: {},
    messages: [],
    files: [],
    artifacts: [],
    approvals: [],
    input: {
      workspaceId: run.workspaceId,
      taskVersionId: run.taskVersionId,
      sessionVersionId: run.sessionVersionId,
      requestedByUserId: run.requestedByUserId,
      title: run.title,
      targetPath: run.targetPath,
      entrySurface: run.entrySurface,
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      catalogMetadata: null,
    },
    startJob: {
      run,
      initialPrompt: "Please tell me what information I need to provide to you.",
      requestedInitialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      credentialMounts: [],
      mcpBindings: [],
      mcpNetworkPolicies: [],
    },
  };
}

function createRunFileRecord(runId, filePath = `C:/runs/${runId}/outputs/report.pdf`) {
  return {
    runId,
    workspaceId: "wsp_test_workspace",
    path: filePath,
    logicalPath: "/outputs/report.pdf",
    name: "report.pdf",
    kind: "output",
    sizeBytes: 2048,
    updatedAt: "2026-07-10T10:30:00.000Z",
    source: "runtime-output",
    mimeType: "application/pdf",
    objectKey: `runs/${runId}/indexed/runtime-output/outputs/report.pdf`,
    uploadId: null,
    checksum: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    previewMode: "pdf",
    previewable: true,
    downloadable: true,
    storageTier: "hot",
    archivedAt: null,
    archivedFromObjectKey: null,
    archiveReason: null,
    indexedAt: "2026-07-10T10:31:00.000Z",
  };
}

function createRunUploadRecord(uploadId = "upl_db_0001", runId = "run_upload_0001") {
  return {
    uploadId,
    runId,
    workspaceId: "wsp_test_workspace",
    fileName: "receipt.pdf",
    contentType: "application/pdf",
    declaredSizeBytes: 4096,
    storedSizeBytes: 4096,
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    status: "uploaded",
    scanStatus: "clean",
    scanEngine: "smoke-av",
    scanReasonCode: null,
    scanDetail: null,
    scanSignature: null,
    scannedAt: "2026-07-10T12:04:00.000Z",
    objectKey: `uploads/${runId}/${uploadId}/receipt.pdf`,
    attachedPath: "/attachments/receipt.pdf",
    attachedLabel: "Tax receipt",
    createdAt: "2026-07-10T12:00:00.000Z",
    updatedAt: "2026-07-10T12:05:00.000Z",
  };
}

function createBridgeRegistration(runId = "run_bridge_db_0001") {
  return {
    bridgeId: `brg_${runId}`,
    runId,
    workspaceId: "wsp_test_workspace",
    targetPath: `/workspace/runs/${runId}/`,
    control: {
      baseUrl: "http://127.0.0.1:39999",
      authToken: "bridge-control-token",
    },
    supportedCommands: [
      "sendMessage",
      "approve",
      "cancel",
      "ping",
      "syncFiles",
      "flushArtifacts",
    ],
    connectedAt: "2026-07-10T08:00:00.000Z",
    lastSeenAt: "2026-07-10T08:05:00.000Z",
  };
}

function createBillingEntry(entryId = "ble_db_0001") {
  return {
    entryId,
    workspaceId: "wsp_test_workspace",
    workspaceContextKey: "harbor-finance",
    packageId: "creator-poster-suite",
    serviceId: "hk-quarterly-tax",
    taskVersionId: "tsv_tax_ops_20260710",
    sessionVersionId: "sev_tax_ops_20260710",
    entrySurface: "dashboard",
    runId: "run_billing_db_0001",
    requestedByUserId: "usr_test_owner",
    metric: "download_bytes",
    quantity: 2048,
    unitPriceUsd: 0.002,
    amountUsd: 4.096,
    currency: "USD",
    source: "file-download",
    costBasis: "actual",
    sourceRef: "/outputs/report.pdf",
    note: "Billing ledger smoke entry",
    createdAt: "2026-07-10T08:10:00.000Z",
    updatedAt: "2026-07-10T08:15:00.000Z",
    occurredAt: "2026-07-10T08:15:00.000Z",
  };
}

function localized(zh, en = zh) {
  return { zh, en };
}

function createWorkspaceContextSummary(contextKey = "harbor-finance") {
  return {
    contextKey,
    runtimeWorkspaceId: "wsp_test_workspace",
    displayName: localized("Harbor Finance", "Harbor Finance"),
    type: "team",
    meta: localized("Finance workspace", "Finance workspace"),
    root: "/workspace/harbor-finance/",
    allowedEntrySurfaces: ["dashboard", "h5"],
  };
}

function createWorkshopCatalogRecord(workshopId = "tax-operations") {
  return {
    workshopId,
    scope: "enterprise",
    status: "active",
    visibility: "workspace",
    displayName: localized("Tax Operations", "Tax Operations"),
    ownerLabel: localized("Finance Ops", "Finance Ops"),
    badge: localized("Official", "Official"),
    audience: localized("Finance team", "Finance team"),
    summary: localized("Handle recurring tax workflows", "Handle recurring tax workflows"),
    nextStepSummary: localized("Choose a filing service", "Choose a filing service"),
    coverAssetUrl: "/assets/workshop-tax.svg",
    tagList: ["tax", "finance"],
    defaultServiceId: "hk-quarterly-tax",
    visibleInContexts: ["harbor-finance"],
  };
}

function createServiceCatalogRecord(serviceId = "hk-quarterly-tax", workshopId = "tax-operations") {
  return {
    serviceId,
    workshopId,
    status: "active",
    displayName: localized("HK Quarterly Tax", "HK Quarterly Tax"),
    summary: localized("Prepare quarterly filing", "Prepare quarterly filing"),
    authRequirementText: localized("Workspace login required", "Workspace login required"),
    estimatedDuration: "10-20 min",
    targetPathHint: "/workspace/harbor-finance/q1/hk/",
    outputContractSummary: localized("Filing receipts and reports", "Filing receipts and reports"),
    launchMode: "instant-conversation",
    requiredBindings: {
      firstPartyMcpIds: ["browser-core"],
      externalConnectorRefs: ["connector://seedance/private"],
      credentialIds: ["cred_seedance"],
    },
    linkedInstanceHint: null,
    visibleInContexts: ["harbor-finance"],
  };
}

function createLaunchTemplateRecord(templateKey = "tpl_hk_quarterly_tax_dashboard") {
  return {
    templateKey,
    serviceId: "hk-quarterly-tax",
    workspaceContextKey: "harbor-finance",
    entrySurface: "dashboard",
    taskVersionId: "tsv_tax_ops_20260710",
    sessionVersionId: "sev_tax_ops_20260710",
    title: localized("Quarterly filing", "Quarterly filing"),
    targetRoot: "/workspace/harbor-finance/q1/hk/",
    bindings: {
      firstPartyMcpIds: ["browser-core"],
      externalConnectorRefs: ["connector://seedance/private"],
      credentialIds: ["cred_seedance"],
    },
  };
}

function createQuotaPolicy(policyId = "qpo_db_0001") {
  return {
    policyId,
    workspaceId: "wsp_test_workspace",
    scopeType: "workspace-context",
    scopeRefId: "harbor-finance",
    metric: "daily_runs",
    windowType: "daily",
    limitValue: 20,
    softLimitValue: 15,
    hardLimitValue: 20,
    actionOnSoftLimit: "warn",
    actionOnHardLimit: "require_override",
    status: "active",
    enabled: true,
    priority: 100,
    summary: localized("Daily run quota", "Daily run quota"),
    notes: "Daily workspace run ceiling.",
    workspaceContextKey: "harbor-finance",
    packageId: null,
    serviceId: "hk-quarterly-tax",
    taskVersionId: "tsv_tax_ops_20260710",
    sessionVersionId: "sev_tax_ops_20260710",
    entrySurface: "dashboard",
    createdByUserId: "usr_test_owner",
    updatedByUserId: "usr_test_owner",
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T09:05:00.000Z",
  };
}

function createQuotaCounter(counterId = "qco_db_0001", policyId = "qpo_db_0001") {
  return {
    counterId,
    policyId,
    workspaceId: "wsp_test_workspace",
    scopeType: "workspace-context",
    scopeRefId: "harbor-finance",
    metric: "daily_runs",
    windowType: "daily",
    windowStartedAt: "2026-07-10T00:00:00.000Z",
    windowEndsAt: "2026-07-11T00:00:00.000Z",
    currentValue: 8,
    workspaceContextKey: "harbor-finance",
    packageId: null,
    serviceId: "hk-quarterly-tax",
    taskVersionId: "tsv_tax_ops_20260710",
    sessionVersionId: "sev_tax_ops_20260710",
    entrySurface: "dashboard",
    updatedAt: "2026-07-10T09:10:00.000Z",
  };
}

function createQuotaEvent(eventId = "qev_db_0001", policyId = "qpo_db_0001", overrideId = "qov_db_0001") {
  return {
    eventId,
    policyId,
    workspaceId: "wsp_test_workspace",
    scopeType: "workspace-context",
    scopeRefId: "harbor-finance",
    metric: "daily_runs",
    decision: "approval_pending",
    currentValue: 16,
    limitValue: 15,
    runId: "run_quota_db_0001",
    approvalId: "apr_quota_db_0001",
    overrideId,
    note: "Quota threshold reached.",
    workspaceContextKey: "harbor-finance",
    packageId: null,
    serviceId: "hk-quarterly-tax",
    taskVersionId: "tsv_tax_ops_20260710",
    sessionVersionId: "sev_tax_ops_20260710",
    entrySurface: "dashboard",
    occurredAt: "2026-07-10T09:12:00.000Z",
  };
}

function createQuotaOverrideRecord(overrideId = "qov_db_0001", policyId = "qpo_db_0001") {
  return {
    overrideId,
    policyId,
    workspaceId: "wsp_test_workspace",
    scopeType: "workspace-context",
    scopeRefId: "harbor-finance",
    metric: "daily_runs",
    status: "pending",
    requiredRole: "owner",
    currentValue: 16,
    limitValue: 15,
    requestedDelta: 5,
    reasonSummary: localized("Need more runs", "Need more runs"),
    runId: "run_quota_db_0001",
    approvalId: "apr_quota_db_0001",
    workspaceContextKey: "harbor-finance",
    packageId: null,
    serviceId: "hk-quarterly-tax",
    taskVersionId: "tsv_tax_ops_20260710",
    sessionVersionId: "sev_tax_ops_20260710",
    entrySurface: "dashboard",
    requestedByUserId: "usr_test_owner",
    requestedAt: "2026-07-10T09:13:00.000Z",
    decidedByUserId: null,
    decidedAt: null,
    decisionNote: null,
    updatedAt: "2026-07-10T09:13:00.000Z",
  };
}

function createAuthUserRecord(userId = "usr_db_0001") {
  return {
    userId,
    email: "db-owner@example.com",
    displayName: "DB Owner",
    passwordHash: "hash_db_owner",
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:05:00.000Z",
  };
}

function createAuthWorkspace(workspaceId = "wsp_db_0001") {
  return {
    workspaceId,
    slug: "db-team",
    name: "DB Team",
    type: "team",
    createdAt: "2026-07-10T08:10:00.000Z",
    updatedAt: "2026-07-10T08:12:00.000Z",
  };
}

function createAuthMembership(workspaceId = "wsp_db_0001", userId = "usr_db_0001") {
  return {
    workspaceId,
    userId,
    role: "owner",
    status: "active",
    createdAt: "2026-07-10T08:15:00.000Z",
    updatedAt: "2026-07-10T08:16:00.000Z",
  };
}

function createAuthInvitationRecord(invitationId = "wiv_db_0001", workspaceId = "wsp_db_0001") {
  return {
    invitationId,
    workspaceId,
    email: "invitee@example.com",
    role: "creator",
    status: "pending",
    invitedByUserId: "usr_db_0001",
    acceptedByUserId: null,
    acceptTokenHash: "invite_token_hash_db_0001",
    acceptTokenPreview: "db01",
    note: "Join the DB workspace",
    expiresAt: "2026-07-20T08:20:00.000Z",
    acceptedAt: null,
    revokedAt: null,
    createdAt: "2026-07-10T08:20:00.000Z",
    updatedAt: "2026-07-10T08:21:00.000Z",
  };
}

function createAuthSessionRecord(sessionId = "ses_db_0001", userId = "usr_db_0001", workspaceId = "wsp_db_0001") {
  return {
    sessionId,
    userId,
    currentWorkspaceId: workspaceId,
    accessTokenHash: "access_hash_db_0001",
    refreshTokenHash: "refresh_hash_db_0001",
    accessTokenExpiresAt: "2026-07-11T08:25:00.000Z",
    refreshTokenExpiresAt: "2026-07-12T08:25:00.000Z",
    revokedAt: null,
    createdAt: "2026-07-10T08:25:00.000Z",
    updatedAt: "2026-07-10T08:26:00.000Z",
  };
}

function createCreatorPackageDetail(packageId = "pkg_db_0001") {
  return {
    packageId,
    title: localized("DB Creator Package", "DB Creator Package"),
    source: localized("DB Source", "DB Source"),
    state: "ready",
    statusLabel: localized("Ready", "Ready"),
    tone: "active",
    ownerLabel: localized("DB Team", "DB Team"),
    updatedAt: "2026-07-10T09:00:00.000Z",
    releaseChannel: localized("DB Channel", "DB Channel"),
    workspaceContextKeys: ["harbor-finance"],
    linkedWorkshopIds: ["enterprise-tax"],
    linkedServiceIds: ["tax-filing"],
    session: {
      summary: localized("Preserve full session flow", "Preserve full session flow"),
      items: [localized("Approval nodes preserved", "Approval nodes preserved")],
    },
    runtime: {
      summary: localized("Standard runtime image", "Standard runtime image"),
      items: [localized("Codex runtime", "Codex runtime")],
    },
    connectors: {
      summary: localized("Workspace connector set", "Workspace connector set"),
      items: [localized("Seedance connector", "Seedance connector")],
    },
    release: {
      summary: localized("Ready for release", "Ready for release"),
      items: [localized("Audit checklist passed", "Audit checklist passed")],
    },
    versionLine: ["sev_pkg_db_0001@2026.07.10", "img: lingban-codex-runtime:2026.07"],
    dependencies: [localized("Readonly secret mounts", "Readonly secret mounts")],
  };
}

function createCreatorReleaseSummary(releaseId = "rel_db_0001", packageId = "pkg_db_0001") {
  return {
    releaseId,
    packageId,
    targetWorkspaceContextKey: "harbor-finance",
    state: "private",
    channelLabel: localized("Private release", "Private release"),
    gateSummary: [localized("Checklist passed", "Checklist passed")],
    updatedAt: "2026-07-10T09:10:00.000Z",
  };
}

function createCreatorReplaySummary(replayId = "rpl_db_0001", packageId = "pkg_db_0001") {
  return {
    replayId,
    packageId,
    sourceRunId: "run_db_0001",
    state: "ready",
    summary: localized("Replay ready", "Replay ready"),
    updatedAt: "2026-07-10T09:12:00.000Z",
  };
}

function createCreatorReleaseGate(gateId = "gat_db_0001", releaseId = "rel_db_0001", packageId = "pkg_db_0001") {
  return {
    gateId,
    releaseId,
    packageId,
    gateType: "manual_approval",
    status: "passed",
    requiredRole: "admin",
    resultSummary: localized("Gate passed", "Gate passed"),
    evidenceRef: "evidence://db/gate/1",
    checklist: [
      {
        itemId: "chk_db_0001",
        label: localized("Checklist item", "Checklist item"),
        status: "passed",
        note: localized("Verified", "Verified"),
      },
    ],
    recommendedActions: [localized("Proceed", "Proceed")],
    decidedByUserId: "usr_db_0001",
    decidedAt: "2026-07-10T09:15:00.000Z",
    updatedAt: "2026-07-10T09:15:00.000Z",
  };
}

function createCreatorReleaseActivation(
  activationId = "act_db_0001",
  releaseId = "rel_db_0001",
  packageId = "pkg_db_0001"
) {
  return {
    activationId,
    releaseId,
    packageId,
    targetWorkspaceContextKey: "harbor-finance",
    state: "active",
    rolloutMode: "private",
    effectiveAt: "2026-07-10T09:20:00.000Z",
    note: localized("Activation note", "Activation note"),
    activatedByUserId: "usr_db_0001",
    updatedAt: "2026-07-10T09:20:00.000Z",
  };
}

function createCreatorAuditExportRecord(exportId = "exp_db_0001", packageId = "pkg_db_0001") {
  return {
    exportId,
    packageId,
    workspaceContextKey: "harbor-finance",
    format: "json",
    status: "ready",
    fileName: "creator-audit-db.json",
    mimeType: "application/json",
    objectKey: "creator/audit/db.json",
    sizeBytes: 128,
    sha256: "sha256_db_export",
    recordCount: 3,
    summary: localized("Audit export ready", "Audit export ready"),
    createdByUserId: "usr_db_0001",
    createdAt: "2026-07-10T09:25:00.000Z",
    updatedAt: "2026-07-10T09:25:00.000Z",
  };
}

function createStoredCredentialRecord(credentialId = "cred_db_0001") {
  return {
    credentialId,
    workspaceId: "wsp_test_workspace",
    ownerUserId: "usr_test_owner",
    scope: "workspace",
    displayName: "Seedance API Key",
    provider: "seedance",
    secretKind: "api-key",
    mountMode: "env",
    status: "active",
    brokerKind: "local-envelope",
    activeKeyId: "key_local_seedance_1",
    secretVersion: 2,
    redactedSecretRef: "secret://seedance/redacted",
    expiresAt: null,
    lastRotatedAt: "2026-07-10T10:00:00.000Z",
    lastMaterializedAt: "2026-07-10T10:05:00.000Z",
    rotationDueAt: "2026-08-10T10:00:00.000Z",
    notes: "Shared credentials repository smoke fixture",
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T10:05:00.000Z",
    envName: "SEEDANCE_API_KEY",
    mountPathTemplate: null,
    secretRef: "secret://seedance/active",
    secretEnvelope: {
      version: 1,
      brokerKind: "local-envelope",
      algorithm: "aes-256-gcm",
      keyId: "key_local_seedance_1",
      ivBase64: "aXZiYXNlNjQ=",
      authTagBase64: "YXV0aHRhZ2Jhc2U2NA==",
      ciphertextBase64: "Y2lwaGVydGV4dGJhc2U2NA==",
    },
    lastMaterializationLeaseId: "lease_seedance_db_0001",
    activeRunGraceIssuedAt: null,
  };
}

function createMcpRegistryEntry(mcpId = "workspace:seedance-api") {
  return {
    mcpId,
    workspaceId: "wsp_test_workspace",
    displayName: "Seedance Workspace Connector",
    description: "Workspace-managed Seedance API endpoint.",
    source: "workspace-managed",
    transport: "http",
    ref: "https://mcp.workspace.internal/seedance",
    stdioPolicy: null,
    status: "active",
    riskLevel: "medium",
    defaultCredentialId: "cred_seedance_api_key",
    defaultNetworkPolicyRef: "np_seedance_workspace",
    approvalRequired: false,
    tags: ["seedance", "workspace-managed"],
    createdAt: "2026-07-10T10:00:00.000Z",
    updatedAt: "2026-07-10T10:05:00.000Z",
  };
}

function createMcpBindingRecord(bindingId = "mbd_db_0001", mcpId = "workspace:seedance-api") {
  return {
    bindingId,
    mcpId,
    workspaceId: "wsp_test_workspace",
    scope: "workspace",
    scopeRef: "wsp_test_workspace",
    credentialId: "cred_seedance_api_key",
    status: "active",
    networkPolicyRef: "np_seedance_workspace",
    approvalRequired: false,
    autoAttach: true,
    notes: "Workspace-wide default binding.",
    createdAt: "2026-07-10T10:10:00.000Z",
    updatedAt: "2026-07-10T10:12:00.000Z",
  };
}

function createMcpNetworkPolicy(policyRef = "np_seedance_workspace") {
  return {
    policyRef,
    workspaceId: "wsp_test_workspace",
    displayName: "Seedance Workspace Egress",
    description: "Allow Seedance traffic to the workspace gateway.",
    status: "active",
    mode: "allowlist",
    allowedProtocols: ["https"],
    allowedHostPatterns: ["mcp.workspace.internal"],
    allowedPorts: [443],
    allowedPathPrefixes: ["/seedance"],
    requireTls: true,
    blockPrivateNetwork: false,
    tags: ["seedance"],
    createdAt: "2026-07-10T10:15:00.000Z",
    updatedAt: "2026-07-10T10:20:00.000Z",
  };
}

function createMcpHealthSnapshot(
  snapshotId = "chs_db_0001",
  mcpId = "workspace:seedance-api",
  bindingId = "mbd_db_0001"
) {
  return {
    snapshotId,
    mcpId,
    bindingId,
    workspaceId: "wsp_test_workspace",
    requestedByUserId: "usr_test_owner",
    displayName: "Seedance Workspace Connector",
    source: "workspace-managed",
    transport: "http",
    ref: "https://mcp.workspace.internal/seedance",
    networkPolicyRef: "np_seedance_workspace",
    status: "healthy",
    detail: "Probe succeeded.",
    errorCode: null,
    httpStatus: 200,
    latencyMs: 180,
    toolCount: 6,
    policyEnforced: true,
    probedAt: "2026-07-10T10:30:00.000Z",
    recordedAt: "2026-07-10T10:30:05.000Z",
  };
}

function createBatchRunJob(batchJobId = "bat_job_db_0001", status = "draft") {
  return {
    batchJobId,
    workspaceId: "wsp_test_workspace",
    workspaceContextKey: "harbor-finance",
    workspaceContextName: {
      zh: "Harbor Finance",
      en: "Harbor Finance",
    },
    workspaceRoot: "/workspace/harbor-finance/",
    workshopId: "tax-operations",
    workshopName: {
      zh: "Tax Operations Workshop",
      en: "Tax Operations Workshop",
    },
    serviceId: "hk-quarterly-tax",
    serviceName: {
      zh: "HK Quarterly Tax",
      en: "HK Quarterly Tax",
    },
    taskVersionId: "tsv_tax_ops_20260710",
    sessionVersionId: "sev_tax_ops_20260710",
    entrySurface: "dashboard",
    title: "Quarterly filing batch",
    templateSource: "catalog-default",
    sourcePackageId: null,
    sourceReleaseId: null,
    sourceActivationId: null,
    bindings: {
      firstPartyMcpIds: ["browser-core"],
      externalConnectorRefs: ["connector://seedance/private"],
      credentialIds: ["cred_seedance"],
    },
    status,
    maxParallelRuns: 2,
    budgetLimit: 200,
    retryLimit: 1,
    createdByUserId: "usr_test_owner",
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: status === "validated" ? "2026-07-10T09:15:00.000Z" : "2026-07-10T09:00:00.000Z",
    validatedAt: status === "validated" ? "2026-07-10T09:15:00.000Z" : null,
    startedAt: null,
    finishedAt: null,
    cancelledAt: null,
    cancellationReason: null,
  };
}

function createBatchRunItems(batchJobId = "bat_job_db_0001") {
  return [
    {
      batchItemId: "bat_item_db_0001",
      batchJobId,
      rowIndex: 0,
      rowKey: "row-1",
      title: "Quarterly filing / Hong Kong",
      targetPath: "/workspace/harbor-finance/q1/hk/",
      pathSuffix: "hk",
      initialMessage: "Handle Hong Kong quarterly filing package.",
      context: {
        market: "hk",
      },
      runId: "run_batch_db_0001",
      previousRunIds: [],
      runStatus: "CREATED",
      runStatusReason: null,
      status: "validated",
      attemptCount: 0,
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-07-10T09:00:00.000Z",
      updatedAt: "2026-07-10T09:15:00.000Z",
      startedAt: null,
      finishedAt: null,
    },
    {
      batchItemId: "bat_item_db_0002",
      batchJobId,
      rowIndex: 1,
      rowKey: "row-2",
      title: "Quarterly filing / Singapore",
      targetPath: "/workspace/harbor-finance/q1/sg/",
      pathSuffix: "sg",
      initialMessage: "Handle Singapore quarterly filing package.",
      context: {
        market: "sg",
      },
      runId: null,
      previousRunIds: [],
      runStatus: null,
      runStatusReason: null,
      status: "validated",
      attemptCount: 0,
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-07-10T09:00:00.000Z",
      updatedAt: "2026-07-10T09:15:00.000Z",
      startedAt: null,
      finishedAt: null,
    },
  ];
}

function createFavoriteWorkshopRecord(workshopId = "tax-operations") {
  return {
    favoriteId: `fav_${workshopId.replace(/[^a-z0-9]+/gi, "_")}`,
    userId: "usr_test_owner",
    workspaceId: "wsp_test_workspace",
    workspaceContextKey: "harbor-finance",
    workshopId,
    createdAt: "2026-07-10T13:00:00.000Z",
    updatedAt: "2026-07-10T13:05:00.000Z",
  };
}

function createRunDownloadTicket(ticketId = "dlt_db_0001", runId = "run_upload_0001", uploadId = "upl_db_0001") {
  return {
    ticketId,
    runId,
    workspaceId: "wsp_test_workspace",
    path: "/attachments/receipt.pdf",
    fileName: "receipt.pdf",
    mimeType: "application/pdf",
    sourceKind: "uploaded-object",
    objectKey: `uploads/${runId}/${uploadId}/receipt.pdf`,
    uploadId,
    createdAt: "2026-07-10T12:06:00.000Z",
    expiresAt: "2026-07-10T13:06:00.000Z",
    createdByUserId: "usr_test_owner",
    checksum: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
}

function createImportedSessionPackRecord(sessionVersionId = "sev_imported_pack_db_0001") {
  return {
    sessionVersionId,
    workspaceContextKeys: ["harbor-finance"],
    requiredBindings: {
      firstPartyMcpIds: ["browser-core"],
      externalConnectorRefs: ["connector://seedance/private"],
      credentialIds: ["cred_seedance"],
    },
    archiveSource: "imported",
    archivePath: `C:/session-archives/${sessionVersionId}.session-pack.json.gz`,
    archiveSizeBytes: 2048,
    archiveSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    archiveFileName: `${sessionVersionId}.session-pack.json.gz`,
    importedAt: "2026-07-10T12:00:00.000Z",
    importedByUserId: "usr_import_owner",
    runtimeSourceRunId: null,
    runtimeSourceTargetPath: null,
    runtimeSourceUpdatedAt: null,
    updatedAt: "2026-07-10T12:05:00.000Z",
    manifest: {
      manifest_version: "lingban.session-pack/v1",
      session_id: "ses_imported_pack_db_0001",
      session_version: sessionVersionId,
      task_family: "tsv_imported_pack_db_0001",
      runtime_profile: {
        profile_id: "imported-pack-db-profile",
        runner_image: "lingban/runner:2026.07",
        browser_required: true,
        playwright_required: true,
      },
      slot_schema_version: "imported.v1",
      required_capabilities: {
        browser: true,
        filesystem: true,
        downloads: true,
        mcps: [{ id: "browser-core", required: true }],
        credentials: [{ id: "cred_seedance", placement: "env", required: true }],
      },
      artifact_contract: {
        outputs: [{ name: "output", kind: "directory", path_pattern: "output/**" }],
      },
      created_by: {
        user_id: "usr_import_owner",
        display_name: "Import Owner",
      },
      created_at: "2026-07-10T12:00:00.000Z",
      metadata: {
        imported_fixture: true,
      },
    },
  };
}

test("createPostgresDatabaseManager loads, dry-runs, and applies migrations idempotently", async () => {
  const directory = await createMigrationDirectory();

  try {
    const { createPostgresDatabaseManager } = await import("../dist/index.js");
    const manager = createPostgresDatabaseManager({
      isEnabled: () => true,
      getDatabaseUrl: () => "postgres://postgres:postgres@127.0.0.1:5432/lingban_workshop",
      resolveMigrationsDirectory: () => directory,
    });
    manager.setPoolFactoryForTests(() => createFakePostgresPool());

    const statusBefore = await manager.getMigrationStatus();
    assert.equal(statusBefore.enabled, true);
    assert.deepEqual(
      statusBefore.migrations.map((migration) => migration.version),
      ["0001_bootstrap", "0002_seed"]
    );
    assert.equal(statusBefore.appliedCount, 0);
    assert.equal(statusBefore.pendingCount, 2);

    const dryRun = await manager.runMigrations({ dryRun: true });
    assert.equal(dryRun.newlyAppliedCount, 0);
    assert.deepEqual(dryRun.newlyAppliedVersions, []);
    assert.equal(dryRun.appliedCount, 0);

    const applied = await manager.runMigrations();
    assert.equal(applied.newlyAppliedCount, 2);
    assert.deepEqual(applied.newlyAppliedVersions, ["0001_bootstrap", "0002_seed"]);
    assert.equal(applied.pendingCount, 0);
    assert.equal(applied.migrations.every((migration) => migration.applied), true);

    const secondRun = await manager.runMigrations();
    assert.equal(secondRun.newlyAppliedCount, 0);
    assert.deepEqual(secondRun.newlyAppliedVersions, []);

    const probe = await manager.probeReadiness();
    assert.deepEqual(probe, {
      enabled: true,
      ready: true,
      detail: null,
    });

    await manager.resetForTests();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("splitSqlStatements preserves trigger bodies and quoted semicolons", async () => {
  const { splitSqlStatements } = await import("../dist/index.js");
  const statements = splitSqlStatements(`
CREATE FUNCTION sample_trigger() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'blocked; immutable';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER sample BEFORE UPDATE ON sample_table
FOR EACH ROW EXECUTE FUNCTION sample_trigger();
`);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /RETURN NEW;/);
  assert.match(statements[1], /CREATE TRIGGER sample/);
});

test("createPostgresDatabaseManager exposes reusable transaction helper with commit and rollback behavior", async () => {
  const directory = await createMigrationDirectory();

  try {
    const { createPostgresDatabaseManager } = await import("../dist/index.js");
    const manager = createPostgresDatabaseManager({
      isEnabled: () => true,
      getDatabaseUrl: () => "postgres://postgres:postgres@127.0.0.1:5432/lingban_workshop",
      resolveMigrationsDirectory: () => directory,
    });
    const fakePool = createFakePostgresPool();
    manager.setPoolFactoryForTests(() => fakePool);

    const result = await manager.withTransaction(async (client) => {
      await client.query("SELECT 1");
      return "ok";
    });
    assert.equal(result, "ok");
    assert.deepEqual(fakePool.history.slice(0, 3), ["begin", "select 1", "commit"]);

    await assert.rejects(
      manager.withTransaction(async (client) => {
        await client.query("SELECT 1");
        throw new Error("boom");
      }),
      /boom/
    );
    assert.equal(fakePool.history.includes("rollback"), true);

    await manager.resetForTests();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("createPostgresDatabaseManager can reset live connection state without clearing migrations", async () => {
  const directory = await createMigrationDirectory();

  try {
    const { createPostgresDatabaseManager } = await import("../dist/index.js");
    const manager = createPostgresDatabaseManager({
      isEnabled: () => true,
      getDatabaseUrl: () => "postgres://postgres:postgres@127.0.0.1:5432/lingban_workshop",
      resolveMigrationsDirectory: () => directory,
    });
    const fakePool = createFakePostgresPool();
    manager.setPoolFactoryForTests(() => fakePool);

    await manager.runMigrations();
    assert.equal(fakePool.endCalls, 0);

    await manager.resetConnectionState();
    assert.equal(fakePool.endCalls, 1);

    await manager.runMigrations();
    assert.equal(fakePool.endCalls, 1);

    await manager.resetForTests();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("createPostgresDatabaseManager reports disabled readiness without touching postgres", async () => {
  const directory = await createMigrationDirectory();

  try {
    const { createPostgresDatabaseManager } = await import("../dist/index.js");
    const manager = createPostgresDatabaseManager({
      isEnabled: () => false,
      getDatabaseUrl: () => null,
      resolveMigrationsDirectory: () => directory,
    });

    const status = await manager.getMigrationStatus();
    assert.equal(status.enabled, false);
    assert.equal(status.appliedCount, 0);
    assert.equal(status.pendingCount, 2);

    const probe = await manager.probeReadiness();
    assert.deepEqual(probe, {
      enabled: false,
      ready: false,
      detail: null,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("run contracts are shared from packages/db", async () => {
  const { runAggregateSchema, runEventEnvelopeSchema } = await import("../dist/index.js");

  const run = {
    runId: "run_00000001",
    workspaceId: "wsp_test_workspace",
    taskVersionId: "tsv_test_tax",
    sessionVersionId: "sev_test_agent",
    requestedByUserId: "usr_test_owner",
    title: "Tax filing",
    targetPath: "workspace://runs/run_00000001/",
    entrySurface: "dashboard",
    catalogMetadata: null,
    status: "CREATED",
    statusReason: null,
    createdAt: "2026-07-10T10:00:00.000Z",
    updatedAt: "2026-07-10T10:00:00.000Z",
  };

  const aggregate = {
    run,
    runtime: {},
    messages: [],
    files: [],
    artifacts: [],
    approvals: [],
    input: {
      workspaceId: run.workspaceId,
      taskVersionId: run.taskVersionId,
      sessionVersionId: run.sessionVersionId,
      requestedByUserId: run.requestedByUserId,
      title: run.title,
      targetPath: run.targetPath,
      entrySurface: run.entrySurface,
      initialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      catalogMetadata: null,
    },
    startJob: {
      run,
      initialPrompt: "Please tell me what information I need to provide to you.",
      requestedInitialMessage: null,
      bindings: {
        firstPartyMcpIds: [],
        externalConnectorRefs: [],
        credentialIds: [],
      },
      credentialMounts: [],
      mcpBindings: [],
      mcpNetworkPolicies: [],
    },
  };

  const parsedAggregate = runAggregateSchema.parse(aggregate);
  assert.equal(parsedAggregate.run.runId, run.runId);

  const envelope = runEventEnvelopeSchema.parse({
    eventId: "evt_00000001",
    runId: run.runId,
    event: {
      type: "heartbeat",
      runId: run.runId,
      occurredAt: "2026-07-10T10:01:00.000Z",
    },
  });
  assert.equal(envelope.runId, run.runId);
});

test("shared PostgresRunsRepository persists aggregates through packages/db", async () => {
  const { PostgresRunsRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  let readyChecks = 0;
  const repository = new PostgresRunsRepository({
    ensureReady: async () => {
      readyChecks += 1;
    },
    getQueryable: () => fakePool,
  });

  await repository.init();
  assert.deepEqual(repository.list(), []);

  const created = await repository.save(createRunAggregate("run_repo_0001"));
  assert.equal(created.run.runId, "run_repo_0001");
  assert.equal(repository.get("run_repo_0001")?.run.status, "CREATED");
  assert.equal(fakePool.tables.lingban_runs.length, 1);

  const updated = await repository.update("run_repo_0001", (current) => ({
    ...current,
    run: {
      ...current.run,
      status: "RUNNING",
      updatedAt: "2026-07-10T10:10:00.000Z",
    },
  }));
  assert.equal(updated?.run.status, "RUNNING");
  assert.equal(repository.get("run_repo_0001")?.run.status, "RUNNING");

  const reloaded = new PostgresRunsRepository({
    getQueryable: () => fakePool,
  });
  await reloaded.init();
  assert.equal(reloaded.get("run_repo_0001")?.run.status, "RUNNING");

  await repository.clear();
  assert.deepEqual(repository.list(), []);
  assert.equal(fakePool.tables.lingban_runs.length, 0);
  assert.equal(readyChecks >= 3, true);
});

test("shared PostgresRunEventBus persists backlog through packages/db", async () => {
  const { PostgresRunEventBus } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const bus = new PostgresRunEventBus({
    getQueryable: () => fakePool,
  });
  const seen = [];

  await bus.init();
  const unsubscribe = bus.subscribe("run_evt_0001", (envelope) => {
    seen.push(envelope.eventId);
  });

  const envelope = await bus.append({
    type: "heartbeat",
    runId: "run_evt_0001",
    occurredAt: "2026-07-10T11:00:00.000Z",
  });
  assert.equal(envelope.runId, "run_evt_0001");
  assert.equal(bus.list("run_evt_0001").length, 1);
  assert.deepEqual(seen, [envelope.eventId]);
  unsubscribe();

  const reloaded = new PostgresRunEventBus({
    getQueryable: () => fakePool,
  });
  await reloaded.init();
  assert.equal(reloaded.list("run_evt_0001").length, 1);
  assert.equal(reloaded.list("run_evt_0001")[0].event.type, "heartbeat");
});

test("shared PostgresRunFilesIndexRepository persists indexed files through packages/db", async () => {
  const { PostgresRunFilesIndexRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresRunFilesIndexRepository({
    getQueryable: () => fakePool,
  });

  await repository.init();
  assert.deepEqual(repository.listRunFiles("run_file_0001"), []);

  const created = await repository.upsertRunFile(createRunFileRecord("run_file_0001"));
  assert.equal(created.runId, "run_file_0001");
  assert.equal(repository.getRunFile("run_file_0001", created.path)?.name, "report.pdf");
  assert.equal(fakePool.tables.lingban_run_files.length, 1);

  await repository.replaceRunFiles("run_file_0001", [
    createRunFileRecord("run_file_0001", "C:/runs/run_file_0001/outputs/summary.txt"),
  ]);
  assert.equal(repository.listRunFiles("run_file_0001").length, 1);
  assert.equal(
    repository.listRunFiles("run_file_0001")[0].path,
    "C:/runs/run_file_0001/outputs/summary.txt"
  );

  const reloaded = new PostgresRunFilesIndexRepository({
    getQueryable: () => fakePool,
  });
  await reloaded.init();
  assert.equal(reloaded.listRunFiles("run_file_0001").length, 1);

  await repository.clear();
  assert.deepEqual(repository.listRunFiles("run_file_0001"), []);
  assert.equal(fakePool.tables.lingban_run_files.length, 0);
});

test("shared PostgresRunQueryRepository loads and updates cached snapshots through packages/db", async () => {
  const {
    PostgresRunQueryRepository,
    PostgresRunsRepository,
    projectRunSnapshot,
  } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const runsRepository = new PostgresRunsRepository({
    getQueryable: () => fakePool,
  });
  const queryRepository = new PostgresRunQueryRepository({
    getQueryable: () => fakePool,
  });

  await runsRepository.init();
  const created = await runsRepository.save(createRunAggregate("run_query_0001"));

  await queryRepository.init();
  assert.equal(queryRepository.getSnapshot("run_query_0001")?.run.title, created.run.title);

  const updated = await runsRepository.update("run_query_0001", (current) => ({
    ...current,
    run: {
      ...current.run,
      status: "RUNNING",
      updatedAt: "2026-07-10T10:20:00.000Z",
    },
    messages: [
      ...current.messages,
      {
        messageId: "msg_query_0001",
        runId: current.run.runId,
        role: "agent",
        kind: "text",
        text: "Query cache updated.",
        attachments: [],
        createdAt: "2026-07-10T10:20:00.000Z",
      },
    ],
  }));

  await queryRepository.upsertSnapshot(projectRunSnapshot(updated));
  assert.equal(queryRepository.getSnapshot("run_query_0001")?.run.status, "RUNNING");
  assert.equal(queryRepository.getSnapshot("run_query_0001")?.messages.length, 1);

  await queryRepository.clear();
  assert.deepEqual(queryRepository.listSnapshots(), []);
});

test("shared PostgresBridgeRegistrationRepository persists bridge registrations through packages/db", async () => {
  const { PostgresBridgeRegistrationRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresBridgeRegistrationRepository({
    getQueryable: () => fakePool,
  });

  await repository.init();
  assert.deepEqual(await repository.list(), []);

  const registration = createBridgeRegistration();
  await repository.save(registration);

  assert.equal((await repository.list())[0]?.bridgeId, registration.bridgeId);
  assert.equal(fakePool.tables.lingban_bridge_registrations.length, 1);

  const reloaded = new PostgresBridgeRegistrationRepository({
    getQueryable: () => fakePool,
  });
  await reloaded.init();

  assert.equal((await reloaded.list())[0]?.runId, registration.runId);

  await repository.delete(registration.runId);
  assert.deepEqual(await repository.list(), []);

  await repository.save(createBridgeRegistration("run_bridge_db_0002"));
  assert.equal(fakePool.tables.lingban_bridge_registrations.length, 1);
  await repository.clear();
  assert.deepEqual(await repository.list(), []);
  assert.equal(fakePool.tables.lingban_bridge_registrations.length, 0);
});

test("shared PostgresBillingRepository persists billing ledger entries through packages/db", async () => {
  const { PostgresBillingRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresBillingRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listEntries(), []);

  const entry = createBillingEntry();
  await repository.saveEntry(entry);

  assert.equal(repository.getEntryById(entry.entryId)?.amountUsd, entry.amountUsd);
  assert.equal(fakePool.tables.lingban_billing_entries.length, 1);

  const reloaded = new PostgresBillingRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();

  assert.equal(reloaded.listEntries()[0]?.entryId, entry.entryId);

  await repository.saveEntry({
    ...entry,
    amountUsd: 5.12,
    updatedAt: "2026-07-10T08:20:00.000Z",
  });
  assert.equal(repository.getEntryById(entry.entryId)?.amountUsd, 5.12);
  assert.equal(fakePool.tables.lingban_billing_entries.length, 1);
});

test("shared PostgresWorkshopCatalogRepository persists catalog state and launch template updates through packages/db", async () => {
  const { PostgresWorkshopCatalogRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const context = createWorkspaceContextSummary();
  const workshop = createWorkshopCatalogRecord();
  const service = createServiceCatalogRecord();
  const template = createLaunchTemplateRecord();
  fakePool.tables.lingban_workshop_contexts.push({
    context_key: context.contextKey,
    runtime_workspace_id: context.runtimeWorkspaceId,
    context_json: clone(context),
  });
  fakePool.tables.lingban_catalog_workshops.push({
    workshop_id: workshop.workshopId,
    scope: workshop.scope,
    status: workshop.status,
    workshop_json: clone(workshop),
  });
  fakePool.tables.lingban_catalog_services.push({
    service_id: service.serviceId,
    workshop_id: service.workshopId,
    status: service.status,
    service_json: clone(service),
  });
  fakePool.tables.lingban_catalog_launch_templates.push({
    template_key: template.templateKey,
    service_id: template.serviceId,
    workspace_context_key: template.workspaceContextKey,
    entry_surface: template.entrySurface,
    template_json: clone(template),
  });

  const repository = new PostgresWorkshopCatalogRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.equal(repository.getContextByKey(context.contextKey)?.runtimeWorkspaceId, context.runtimeWorkspaceId);
  assert.equal(repository.getWorkshopById(workshop.workshopId)?.defaultServiceId, service.serviceId);
  assert.equal(repository.getServiceById(service.serviceId)?.workshopId, workshop.workshopId);
  assert.equal(
    repository.findLaunchTemplate(service.serviceId, context.contextKey, "dashboard")?.targetRoot,
    template.targetRoot
  );

  await repository.saveLaunchTemplate({
    ...template,
    targetRoot: "/workspace/harbor-finance/q2/hk/",
  });
  assert.equal(
    repository.findLaunchTemplate(service.serviceId, context.contextKey, "dashboard")?.targetRoot,
    "/workspace/harbor-finance/q2/hk/"
  );
  assert.equal(fakePool.tables.lingban_catalog_launch_templates.length, 1);

  const reloaded = new PostgresWorkshopCatalogRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();
  assert.equal(
    reloaded.findLaunchTemplate(service.serviceId, context.contextKey, "dashboard")?.targetRoot,
    "/workspace/harbor-finance/q2/hk/"
  );

  await repository.deleteLaunchTemplates([template.templateKey]);
  assert.deepEqual(repository.listLaunchTemplates(), []);
  assert.equal(fakePool.tables.lingban_catalog_launch_templates.length, 0);
  assert.equal(fakePool.tables.lingban_workshop_contexts.length, 1);
  assert.equal(fakePool.tables.lingban_catalog_workshops.length, 1);
  assert.equal(fakePool.tables.lingban_catalog_services.length, 1);
});

test("shared PostgresQuotaRepository persists policies, counters, events, and overrides through packages/db", async () => {
  const { PostgresQuotaRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresQuotaRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listPolicies(), []);

  const policy = createQuotaPolicy();
  const counter = createQuotaCounter(undefined, policy.policyId);
  const override = createQuotaOverrideRecord(undefined, policy.policyId);
  const event = createQuotaEvent(undefined, policy.policyId, override.overrideId);

  await repository.savePolicy(policy);
  await repository.saveCounter(counter);
  await repository.saveOverride(override);
  await repository.saveEvent(event);

  assert.equal(repository.getPolicyById(policy.policyId)?.metric, "daily_runs");
  assert.equal(repository.listCounters()[0]?.counterId, counter.counterId);
  assert.equal(repository.getOverrideById(override.overrideId)?.status, "pending");
  assert.equal(repository.listEvents()[0]?.eventId, event.eventId);
  assert.equal(fakePool.tables.lingban_quota_policies.length, 1);
  assert.equal(fakePool.tables.lingban_quota_counters.length, 1);
  assert.equal(fakePool.tables.lingban_quota_events.length, 1);
  assert.equal(fakePool.tables.lingban_quota_overrides.length, 1);

  await repository.savePolicy({
    ...policy,
    enabled: false,
    updatedAt: "2026-07-10T09:20:00.000Z",
  });
  assert.equal(repository.getPolicyById(policy.policyId)?.enabled, false);
  assert.equal(fakePool.tables.lingban_quota_policies.length, 1);

  const reloaded = new PostgresQuotaRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();
  assert.equal(reloaded.getPolicyById(policy.policyId)?.enabled, false);
  assert.equal(reloaded.getOverrideById(override.overrideId)?.metric, override.metric);
});

test("shared PostgresAuthRepository persists users, workspaces, memberships, invitations, and sessions through packages/db", async () => {
  const { PostgresAuthRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresAuthRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listUsers(), []);

  const user = createAuthUserRecord();
  const workspace = createAuthWorkspace();
  const membership = createAuthMembership(workspace.workspaceId, user.userId);
  const invitation = createAuthInvitationRecord(undefined, workspace.workspaceId);
  const session = createAuthSessionRecord(undefined, user.userId, workspace.workspaceId);

  await repository.createUser(user);
  await repository.createWorkspace(workspace);
  await repository.addMembership(membership);
  await repository.saveInvitation(invitation);
  await repository.createSession(session);

  assert.equal(repository.findUserByEmail(user.email)?.userId, user.userId);
  assert.equal(repository.getWorkspaceById(workspace.workspaceId)?.slug, workspace.slug);
  assert.equal(repository.getMembership(workspace.workspaceId, user.userId)?.role, membership.role);
  assert.equal(repository.getInvitationById(invitation.invitationId)?.email, invitation.email);
  assert.equal(repository.findSessionByAccessTokenHash(session.accessTokenHash)?.sessionId, session.sessionId);
  assert.equal(fakePool.tables.lingban_users.length, 1);
  assert.equal(fakePool.tables.lingban_workspaces.length, 1);
  assert.equal(fakePool.tables.lingban_workspace_memberships.length, 1);
  assert.equal(fakePool.tables.lingban_workspace_invitations.length, 1);
  assert.equal(fakePool.tables.lingban_auth_sessions.length, 1);

  await repository.updateSession({
    ...session,
    accessTokenHash: "access_hash_db_0002",
    refreshTokenHash: "refresh_hash_db_0002",
    revokedAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T09:00:00.000Z",
  });

  assert.equal(repository.findSessionByAccessTokenHash("access_hash_db_0001"), null);
  assert.equal(
    repository.findSessionByAccessTokenHash("access_hash_db_0002")?.revokedAt,
    "2026-07-10T09:00:00.000Z"
  );

  const reloaded = new PostgresAuthRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();
  assert.equal(reloaded.findUserByEmail(user.email)?.displayName, user.displayName);
  assert.equal(reloaded.listMembershipsByUser(user.userId)[0]?.workspace.workspaceId, workspace.workspaceId);
  assert.equal(reloaded.listInvitationsByWorkspace(workspace.workspaceId)[0]?.invitationId, invitation.invitationId);
  assert.equal(reloaded.getSessionById(session.sessionId)?.accessTokenHash, "access_hash_db_0002");
});

test("shared PostgresCreatorRepository persists package, release, replay, gate, activation, and audit export records through packages/db", async () => {
  const { PostgresCreatorRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresCreatorRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listPackages(), []);

  const pkg = createCreatorPackageDetail();
  const release = createCreatorReleaseSummary(undefined, pkg.packageId);
  const replay = createCreatorReplaySummary(undefined, pkg.packageId);
  const gate = createCreatorReleaseGate(undefined, release.releaseId, pkg.packageId);
  const activation = createCreatorReleaseActivation(undefined, release.releaseId, pkg.packageId);
  const auditExport = createCreatorAuditExportRecord(undefined, pkg.packageId);

  await repository.savePackage(pkg);
  await repository.saveRelease(release);
  await repository.saveReplay(replay);
  await repository.saveReleaseGate(gate);
  await repository.saveReleaseActivation(activation);
  await repository.saveAuditExport(auditExport);

  assert.equal(repository.getPackageById(pkg.packageId)?.title.en, pkg.title.en);
  assert.equal(repository.getReleaseById(release.releaseId)?.state, release.state);
  assert.equal(repository.listReplaysByPackage(pkg.packageId)[0]?.replayId, replay.replayId);
  assert.equal(repository.listReleaseGatesByRelease(release.releaseId)[0]?.gateId, gate.gateId);
  assert.equal(
    repository.listReleaseActivationsByRelease(release.releaseId)[0]?.activationId,
    activation.activationId
  );
  assert.equal(repository.getAuditExportById(auditExport.exportId)?.fileName, auditExport.fileName);
  assert.equal(fakePool.tables.lingban_creator_packages.length, 1);
  assert.equal(fakePool.tables.lingban_creator_releases.length, 1);
  assert.equal(fakePool.tables.lingban_creator_replays.length, 1);
  assert.equal(fakePool.tables.lingban_creator_release_gates.length, 1);
  assert.equal(fakePool.tables.lingban_creator_release_activations.length, 1);
  assert.equal(fakePool.tables.lingban_creator_audit_exports.length, 1);

  const reloaded = new PostgresCreatorRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();
  assert.equal(reloaded.getPackageById(pkg.packageId)?.release.summary.en, pkg.release.summary.en);
  assert.equal(reloaded.listReleasesByPackage(pkg.packageId)[0]?.releaseId, release.releaseId);
  assert.equal(reloaded.listAuditExportsByPackage(pkg.packageId)[0]?.exportId, auditExport.exportId);
});

test("shared PostgresCredentialsRepository persists credential records through packages/db", async () => {
  const { PostgresCredentialsRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresCredentialsRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.list(), []);

  const record = createStoredCredentialRecord();
  await repository.save(record);

  assert.equal(repository.getById(record.credentialId)?.provider, record.provider);
  assert.equal(repository.getById(record.credentialId)?.secretVersion, record.secretVersion);
  assert.equal(fakePool.tables.lingban_credentials.length, 1);

  await repository.save({
    ...record,
    status: "needs-rotation",
    secretVersion: 3,
    updatedAt: "2026-07-10T11:00:00.000Z",
  });
  assert.equal(repository.getById(record.credentialId)?.status, "needs-rotation");
  assert.equal(repository.getById(record.credentialId)?.secretVersion, 3);
  assert.equal(fakePool.tables.lingban_credentials.length, 1);

  const reloaded = new PostgresCredentialsRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();
  assert.equal(reloaded.getById(record.credentialId)?.status, "needs-rotation");
  assert.equal(reloaded.getById(record.credentialId)?.secretRef, record.secretRef);
});

test("shared PostgresMcpRepository persists registry, bindings, policies, and health snapshots through packages/db", async () => {
  const { PostgresMcpRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresMcpRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listRegistry(), []);

  const entry = createMcpRegistryEntry();
  const binding = createMcpBindingRecord(undefined, entry.mcpId);
  const policy = createMcpNetworkPolicy();
  const snapshot = createMcpHealthSnapshot(undefined, entry.mcpId, binding.bindingId);

  await repository.saveRegistryEntry(entry);
  await repository.saveBinding(binding);
  await repository.saveNetworkPolicy(policy);
  await repository.saveHealthSnapshot(snapshot);

  assert.equal(repository.getRegistryEntry(entry.mcpId)?.transport, entry.transport);
  assert.equal(repository.getBinding(binding.bindingId)?.credentialId, binding.credentialId);
  assert.equal(repository.getNetworkPolicy(policy.policyRef)?.status, policy.status);
  assert.equal(
    repository.getLatestHealthSnapshot({
      mcpId: entry.mcpId,
      bindingId: binding.bindingId,
    })?.snapshotId,
    snapshot.snapshotId
  );
  assert.equal(fakePool.tables.lingban_mcp_registry.length, 1);
  assert.equal(fakePool.tables.lingban_mcp_bindings.length, 1);
  assert.equal(fakePool.tables.lingban_mcp_network_policies.length, 1);
  assert.equal(fakePool.tables.lingban_mcp_health_snapshots.length, 1);

  for (let index = 0; index < 22; index += 1) {
    const suffix = String(index + 2).padStart(4, "0");
    await repository.saveHealthSnapshot({
      ...snapshot,
      snapshotId: `chs_db_${suffix}`,
      probedAt: `2026-07-10T10:${String(index).padStart(2, "0")}:00.000Z`,
      recordedAt: `2026-07-10T10:${String(index).padStart(2, "0")}:05.000Z`,
      latencyMs: 180 + index,
    });
  }

  assert.equal(
    repository.listHealthSnapshots().filter(
      (item) => item.mcpId === entry.mcpId && item.bindingId === binding.bindingId
    ).length,
    20
  );
  assert.equal(fakePool.tables.lingban_mcp_health_snapshots.length, 20);

  const reloaded = new PostgresMcpRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();
  assert.equal(reloaded.getRegistryEntry(entry.mcpId)?.displayName, entry.displayName);
  assert.equal(reloaded.getBinding(binding.bindingId)?.scope, binding.scope);
  assert.equal(reloaded.getNetworkPolicy(policy.policyRef)?.displayName, policy.displayName);
});

test("shared PostgresNotificationsRepository persists read receipts and workspace cursors through packages/db", async () => {
  const { PostgresNotificationsRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresNotificationsRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listReadReceipts("usr_notice_owner", "wsp_notice_team"), []);
  assert.equal(repository.getWorkspaceCursor("usr_notice_owner", "wsp_notice_team"), null);

  await repository.saveReadReceipt({
    notificationId: "ntc_run_failed",
    userId: "usr_notice_owner",
    workspaceId: "wsp_notice_team",
    readAt: "2026-07-10T10:15:00.000Z",
  });
  await repository.saveWorkspaceCursor({
    userId: "usr_notice_owner",
    workspaceId: "wsp_notice_team",
    markedAllReadAt: "2026-07-10T10:20:00.000Z",
  });

  assert.equal(
    repository.listReadReceipts("usr_notice_owner", "wsp_notice_team")[0]?.notificationId,
    "ntc_run_failed"
  );
  assert.equal(
    repository.getWorkspaceCursor("usr_notice_owner", "wsp_notice_team")?.markedAllReadAt,
    "2026-07-10T10:20:00.000Z"
  );
  assert.equal(fakePool.tables.lingban_notification_read_receipts.length, 1);
  assert.equal(fakePool.tables.lingban_notification_read_cursors.length, 1);

  const reloaded = new PostgresNotificationsRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();

  assert.equal(
    reloaded.listReadReceipts("usr_notice_owner", "wsp_notice_team")[0]?.notificationId,
    "ntc_run_failed"
  );
  assert.equal(
    reloaded.getWorkspaceCursor("usr_notice_owner", "wsp_notice_team")?.markedAllReadAt,
    "2026-07-10T10:20:00.000Z"
  );
});

test("shared PostgresMeRecentActivitiesRepository persists recent activity records through packages/db", async () => {
  const { PostgresMeRecentActivitiesRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresMeRecentActivitiesRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listRecentActivities("usr_recent_owner", "harbor-finance"), []);

  await repository.saveRecentActivity({
    activityId: "act_recent_run",
    userId: "usr_recent_owner",
    workspaceId: "wsp_test_workspace",
    workspaceContextKey: "harbor-finance",
    resourceType: "run",
    resourceId: "run_recent_0001",
    interaction: "resume",
    sourceSurface: "dashboard",
    workshopId: "tax-operations",
    serviceId: "hk-quarterly-tax",
    runId: "run_recent_0001",
    createdAt: "2026-07-10T11:00:00.000Z",
    updatedAt: "2026-07-10T11:05:00.000Z",
  });

  assert.equal(
    repository.listRecentActivities("usr_recent_owner", "harbor-finance")[0]?.resourceId,
    "run_recent_0001"
  );
  assert.equal(fakePool.tables.lingban_me_recent_activities.length, 1);

  const reloaded = new PostgresMeRecentActivitiesRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();

  assert.equal(
    reloaded.listRecentActivities("usr_recent_owner", "harbor-finance", ["run"])[0]?.resourceId,
    "run_recent_0001"
  );
});

test("shared PostgresBatchRunsRepository persists batch jobs and items through packages/db", async () => {
  const { PostgresBatchRunsRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresBatchRunsRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listJobs(), []);

  const job = createBatchRunJob("bat_job_db_0001", "validated");
  const items = createBatchRunItems(job.batchJobId);
  await repository.saveBatch(job, items);

  assert.equal(repository.getJob(job.batchJobId)?.status, "validated");
  assert.equal(repository.listItems(job.batchJobId).length, 2);
  assert.equal(fakePool.tables.lingban_batch_run_jobs.length, 1);
  assert.equal(fakePool.tables.lingban_batch_run_items.length, 2);

  const reloaded = new PostgresBatchRunsRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();

  assert.equal(reloaded.listJobs()[0]?.batchJobId, job.batchJobId);
  assert.equal(reloaded.listItems(job.batchJobId)[0]?.batchItemId, "bat_item_db_0001");

  await repository.clear();
  assert.deepEqual(repository.listJobs(), []);
  assert.equal(fakePool.tables.lingban_batch_run_jobs.length, 0);
  assert.equal(fakePool.tables.lingban_batch_run_items.length, 0);
});

test("shared PostgresMeFavoritesRepository persists favorite workshops through packages/db", async () => {
  const { PostgresMeFavoritesRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresMeFavoritesRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listFavoriteWorkshops("usr_test_owner", "harbor-finance"), []);

  const saved = await repository.saveFavoriteWorkshop(createFavoriteWorkshopRecord());
  assert.equal(saved.workshopId, "tax-operations");
  assert.equal(
    repository.getFavoriteWorkshop("usr_test_owner", "harbor-finance", "tax-operations")
      ?.favoriteId,
    saved.favoriteId
  );
  assert.equal(fakePool.tables.lingban_me_favorite_workshops.length, 1);

  const reloaded = new PostgresMeFavoritesRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();
  assert.equal(
    reloaded.listFavoriteWorkshops("usr_test_owner", "harbor-finance")[0]?.workshopId,
    "tax-operations"
  );

  const deleted = await repository.deleteFavoriteWorkshop(
    "usr_test_owner",
    "harbor-finance",
    "tax-operations"
  );
  assert.equal(deleted, true);
  assert.equal(
    repository.getFavoriteWorkshop("usr_test_owner", "harbor-finance", "tax-operations"),
    null
  );
  assert.equal(fakePool.tables.lingban_me_favorite_workshops.length, 0);
});

test("shared PostgresSearchRepository persists history entries, click events, and retention pruning through packages/db", async () => {
  const { PostgresSearchRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresSearchRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.equal(repository.getSearchHistory("usr_search_owner", "harbor-finance", "brand poster"), null);

  await repository.saveSearchHistory({
    historyId: "hst_brand_poster",
    userId: "usr_search_owner",
    workspaceId: "wsp_test_workspace",
    workspaceContextKey: "harbor-finance",
    query: "Brand Poster",
    normalizedQuery: "brand poster",
    resourceTypes: ["workshop", "service"],
    createdAt: "2026-07-10T11:00:00.000Z",
    updatedAt: "2026-07-10T11:05:00.000Z",
  });
  await repository.appendSearchClickEvent({
    eventId: "clk_brand_poster_1",
    userId: "usr_search_owner",
    workspaceId: "wsp_test_workspace",
    workspaceContextKey: "harbor-finance",
    query: "Brand Poster",
    normalizedQuery: "brand poster",
    documentId: "doc_poster_suite",
    resourceType: "workshop",
    resourceId: "brand-poster-suite",
    rank: 0,
    sourceSurface: "dashboard",
    createdAt: "2026-07-10T11:06:00.000Z",
    updatedAt: "2026-07-10T11:06:00.000Z",
  });

  assert.equal(
    repository.getSearchHistory("usr_search_owner", "harbor-finance", "brand poster")?.historyId,
    "hst_brand_poster"
  );
  assert.equal(
    repository.listSearchClickEvents("usr_search_owner", "harbor-finance", "brand poster")[0]?.eventId,
    "clk_brand_poster_1"
  );
  assert.equal(fakePool.tables.lingban_search_history_entries.length, 1);
  assert.equal(fakePool.tables.lingban_search_click_events.length, 1);

  const reloaded = new PostgresSearchRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();

  assert.equal(
    reloaded.listSearchHistory("usr_search_owner", "harbor-finance")[0]?.historyId,
    "hst_brand_poster"
  );
  assert.equal(
    reloaded.listSearchClickEvents("usr_search_owner", "harbor-finance")[0]?.eventId,
    "clk_brand_poster_1"
  );
});

test("shared PostgresSessionArchiveRecordRepository persists imported session archive records through packages/db", async () => {
  const { PostgresSessionArchiveRecordRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresSessionArchiveRecordRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listImportedArchives(), []);

  const created = await repository.saveImportedArchiveRecord(
    createImportedSessionPackRecord("sev_imported_pack_db_0001")
  );
  assert.equal(created.sessionVersionId, "sev_imported_pack_db_0001");
  assert.equal(
    repository.getImportedArchiveBySessionVersionId("sev_imported_pack_db_0001")?.archiveSource,
    "imported"
  );
  assert.equal(fakePool.tables.lingban_session_archives.length, 1);

  const reloaded = new PostgresSessionArchiveRecordRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();

  assert.equal(
    reloaded.listImportedArchives()[0]?.sessionVersionId,
    "sev_imported_pack_db_0001"
  );
});

test("shared PostgresUploadRepository persists uploads and download tickets through packages/db", async () => {
  const { PostgresUploadRepository } = await import("../dist/index.js");
  const fakePool = createFakePostgresPool();
  const repository = new PostgresUploadRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => {
      await fakePool.query("BEGIN");

      try {
        const result = await fn(fakePool);
        await fakePool.query("COMMIT");
        return result;
      } catch (error) {
        await fakePool.query("ROLLBACK");
        throw error;
      }
    },
  });

  await repository.init();
  assert.deepEqual(repository.listUploads(), []);
  assert.deepEqual(repository.listDownloadTickets(), []);

  const upload = await repository.createUpload(createRunUploadRecord());
  const ticket = await repository.createDownloadTicket(createRunDownloadTicket());

  assert.equal(repository.getUpload(upload.uploadId)?.fileName, "receipt.pdf");
  assert.equal(
    repository.findUploadByAttachedPath(upload.runId, "/attachments/receipt.pdf")?.uploadId,
    upload.uploadId
  );
  assert.equal(repository.getDownloadTicket(ticket.ticketId)?.sourceKind, "uploaded-object");
  assert.equal(fakePool.tables.lingban_run_uploads.length, 1);
  assert.equal(fakePool.tables.lingban_download_tickets.length, 1);

  const reloaded = new PostgresUploadRepository({
    getQueryable: () => fakePool,
    withTransaction: async (fn) => fn(fakePool),
  });
  await reloaded.init();

  assert.equal(reloaded.listUploadsByRun("run_upload_0001").length, 1);
  assert.equal(reloaded.listDownloadTickets().length, 1);
});

test("runPostgresDatabaseCli dispatches migrate, reset, and seed commands", async () => {
  const events = [];
  const stdout = {
    log(message) {
      events.push(String(message));
    },
  };
  const { runPostgresDatabaseCli } = await import("../dist/index.js");

  const manager = {
    async getMigrationStatus() {
      return {
        enabled: true,
        directory: "/tmp/migrations",
        migrations: [],
        appliedCount: 0,
        pendingCount: 0,
      };
    },
    async runMigrations(options = {}) {
      return {
        enabled: true,
        directory: "/tmp/migrations",
        migrations: [],
        appliedCount: options.dryRun ? 0 : 1,
        pendingCount: 0,
        newlyAppliedVersions: options.dryRun ? [] : ["0001_bootstrap"],
        newlyAppliedCount: options.dryRun ? 0 : 1,
      };
    },
  };

  await runPostgresDatabaseCli(
    {
      programName: "node dist/migrate.js",
      manager,
      stdout,
      reset: async () => ({ reset: true }),
      seed: async () => ({ seeded: true }),
    },
    ["status"]
  );
  await runPostgresDatabaseCli(
    {
      programName: "node dist/migrate.js",
      manager,
      stdout,
      reset: async () => ({ reset: true }),
      seed: async () => ({ seeded: true }),
    },
    ["dry-run"]
  );
  await runPostgresDatabaseCli(
    {
      programName: "node dist/migrate.js",
      manager,
      stdout,
      reset: async () => ({ reset: true }),
      seed: async () => ({ seeded: true }),
    },
    ["reset", "--confirm-reset"]
  );
  await runPostgresDatabaseCli(
    {
      programName: "node dist/migrate.js",
      manager,
      stdout,
      reset: async () => ({ reset: true }),
      seed: async () => ({ seeded: true }),
    },
    ["seed"]
  );

  assert.equal(events.some((line) => line.includes('"reset": true')), true);
  assert.equal(events.some((line) => line.includes('"seeded": true')), true);
  assert.equal(events.some((line) => line.includes('"newlyAppliedVersions"')), true);

  await assert.rejects(
    runPostgresDatabaseCli(
      {
        programName: "node dist/migrate.js",
        manager,
        stdout,
        reset: async () => ({ reset: true }),
      },
      ["reset"]
    ),
    /--confirm-reset/
  );
});

test("in-memory session asset repository persists replay evidence and enforces draft concurrency", async () => {
  const { InMemorySessionAssetRepository } = await import("../dist/index.js");
  const repository = new InMemorySessionAssetRepository();
  const at = "2026-07-17T00:00:00.000Z";
  await repository.createSession({
    sessionId: "ses_replay_repo",
    workspaceId: "wsp_replay_repo",
    name: "Replay repository",
    description: "",
    taskFamily: null,
    status: "active",
    createdByUserId: null,
    createdAt: at,
    updatedAt: at,
  });
  const draft = await repository.createDraft({
    draftId: "sdf_replay_repo",
    sessionId: "ses_replay_repo",
    sourceCaptureId: "cap_replay_repo",
    parentSessionVersionId: null,
    status: "editing",
    currentRevisionId: null,
    createdByUserId: null,
    version: 1,
    createdAt: at,
    updatedAt: at,
  });
  const revision = {
    revisionId: "sdr_replay_repo",
    draftId: draft.draftId,
    revisionNumber: 1,
    inputFingerprint: "a".repeat(64),
    workspaceSelection: {
      targetPath: "/workspace/target",
      includeGlobs: ["**/*"],
      excludeGlobs: [".git/**"],
      includeArtifacts: true,
      maxFiles: 100,
      maxBytes: 1024,
    },
    redactionRules: [],
    candidateObjectKey: "session-drafts/replay.pack",
    candidateSha256: "b".repeat(64),
    candidateSizeBytes: 128,
    validationReport: { valid: true },
    securityReport: { passed: true },
    createdByUserId: null,
    createdAt: at,
  };
  const revisedDraft = {
    ...draft,
    status: "ready_to_seal",
    currentRevisionId: revision.revisionId,
    version: 2,
    updatedAt: at,
  };
  assert.ok(await repository.addRevision(revisedDraft, revision, 1));

  const replay = {
    replayId: "replay_repo_0001",
    draftId: draft.draftId,
    revisionId: revision.revisionId,
    mode: "restore-validation",
    validatorVersion: "session-replay/v1",
    status: "passed",
    candidateSha256: revision.candidateSha256,
    checks: [{ checkId: "workspace-inventory", status: "passed", detail: "verified", expected: null, actual: null }],
    restoredFileCount: 1,
    restoredBytes: 16,
    eventCount: 2,
    conversationMessageCount: 1,
    toolEventCount: 0,
    approvalEventCount: 0,
    failureCode: null,
    createdByUserId: null,
    startedAt: at,
    finishedAt: at,
  };
  const replayedDraft = { ...revisedDraft, version: 3 };
  assert.ok(await repository.addReplay(replay, replayedDraft, 2));
  assert.equal((await repository.listReplays(draft.draftId))[0].replayId, replay.replayId);
  assert.equal(await repository.addReplay({ ...replay, replayId: "replay_repo_stale" }, { ...replayedDraft, version: 4 }, 2), null);

  const sealed = await repository.sealVersion({
    version: {
      sessionVersionId: "sev_replay_repo",
      sessionId: "ses_replay_repo",
      sealedFromRevisionId: revision.revisionId,
      sealedFromReplayId: replay.replayId,
      parentSessionVersionId: null,
      manifestVersion: "lingban.session-pack/v2",
      packObjectKey: "session-versions/replay.pack",
      packSha256: "c".repeat(64),
      packSizeBytes: 256,
      signatureAlgorithm: "hmac-sha256",
      signatureKeyId: "key_test",
      signatureValue: "signature",
      contentState: "sealed",
      sealedByUserId: null,
      sealedAt: at,
    },
    draft: { ...replayedDraft, status: "sealed", version: 4 },
    expectedDraftVersion: 3,
    lineage: null,
  });
  assert.equal(sealed.sealedFromReplayId, replay.replayId);
});
