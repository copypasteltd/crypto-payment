import test from "node:test";
import assert from "node:assert/strict";

const expectedVersions = [
  "0001_runs_and_events",
  "0002_auth_and_workspaces",
  "0003_uploads_and_download_tickets",
  "0004_workshop_catalog",
  "0005_creator_catalog",
  "0006_run_files_index",
  "0007_creator_release_gate_activation",
  "0007_internal_callback_ledger",
  "0008_credentials_and_mcps",
  "0009_creator_audit_exports",
  "0010_quota_domain",
  "0011_billing_ledger",
  "0012_bridge_registry",
  "0013_auth_workspace_invitations",
  "0014_notifications_read_state",
  "0015_me_favorite_workshops",
  "0016_me_recent_activities",
  "0017_search_history_and_click_events",
  "0018_mcp_call_audits",
  "0019_mcp_network_policies",
  "0020_mcp_health_snapshots",
  "0021_credential_materializations",
  "0022_credential_audit_events",
  "0023_credential_lifecycle_callback_deliveries",
  "0024_mcp_governance_events",
  "0025_batch_runs",
  "0026_session_archives",
  "0027_mcp_global_workspace_nullable",
  "0028_credentials_workspace_owner_nullable",
  "0029_admin_control_plane",
];

test("database migrations are discoverable, dry-runnable, and idempotently applied", async () => {
  const envBackup = new Map();
  const envKeys = ["DATABASE_URL", "LINGBAN_RUNS_STORE"];
  for (const key of envKeys) {
    envBackup.set(key, process.env[key]);
  }

  try {
    process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/lingban_workshop";
    process.env.LINGBAN_RUNS_STORE = "postgres";

    const [
      { createFakePostgresPool },
      {
        getApiDatabaseMigrationStatus,
        runApiDatabaseMigrations,
        resetApiDatabaseForTests,
        setApiDatabasePoolFactoryForTests,
      },
      { resetApiRuntimeConfigForTests },
    ] = await Promise.all([
      import("./support/fake-postgres-pool.mjs"),
      import("../dist/app/database.js"),
      import("../dist/app/runtime.js"),
    ]);

    await resetApiDatabaseForTests();
    resetApiRuntimeConfigForTests();

    const fakePool = createFakePostgresPool();
    setApiDatabasePoolFactoryForTests(() => fakePool);

    const statusBefore = await getApiDatabaseMigrationStatus();
    assert.equal(statusBefore.enabled, true);
    assert.deepEqual(
      statusBefore.migrations.map((migration) => migration.version),
      expectedVersions
    );
    assert.equal(statusBefore.appliedCount, 0);
    assert.equal(statusBefore.pendingCount, expectedVersions.length);

    const dryRunResult = await runApiDatabaseMigrations({ dryRun: true });
    assert.equal(dryRunResult.enabled, true);
    assert.equal(dryRunResult.newlyAppliedCount, 0);
    assert.deepEqual(dryRunResult.newlyAppliedVersions, []);
    assert.equal(dryRunResult.appliedCount, 0);
    assert.equal(dryRunResult.pendingCount, expectedVersions.length);

    const appliedResult = await runApiDatabaseMigrations();
    assert.equal(appliedResult.enabled, true);
    assert.equal(appliedResult.newlyAppliedCount, expectedVersions.length);
    assert.deepEqual(appliedResult.newlyAppliedVersions, expectedVersions);
    assert.equal(appliedResult.appliedCount, expectedVersions.length);
    assert.equal(appliedResult.pendingCount, 0);
    assert.equal(appliedResult.migrations.every((migration) => migration.applied), true);
    assert.equal(
      appliedResult.migrations.every((migration) => typeof migration.appliedAt === "string" && migration.appliedAt.length > 0),
      true
    );

    const statusAfter = await getApiDatabaseMigrationStatus();
    assert.equal(statusAfter.enabled, true);
    assert.equal(statusAfter.appliedCount, expectedVersions.length);
    assert.equal(statusAfter.pendingCount, 0);

    const secondRun = await runApiDatabaseMigrations();
    assert.equal(secondRun.newlyAppliedCount, 0);
    assert.deepEqual(secondRun.newlyAppliedVersions, []);
    assert.equal(secondRun.appliedCount, expectedVersions.length);
    assert.equal(secondRun.pendingCount, 0);
  } finally {
    try {
      const [{ resetApiDatabaseForTests }, { resetApiRuntimeConfigForTests }] = await Promise.all([
        import("../dist/app/database.js"),
        import("../dist/app/runtime.js"),
      ]);
      await resetApiDatabaseForTests();
      resetApiRuntimeConfigForTests();
    } catch {
      // Ignore cleanup failures in smoke tests.
    }

    for (const [key, value] of envBackup) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
