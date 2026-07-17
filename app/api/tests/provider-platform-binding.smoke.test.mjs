import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("platform Provider bindings are inherited and credentials require exact Run authorization", async () => {
  const smokeRoot = await mkdtemp(path.join(os.tmpdir(), "lingban-platform-provider-"));
  const keys = [
    "LINGBAN_DATA_DIR",
    "LINGBAN_CREDENTIAL_BROKER_PROVIDER",
    "LINGBAN_CREDENTIAL_BROKER_MASTER_KEY",
  ];
  const backup = new Map(keys.map((key) => [key, process.env[key]]));

  try {
    process.env.LINGBAN_DATA_DIR = path.join(smokeRoot, "data");
    process.env.LINGBAN_CREDENTIAL_BROKER_PROVIDER = "local-envelope";
    process.env.LINGBAN_CREDENTIAL_BROKER_MASTER_KEY = "platform-provider-smoke-master-key";

    const { initializeCredentialsInfrastructure, credentialsService } = await import(
      "../dist/modules/credentials/service.js"
    );
    const { initializeProvidersInfrastructure, providersService } = await import(
      "../dist/modules/providers/service.js"
    );
    await initializeCredentialsInfrastructure();
    await initializeProvidersInfrastructure();

    const adminActor = {
      workspaceId: "wsp_platform_provider_admin",
      userId: "usr_platform_provider_admin",
      role: "owner",
      isPlatformAdmin: true,
    };
    const tenantActor = {
      workspaceId: "wsp_platform_provider_tenant",
      userId: "usr_platform_provider_tenant",
      role: "owner",
      isPlatformAdmin: false,
    };
    const provider = await providersService.createProvider(adminActor, {
      displayName: "Platform shared Provider",
      baseUrl: "https://platform-provider.example.com/v1",
      defaultModel: "gpt-platform-smoke",
    });
    const credential = await credentialsService.createCredential(adminActor, {
      scope: "workspace",
      displayName: "Platform Provider API Key",
      provider: provider.providerId,
      secretKind: "api-key",
      mountMode: "env",
      envName: "OPENAI_API_KEY",
      secretValue: "platform-provider-secret",
      secretRef: null,
    });
    const binding = await providersService.configurePlatformBinding(adminActor, {
      providerId: provider.providerId,
      credentialId: credential.credentialId,
      enabled: true,
      isDefault: true,
      priority: 10,
      allowUserOverride: true,
      notes: "Platform Provider smoke binding",
    });
    assert.equal(binding.scope, "platform");

    const visibleBindings = providersService.listWorkspaceBindings(tenantActor, { enabled: true });
    assert.equal(visibleBindings.length, 1);
    assert.equal(visibleBindings[0].bindingId, binding.bindingId);

    const resolvedProvider = providersService.resolveRunProvider({
      workspaceId: tenantActor.workspaceId,
      requestedByUserId: tenantActor.userId,
      selection: null,
    });
    assert.equal(resolvedProvider?.bindingScope, "platform");
    assert.equal(resolvedProvider?.credentialId, credential.credentialId);

    await assert.rejects(
      credentialsService.resolveRunCredentials({
        workspaceId: tenantActor.workspaceId,
        requestedByUserId: tenantActor.userId,
        credentialIds: [credential.credentialId],
      }),
      (error) => error?.code === "RUN_CREDENTIAL_SCOPE_DENIED"
    );

    const authorized = await credentialsService.resolveRunCredentials({
      workspaceId: tenantActor.workspaceId,
      requestedByUserId: tenantActor.userId,
      credentialIds: [credential.credentialId],
      platformCredentialIds: [credential.credentialId],
    });
    assert.equal(authorized.length, 1);

    const materialized = await credentialsService.materializeRunCredentials({
      runId: "run_platform_provider_smoke",
      workspaceId: tenantActor.workspaceId,
      requestedByUserId: tenantActor.userId,
      mounts: [
        {
          credentialId: credential.credentialId,
          mode: "env",
          envName: "OPENAI_API_KEY",
          readOnly: true,
        },
      ],
      platformCredentialIds: [credential.credentialId],
    });
    assert.equal(materialized.secrets[credential.credentialId], "platform-provider-secret");
    assert.equal(materialized.lease.workspaceId, tenantActor.workspaceId);
  } finally {
    for (const [key, value] of backup.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(smokeRoot, { recursive: true, force: true });
  }
});
