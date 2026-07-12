import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

test("batch-runs smoke: postgres-backed batch state persists jobs and items", async () => {
  const scriptPath = path.resolve("tests/batch-runs-postgres.scenario.mjs");

  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: path.resolve("."),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({
        code,
        signal,
        stdout,
        stderr,
      });
    });
  });

  assert.equal(
    result.code,
    0,
    `postgres batch-runs scenario failed (exit=${result.code}, signal=${result.signal ?? "null"})\n${result.stderr || result.stdout}`
  );

  const payloadLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => line.startsWith("{") && line.endsWith("}"));

  assert.ok(payloadLine, `postgres batch-runs scenario did not emit JSON payload\n${result.stdout}`);

  const payload = JSON.parse(payloadLine);
  assert.equal(payload.storage, "postgres");
  assert.equal(typeof payload.batchJobId, "string");
  assert.equal(payload.jobStatus, "validated");
  assert.equal(payload.itemCount, 2);
  assert.equal(payload.itemStatus, "validated");
});
