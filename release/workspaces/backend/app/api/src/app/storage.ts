import { mkdirSync } from "node:fs";
import path from "node:path";
import { getApiRuntimeConfig } from "./runtime.js";

function ensureDirectory(dirPath: string) {
  mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveApiStorageRoot() {
  const rootPath = path.resolve(getApiRuntimeConfig().storageRoot);

  return ensureDirectory(rootPath);
}

export function resolveApiStorageDir(...segments: string[]) {
  return ensureDirectory(path.join(resolveApiStorageRoot(), ...segments));
}
