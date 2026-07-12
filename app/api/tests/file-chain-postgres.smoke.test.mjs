import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

test("file chain smoke: postgres-backed repositories and event bus", async () => {
  const scriptPath = path.resolve("tests/file-chain-postgres.scenario.mjs");

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
    `postgres smoke script failed (exit=${result.code}, signal=${result.signal ?? "null"})\n${result.stderr || result.stdout}`
  );

  const payloadLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .find((line) => line.startsWith("{") && line.endsWith("}"));

  assert.ok(payloadLine, `postgres smoke script did not emit JSON payload\n${result.stdout}`);

  const payload = JSON.parse(payloadLine);
  assert.equal(payload.storage, "postgres");
  assert.equal(payload.indexedUploadCount, 1);
  assert.equal(payload.indexedRuntimeCount, 1);
  assert.equal(payload.indexedRuntimeBinaryCount, 2);
  assert.equal(payload.indexedSnapshotFileCount >= 1, true);
  assert.equal(payload.previewMode, "text");
  assert.equal(payload.officePreviewMode, "text");
  assert.equal(payload.imagePreviewMode, "image");
  assert.equal(payload.pdfPreviewMode, "pdf");
  assert.equal(payload.ticketSourceKind, "object-store");
  assert.equal(payload.uploadedTicketSourceKind, "uploaded-object");
});
