export const sessionPackManifestVersion = "lingban.session-pack/v1";
export const sessionPackArchiveFormatVersion = "lingban.session-pack.archive/v1";
export const workspaceBaseArchiveFormatVersion = "lingban.workspace-base/v1";
export const sessionPackManifestFileName = "manifest.json";
export const sessionPackRedactionMapFileName = "redaction-map.json";
export const sessionPackInformationCollectionReviewFileName = "information-collection-review.json";
export const sessionPackRuntimeEvidenceFileName = "runtime-evidence.json";
export const sessionPackWorkspaceBaseFileName = "workspace-base.tar.zst";
export const sessionPackRequiredRootFiles = [
    "conversation.jsonl",
    sessionPackWorkspaceBaseFileName,
    "slot-schema.json",
    "mcp-requirements.json",
];
export const sessionPackRuntimeAlternativeFiles = [
    "runtime-config.json",
    "runtime-profile.json",
];
export const sessionPackOptionalRootFiles = [
    "tool-events.jsonl",
    "validator-set.json",
    sessionPackRedactionMapFileName,
    sessionPackInformationCollectionReviewFileName,
    sessionPackRuntimeEvidenceFileName,
];
export const sessionPackKnownRootFiles = [
    sessionPackManifestFileName,
    ...sessionPackRequiredRootFiles,
    ...sessionPackRuntimeAlternativeFiles,
    ...sessionPackOptionalRootFiles,
];
//# sourceMappingURL=constants.js.map