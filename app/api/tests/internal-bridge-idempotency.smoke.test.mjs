import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

test("internal bridge callbacks are idempotent under repeated delivery", async () => {
  const scriptPath = path.resolve("tests/internal-bridge-idempotency.scenario.mjs");

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
    `internal callback idempotency smoke failed (exit=${result.code}, signal=${result.signal ?? "null"})\n${result.stderr || result.stdout}`
  );
});
