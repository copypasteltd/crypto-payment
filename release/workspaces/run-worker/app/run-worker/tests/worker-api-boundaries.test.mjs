import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkerHostApiBaseUrl } from "../dist/jobs/start-run.js";

test("Session Pack host materialization uses the host API boundary", () => {
  const config = {
    apiBaseUrl: "http://127.0.0.1:38100",
    runtimeApiBaseUrl: "http://host.docker.internal:38130",
  };

  assert.equal(resolveWorkerHostApiBaseUrl(config), "http://127.0.0.1:38100");
  assert.notEqual(resolveWorkerHostApiBaseUrl(config), config.runtimeApiBaseUrl);
});
