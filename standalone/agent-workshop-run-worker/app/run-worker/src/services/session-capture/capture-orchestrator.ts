import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { ZstdCodec } from "zstd-codec";
import fg from "fast-glob";
import { create as createTar } from "tar";
import {
  sessionCaptureBoundarySchema,
  type SessionCaptureLease,
  type SessionCaptureObject,
} from "@lingban/contracts";
import { ApiConnector } from "@lingban/container-bridge";
import { nowIso, toErrorMessage } from "@lingban/shared";
import type { ManagedBridgeRuntimeHandle } from "../bridge-runner.js";

export type ProcessSessionCaptureInput = {
  runId: string;
  captureId: string;
  workerId: string;
  targetPath: string;
  runtimePath: string;
  handle: ManagedBridgeRuntimeHandle;
  apiConnector: ApiConnector;
};

type InventoryEntry = {
  path: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string;
};

function sha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}

function captureErrorCode(error: unknown) {
  const message = toErrorMessage(error);
  return /^([A-Z][A-Z0-9_]{2,159})(?::|\b)/.exec(message)?.[1] ?? "RUN_CAPTURE_FAILED";
}

async function zstdCompress(content: Uint8Array, level: number) {
  return await new Promise<Buffer>((resolve, reject) => {
    try {
      ZstdCodec.run((runtime) => {
        try {
          const codec = new runtime.Simple();
          resolve(Buffer.from(codec.compress(content, level)));
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

const MAX_WASM_ZSTD_INPUT_BYTES = 4 * 1024 * 1024;

async function compressFileWithZstd(inputPath: string, outputPath: string, level: number) {
  const zstdBin = process.env.LINGBAN_ZSTD_BIN?.trim() || "zstd";
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputPath, { flags: "wx" });
    const child = spawn(zstdBin, ["--quiet", "--stdout", `-${level}`, inputPath], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    let settled = false;
    let childSucceeded = false;
    let outputClosed = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      output.destroy();
      if (error) reject(error);
      else resolve();
    };
    const finishIfComplete = () => {
      if (childSucceeded && outputClosed) finish();
    };

    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4_000);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      const code = error.code === "ENOENT" ? "RUN_CAPTURE_ZSTD_UNAVAILABLE" : "RUN_CAPTURE_ZSTD_FAILED";
      finish(new Error(`${code}: ${error.message}`));
    });
    output.once("error", (error) => {
      child.kill();
      finish(new Error(`RUN_CAPTURE_ZSTD_FAILED: ${error.message}`));
    });
    output.once("close", () => {
      outputClosed = true;
      finishIfComplete();
    });
    child.stdout.pipe(output);
    child.once("close", (code, signal) => {
      if (code !== 0) {
        finish(new Error(
          `RUN_CAPTURE_ZSTD_FAILED: zstd exited with code ${code ?? "null"}, signal ${signal ?? "null"}` +
          (stderr.trim() ? `: ${stderr.trim()}` : "")
        ));
        return;
      }
      childSucceeded = true;
      finishIfComplete();
    });
  });
}

async function hashFile(absolutePath: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(absolutePath);
    stream.on("data", (chunk) => hash.update(chunk as Buffer));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

function normalizeRelativePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

async function buildInventory(lease: SessionCaptureLease, targetPath: string) {
  const selection = lease.workspaceSelection;
  const entries = await fg(selection.includeGlobs, {
    cwd: targetPath,
    ignore: selection.excludeGlobs,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: false,
    unique: true,
  });
  const paths = entries.map(normalizeRelativePath).sort((left, right) => left.localeCompare(right));
  if (paths.length > selection.maxFiles) {
    throw new Error(`RUN_CAPTURE_SIZE_LIMIT_EXCEEDED: file count ${paths.length} exceeds ${selection.maxFiles}`);
  }

  const inventory: InventoryEntry[] = [];
  let totalBytes = 0;
  const root = path.resolve(targetPath);
  for (const relativePath of paths) {
    const absolutePath = path.resolve(root, relativePath);
    const relativeToRoot = path.relative(root, absolutePath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new Error(`RUN_CAPTURE_PATH_ESCAPE: ${relativePath}`);
    }
    const stat = await fs.lstat(absolutePath);
    if (stat.isSymbolicLink()) throw new Error(`RUN_CAPTURE_PATH_ESCAPE: symbolic link ${relativePath}`);
    if (!stat.isFile()) continue;
    totalBytes += stat.size;
    if (totalBytes > selection.maxBytes) {
      throw new Error(`RUN_CAPTURE_SIZE_LIMIT_EXCEEDED: bytes ${totalBytes} exceeds ${selection.maxBytes}`);
    }
    inventory.push({
      path: relativePath,
      sizeBytes: stat.size,
      sha256: await hashFile(absolutePath),
      modifiedAt: stat.mtime.toISOString(),
    });
  }
  return { inventory, paths: inventory.map((entry) => entry.path), totalBytes };
}

async function buildWorkspaceArchive(targetPath: string, runtimePath: string, captureId: string, files: string[]) {
  await fs.mkdir(runtimePath, { recursive: true });
  const tarPath = path.join(runtimePath, `${captureId}.workspace.tar`);
  const zstdPath = `${tarPath}.zst`;
  try {
    await createTar({
      cwd: targetPath,
      file: tarPath,
      portable: true,
      noMtime: true,
      follow: false,
      prefix: "workspace",
    }, files);
    try {
      await compressFileWithZstd(tarPath, zstdPath, 9);
      return await fs.readFile(zstdPath);
    } catch (error) {
      const tarStat = await fs.stat(tarPath);
      if (!toErrorMessage(error).startsWith("RUN_CAPTURE_ZSTD_UNAVAILABLE") || tarStat.size > MAX_WASM_ZSTD_INPUT_BYTES) {
        throw error;
      }
      return await zstdCompress(await fs.readFile(tarPath), 9);
    }
  } finally {
    await Promise.all([
      fs.rm(tarPath, { force: true }).catch(() => undefined),
      fs.rm(zstdPath, { force: true }).catch(() => undefined),
    ]);
  }
}

function buildObjectDescriptor(
  objectType: SessionCaptureObject["objectType"],
  contentType: string,
  content: Uint8Array
) {
  return { objectType, contentType, sha256: sha256(content), content };
}

async function uploadObject(
  apiConnector: ApiConnector,
  lease: SessionCaptureLease,
  descriptor: ReturnType<typeof buildObjectDescriptor>
) {
  return (await apiConnector.uploadSessionCaptureObject(lease, descriptor, descriptor.content)).object;
}

export async function processSessionCapture(input: ProcessSessionCaptureInput) {
  let lease: SessionCaptureLease | null = null;
  try {
    lease = await input.apiConnector.acquireSessionCaptureLease(
      input.runId,
      input.captureId,
      input.workerId,
      120
    );
    const selectedTarget = lease.workspaceSelection.targetPath.replace(/\\/g, "/").replace(/\/$/, "");
    const resolvedSelectedTarget = path.resolve(lease.workspaceSelection.targetPath)
      .replace(/\\/g, "/")
      .replace(/\/$/, "");
    const workerTarget = path.resolve(input.targetPath).replace(/\\/g, "/").replace(/\/$/, "");
    if (resolvedSelectedTarget !== workerTarget && selectedTarget !== "/workspace/target") {
      throw new Error(`RUN_CAPTURE_PATH_INVALID: target path does not match the active runtime target`);
    }
    await Promise.resolve(input.handle.controller.handle({ type: "syncFiles" }));
    await Promise.resolve(input.handle.controller.handle({ type: "flushArtifacts" }));
    const barrierResult = await Promise.resolve(input.handle.controller.handle({ type: "captureBarrier" }));
    const boundary = sessionCaptureBoundarySchema.parse(
      typeof barrierResult === "object" && barrierResult !== null && "boundary" in barrierResult
        ? barrierResult.boundary
        : null
    );
    await input.apiConnector.submitSessionCaptureBarrier(lease, boundary);
    const evidence = await input.apiConnector.getSessionCaptureEvidence(lease);
    const { inventory, paths, totalBytes } = await buildInventory(lease, input.targetPath);

    const rawEventsContent = gzipSync(Buffer.from(
      evidence.events.map((event) => JSON.stringify(event)).join("\n") + "\n",
      "utf8"
    ));
    const threadContent = gzipSync(Buffer.from(JSON.stringify({
      thread: evidence.thread,
      boundary,
      runId: input.runId,
      capturedAt: nowIso(),
    }, null, 2), "utf8"));
    const inventoryContent = gzipSync(Buffer.from(JSON.stringify({
      schemaVersion: "lingban.workspace-inventory/v1",
      targetPath: lease.workspaceSelection.targetPath,
      totalFiles: inventory.length,
      totalBytes,
      files: inventory,
    }, null, 2), "utf8"));
    const workspaceContent = await buildWorkspaceArchive(input.targetPath, input.runtimePath, input.captureId, paths);

    const uploaded: SessionCaptureObject[] = [];
    uploaded.push(await uploadObject(input.apiConnector, lease, buildObjectDescriptor("raw_events", "application/gzip", rawEventsContent)));
    uploaded.push(await uploadObject(input.apiConnector, lease, buildObjectDescriptor("thread", "application/gzip", threadContent)));
    uploaded.push(await uploadObject(input.apiConnector, lease, buildObjectDescriptor("workspace", "application/zstd", workspaceContent)));
    uploaded.push(await uploadObject(input.apiConnector, lease, buildObjectDescriptor("inventory", "application/gzip", inventoryContent)));

    const manifestContent = Buffer.from(JSON.stringify({
      schemaVersion: "lingban.session-capture/v1",
      captureId: input.captureId,
      runId: input.runId,
      workspaceId: evidence.capture.workspaceId,
      boundary,
      selection: lease.workspaceSelection,
      objects: uploaded,
      counts: {
        events: evidence.events.length,
        messages: evidence.run.messages.length,
        tools: evidence.events.filter((event) => /command|tool|mcp|fileChange/i.test(event.eventType)).length,
        files: inventory.length,
        artifacts: evidence.run.artifacts.length,
      },
      capturedAt: nowIso(),
    }, null, 2), "utf8");
    const manifestObject = await uploadObject(
      input.apiConnector,
      lease,
      buildObjectDescriptor("manifest", "application/json", manifestContent)
    );
    uploaded.push(manifestObject);

    const capturedAt = nowIso();
    return await input.apiConnector.completeSessionCapture(input.runId, input.captureId, {
      workerId: lease.workerId,
      leaseGeneration: lease.leaseGeneration,
      boundary,
      objects: uploaded,
      captureManifestSha256: manifestObject.sha256,
      eventCount: evidence.events.length,
      messageCount: evidence.run.messages.length,
      toolEventCount: evidence.events.filter((event) => /command|tool|mcp|fileChange/i.test(event.eventType)).length,
      fileCount: inventory.length,
      artifactCount: evidence.run.artifacts.length,
      capturedAt,
    });
  } catch (error) {
    if (lease) {
      await input.apiConnector.failSessionCapture(input.runId, input.captureId, {
        workerId: lease.workerId,
        leaseGeneration: lease.leaseGeneration,
        errorCode: captureErrorCode(error),
        reason: toErrorMessage(error),
        retryable: !/PATH_ESCAPE|SIZE_LIMIT|HASH_MISMATCH/.test(toErrorMessage(error)),
        diagnosticId: `capture:${input.captureId}:${Date.now()}`,
      }).catch(() => undefined);
    }
    throw error;
  }
}
