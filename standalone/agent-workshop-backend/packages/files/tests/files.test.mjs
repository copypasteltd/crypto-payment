import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

test("file helpers normalize paths and logical prefixes", async () => {
  const {
    toPosixPath,
    ensureTrailingSlash,
    normalizeAbsoluteFilePath,
    createLogicalPath,
    normalizeLogicalPrefix,
  } = await import("../dist/index.js");

  assert.equal(toPosixPath("a\\b\\c"), "a/b/c");
  assert.equal(ensureTrailingSlash("/workspace/target"), "/workspace/target/");
  assert.match(normalizeAbsoluteFilePath("packages/files"), /packages\/files$/);
  assert.equal(
    createLogicalPath("/workspace/target", "/workspace/target/output/report.txt"),
    "/output/report.txt"
  );
  assert.equal(normalizeLogicalPrefix("output/reports"), "/output/reports");
  assert.equal(normalizeLogicalPrefix("/"), "/");
  assert.equal(normalizeLogicalPrefix("   "), null);
});

test("resolvePathWithinRoot blocks boundary escape", async () => {
  const { resolvePathWithinRoot } = await import("../dist/index.js");

  const root = path.resolve("/workspace/target");
  assert.equal(
    resolvePathWithinRoot(root, "output/report.txt"),
    path.resolve(root, "output/report.txt")
  );
  assert.equal(
    resolvePathWithinRoot(root, "/workspace/target/archive/log.txt"),
    path.resolve(root, "archive/log.txt")
  );
  assert.equal(resolvePathWithinRoot(root, "../outside.txt"), null);
});

test("mime type guessing and preview inference stay aligned", async () => {
  const { guessFileMimeType, inferFilePreviewMode, isOfficePreviewMimeType } = await import(
    "../dist/index.js"
  );

  assert.equal(guessFileMimeType("report.json"), "application/json; charset=utf-8");
  assert.equal(
    guessFileMimeType("slides.pptx"),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
  assert.equal(inferFilePreviewMode("report.json", null), "text");
  assert.equal(inferFilePreviewMode("preview.png", null), "image");
  assert.equal(guessFileMimeType("episode.mp4"), "video/mp4");
  assert.equal(guessFileMimeType("episode.webm"), "video/webm");
  assert.equal(inferFilePreviewMode("episode.mp4", null), "video");
  assert.equal(inferFilePreviewMode("receipt.pdf", null), "pdf");
  assert.equal(inferFilePreviewMode("bundle.zip", null), "download");
  assert.equal(
    isOfficePreviewMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    true
  );
});
