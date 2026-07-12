import assert from "node:assert/strict";
import test from "node:test";

test("shared helpers expose stable ISO timestamps", async () => {
  const { nowIso } = await import("../dist/index.js");
  const value = nowIso(new Date("2026-07-12T10:20:30.456Z"));
  assert.equal(value, "2026-07-12T10:20:30.456Z");
});

test("shared helpers normalize unknown errors and support AbortError overrides", async () => {
  const { toErrorMessage } = await import("../dist/index.js");

  assert.equal(toErrorMessage(new Error("boom")), "boom");
  assert.equal(toErrorMessage("plain failure"), "plain failure");

  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  assert.equal(
    toErrorMessage(abortError, {
      abortMessage: "request timed out",
    }),
    "request timed out"
  );
});

test("shared helpers build atomic temp paths under the requested file", async () => {
  const { buildAtomicTempPath } = await import("../dist/index.js");

  assert.equal(
    buildAtomicTempPath("C:/data/state.json", "abc123"),
    "C:/data/state.json.abc123.tmp"
  );
});
