export const sessionPackManifestVersion = "lingban.session-pack/v1";
export const sessionPackArchiveFormatVersion = "lingban.session-pack.archive/v1";
export const workspaceBaseArchiveFormatVersion = "lingban.workspace-base/v1";

export const sessionPackManifestFileName = "manifest.json";
export const sessionPackRedactionMapFileName = "redaction-map.json";
export const sessionPackInformationCollectionReviewFileName =
  "information-collection-review.json";
export const sessionPackRuntimeEvidenceFileName = "runtime-evidence.json";
export const sessionPackWorkspaceBaseFileName = "workspace-base.tar.zst";

export const sessionPackRequiredRootFiles = [
  "conversation.jsonl",
  sessionPackWorkspaceBaseFileName,
  "slot-schema.json",
  "mcp-requirements.json",
] as const;

export const sessionPackRuntimeAlternativeFiles = [
  "runtime-config.json",
  "runtime-profile.json",
] as const;

export const sessionPackOptionalRootFiles = [
  "tool-events.jsonl",
  "validator-set.json",
  sessionPackRedactionMapFileName,
  sessionPackInformationCollectionReviewFileName,
  sessionPackRuntimeEvidenceFileName,
] as const;

export const sessionPackKnownRootFiles = [
  sessionPackManifestFileName,
  ...sessionPackRequiredRootFiles,
  ...sessionPackRuntimeAlternativeFiles,
  ...sessionPackOptionalRootFiles,
] as const;

export type SessionPackKnownRootFile = (typeof sessionPackKnownRootFiles)[number];
