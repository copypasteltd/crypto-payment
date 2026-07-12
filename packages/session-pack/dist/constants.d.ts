export declare const sessionPackManifestVersion = "lingban.session-pack/v1";
export declare const sessionPackArchiveFormatVersion = "lingban.session-pack.archive/v1";
export declare const workspaceBaseArchiveFormatVersion = "lingban.workspace-base/v1";
export declare const sessionPackManifestFileName = "manifest.json";
export declare const sessionPackRedactionMapFileName = "redaction-map.json";
export declare const sessionPackInformationCollectionReviewFileName = "information-collection-review.json";
export declare const sessionPackRuntimeEvidenceFileName = "runtime-evidence.json";
export declare const sessionPackWorkspaceBaseFileName = "workspace-base.tar.zst";
export declare const sessionPackRequiredRootFiles: readonly ["conversation.jsonl", "workspace-base.tar.zst", "slot-schema.json", "mcp-requirements.json"];
export declare const sessionPackRuntimeAlternativeFiles: readonly ["runtime-config.json", "runtime-profile.json"];
export declare const sessionPackOptionalRootFiles: readonly ["tool-events.jsonl", "validator-set.json", "redaction-map.json", "information-collection-review.json", "runtime-evidence.json"];
export declare const sessionPackKnownRootFiles: readonly ["manifest.json", "conversation.jsonl", "workspace-base.tar.zst", "slot-schema.json", "mcp-requirements.json", "runtime-config.json", "runtime-profile.json", "tool-events.jsonl", "validator-set.json", "redaction-map.json", "information-collection-review.json", "runtime-evidence.json"];
export type SessionPackKnownRootFile = (typeof sessionPackKnownRootFiles)[number];
//# sourceMappingURL=constants.d.ts.map