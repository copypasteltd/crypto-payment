import { promises as fs } from "node:fs";
import path from "node:path";
import type { ApiConnector } from "@lingban/container-bridge";
import {
  deserializeSessionPackBundle,
  restoreWorkspaceBaseArchiveFileToDirectory,
  writeSessionPackBundleToDirectory,
} from "@lingban/session-pack";
import type { PreparedRunWorkspace } from "./specs.js";

const SESSION_PACK_ROOT_DIRNAME = "session-pack";
const SESSION_PACK_UNPACKED_DIRNAME = "unpacked";
const SESSION_PACK_ARCHIVE_FILE_NAME = "archive.session-pack.json.gz";
const SESSION_PACK_METADATA_FILE_NAME = "materialization.json";

export function buildRunSessionPackHostPaths(preparedWorkspace: PreparedRunWorkspace) {
  const rootPath = path.join(preparedWorkspace.hostPaths.runtimePath, SESSION_PACK_ROOT_DIRNAME);
  const unpackedPath = path.join(rootPath, SESSION_PACK_UNPACKED_DIRNAME);

  return {
    rootPath,
    unpackedPath,
    archivePath: path.join(rootPath, SESSION_PACK_ARCHIVE_FILE_NAME),
    metadataPath: path.join(rootPath, SESSION_PACK_METADATA_FILE_NAME),
    manifestPath: path.join(unpackedPath, "manifest.json"),
    workspaceBasePath: path.join(unpackedPath, "workspace-base.tar.zst"),
  };
}

export function buildRunSessionPackContainerPaths(preparedWorkspace: PreparedRunWorkspace) {
  const rootPath = path.posix.join(
    preparedWorkspace.containerPaths.runtimePath,
    SESSION_PACK_ROOT_DIRNAME
  );
  const unpackedPath = path.posix.join(rootPath, SESSION_PACK_UNPACKED_DIRNAME);

  return {
    rootPath,
    unpackedPath,
    archivePath: path.posix.join(rootPath, SESSION_PACK_ARCHIVE_FILE_NAME),
    metadataPath: path.posix.join(rootPath, SESSION_PACK_METADATA_FILE_NAME),
    manifestPath: path.posix.join(unpackedPath, "manifest.json"),
    workspaceBasePath: path.posix.join(unpackedPath, "workspace-base.tar.zst"),
  };
}

export async function materializeRunSessionPack(input: {
  runId: string;
  preparedWorkspace: PreparedRunWorkspace;
  apiConnector: Pick<ApiConnector, "downloadRunSessionPackArchive">;
}) {
  const downloaded = await input.apiConnector.downloadRunSessionPackArchive(input.runId);
  const bundle = deserializeSessionPackBundle(downloaded.content);
  const hostPaths = buildRunSessionPackHostPaths(input.preparedWorkspace);
  const containerPaths = buildRunSessionPackContainerPaths(input.preparedWorkspace);

  await fs.mkdir(hostPaths.rootPath, { recursive: true });
  await fs.rm(hostPaths.unpackedPath, { recursive: true, force: true });
  await fs.mkdir(hostPaths.unpackedPath, { recursive: true });
  await fs.writeFile(hostPaths.archivePath, downloaded.content);
  writeSessionPackBundleToDirectory(bundle, hostPaths.unpackedPath, {
    overwrite: true,
  });
  const workspaceBaseRestore = await restoreWorkspaceBaseArchiveFileToDirectory(
    hostPaths.workspaceBasePath,
    input.preparedWorkspace.hostPaths.targetPath
  );

  const metadata = {
    runId: input.runId,
    sessionId: bundle.manifest.session_id,
    sessionVersionId: bundle.manifest.session_version,
    archiveFileName:
      downloaded.fileName?.trim() || `${bundle.manifest.session_version}.session-pack.json.gz`,
    source: downloaded.source ?? "unknown",
    contentType: downloaded.contentType ?? "application/gzip",
    materializedAt: new Date().toISOString(),
    hostPaths,
    containerPaths,
    entries: Object.keys(bundle.files).sort(),
    workspaceBaseRestore,
  };

  await fs.writeFile(hostPaths.metadataPath, JSON.stringify(metadata, null, 2), "utf8");
  return metadata;
}
