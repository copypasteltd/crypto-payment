import { z } from "zod";
import { sessionPackArchiveFormatVersion, sessionPackManifestVersion, } from "./constants.js";
const isoDateTimeSchema = z
    .string()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO-8601 datetime string");
const sha256HexSchema = z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest");
export const sessionPackRuntimeProfileSchema = z
    .object({
    profile_id: z.string().min(1),
    runner_image: z.string().min(1).optional(),
    node_version: z.string().min(1).optional(),
    python_version: z.string().min(1).optional(),
    browser_required: z.boolean().optional(),
    playwright_required: z.boolean().optional(),
})
    .strict();
export const sessionPackRuntimeConfigSchema = z
    .object({
    profile_id: z.string().min(1),
    entrypoint: z.string().min(1).optional(),
    command: z.array(z.string().min(1)).default([]),
    args: z.array(z.string().min(1)).default([]),
    env: z.record(z.string().min(1), z.string()).default({}),
    working_directory: z.string().min(1).optional(),
    bootstrap_timeout_seconds: z.number().int().positive().optional(),
})
    .strict();
export const sessionPackMcpCapabilitySchema = z
    .object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    protocol: z.string().min(1).optional(),
    risk_level: z.enum(["low", "medium", "high", "critical"]).optional(),
    required: z.boolean().optional(),
})
    .strict();
export const sessionPackCredentialCapabilitySchema = z
    .object({
    id: z.string().min(1),
    placement: z.enum(["env", "file", "browser-state"]).optional(),
    required: z.boolean().optional(),
})
    .strict();
export const sessionPackRequiredCapabilitiesSchema = z
    .object({
    browser: z.boolean().optional(),
    filesystem: z.boolean().optional(),
    downloads: z.boolean().optional(),
    apis: z.array(z.string().min(1)).optional(),
    mcps: z.array(sessionPackMcpCapabilitySchema).optional(),
    credentials: z.array(sessionPackCredentialCapabilitySchema).optional(),
})
    .strict();
export const sessionPackArtifactOutputSchema = z
    .object({
    name: z.string().min(1),
    kind: z.enum(["file", "directory", "report", "receipt", "archive", "image", "document"]),
    required: z.boolean().optional(),
    path_pattern: z.string().min(1).optional(),
})
    .strict();
export const sessionPackArtifactContractSchema = z
    .object({
    outputs: z.array(sessionPackArtifactOutputSchema).default([]),
})
    .strict();
export const sessionPackCreatorSchema = z
    .object({
    user_id: z.string().min(1),
    display_name: z.string().min(1).optional(),
})
    .strict();
export const sessionPackSourceSchema = z
    .object({
    workspace_id: z.string().min(1).optional(),
    creator_package_id: z.string().min(1).optional(),
    creator_release_id: z.string().min(1).optional(),
    lineage_parent_version_id: z.string().min(1).optional(),
    rollback_from_version_id: z.string().min(1).optional(),
})
    .strict();
export const sessionPackSlotFieldTypeSchema = z.enum([
    "string",
    "number",
    "boolean",
    "date",
    "datetime",
    "enum",
    "file",
    "directory",
    "json",
]);
export const sessionPackSlotChoiceSchema = z
    .object({
    value: z.string().min(1),
    label: z.string().min(1).optional(),
})
    .strict();
export const sessionPackSlotDefinitionSchema = z
    .object({
    key: z.string().min(1),
    title: z.string().min(1),
    type: sessionPackSlotFieldTypeSchema,
    required: z.boolean().default(false),
    secret: z.boolean().default(false),
    repeatable: z.boolean().default(false),
    prompt: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    placeholder: z.string().min(1).optional(),
    default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    choices: z.array(sessionPackSlotChoiceSchema).default([]),
    accepts: z.array(z.string().min(1)).default([]),
    pattern: z.string().min(1).optional(),
    min_length: z.number().int().nonnegative().optional(),
    max_length: z.number().int().positive().optional(),
})
    .strict();
export const sessionPackSlotSchemaFileSchema = z
    .object({
    version: z.string().min(1),
    slots: z.array(sessionPackSlotDefinitionSchema).min(1),
})
    .strict();
export const sessionPackMcpRequirementsFileSchema = z
    .object({
    connectors: z.array(sessionPackMcpCapabilitySchema).default([]),
    credentials: z.array(sessionPackCredentialCapabilitySchema).default([]),
})
    .strict();
export const sessionPackRedactionTargetSchema = z
    .object({
    kind: z.enum(["text", "file-path", "json-path", "header", "cookie"]),
    selector: z.string().min(1),
})
    .strict();
export const sessionPackRedactionRuleSchema = z
    .object({
    rule_id: z.string().min(1),
    slot_key: z.string().min(1).optional(),
    target: sessionPackRedactionTargetSchema,
    strategy: z.enum(["mask", "remove", "replace", "hash"]),
    replacement: z.string().min(1).optional(),
    rationale: z.string().min(1).optional(),
})
    .strict()
    .superRefine((value, context) => {
    if (value.strategy === "replace" && !value.replacement) {
        context.addIssue({
            code: "custom",
            path: ["replacement"],
            message: "replacement is required when strategy is replace",
        });
    }
});
export const sessionPackRedactionMapSchema = z
    .object({
    version: z.string().min(1),
    secret_slot_keys: z.array(z.string().min(1)).default([]),
    rules: z.array(sessionPackRedactionRuleSchema).default([]),
})
    .strict();
export const sessionPackInformationCollectionReviewSlotSchema = z
    .object({
    key: z.string().min(1),
    title: z.string().min(1),
    type: sessionPackSlotFieldTypeSchema,
    required: z.boolean().default(false),
    secret: z.boolean().default(false),
    status: z.enum(["missing", "optional", "satisfied"]),
    answer_count: z.number().int().nonnegative().default(0),
    pending_review_count: z.number().int().nonnegative().default(0),
    approved_review_count: z.number().int().nonnegative().default(0),
    rejected_review_count: z.number().int().nonnegative().default(0),
    superseded_review_count: z.number().int().nonnegative().default(0),
    last_answered_at: isoDateTimeSchema.nullable().default(null),
    last_reviewed_at: isoDateTimeSchema.nullable().default(null),
})
    .strict();
export const sessionPackInformationCollectionReviewAnswerKindSchema = z.enum([
    "text",
    "attachment",
]);
export const sessionPackInformationCollectionReviewAnswerSourceSchema = z.enum([
    "user-message",
    "manual-review",
]);
export const sessionPackInformationCollectionReviewAnswerReviewStatusSchema = z.enum([
    "pending",
    "approved",
    "rejected",
    "superseded",
]);
export const sessionPackInformationCollectionReviewAnswerTraceSchema = z
    .object({
    answer_id: z.string().min(1),
    kind: sessionPackInformationCollectionReviewAnswerKindSchema,
    source: sessionPackInformationCollectionReviewAnswerSourceSchema,
    source_message_id: z.string().min(1),
    review_status: sessionPackInformationCollectionReviewAnswerReviewStatusSchema,
    reviewed_at: isoDateTimeSchema.nullable().default(null),
    reviewed_by_user_id: z.string().min(1).nullable().default(null),
    supersedes_answer_id: z.string().min(1).nullable().default(null),
    superseded_by_answer_id: z.string().min(1).nullable().default(null),
    created_at: isoDateTimeSchema,
})
    .strict();
export const sessionPackInformationCollectionReviewSlotSummarySchema = z
    .object({
    key: z.string().min(1),
    title: z.string().min(1),
    type: sessionPackSlotFieldTypeSchema,
    required: z.boolean().default(false),
    secret: z.boolean().default(false),
    status: z.enum(["missing", "optional", "satisfied"]),
    answer_count: z.number().int().nonnegative().default(0),
    tracked_answer_count: z.number().int().nonnegative().default(0),
    user_message_answer_count: z.number().int().nonnegative().default(0),
    manual_review_answer_count: z.number().int().nonnegative().default(0),
    revision_count: z.number().int().nonnegative().default(0),
    pending_review_count: z.number().int().nonnegative().default(0),
    approved_review_count: z.number().int().nonnegative().default(0),
    rejected_review_count: z.number().int().nonnegative().default(0),
    superseded_review_count: z.number().int().nonnegative().default(0),
    last_answered_at: isoDateTimeSchema.nullable().default(null),
    last_reviewed_at: isoDateTimeSchema.nullable().default(null),
    latest_answer_id: z.string().min(1).nullable().default(null),
    latest_source: sessionPackInformationCollectionReviewAnswerSourceSchema.nullable().default(null),
    latest_source_message_id: z.string().min(1).nullable().default(null),
    effective_answer_id: z.string().min(1).nullable().default(null),
    effective_source: sessionPackInformationCollectionReviewAnswerSourceSchema.nullable().default(null),
    effective_source_message_id: z.string().min(1).nullable().default(null),
    answers: z.array(sessionPackInformationCollectionReviewAnswerTraceSchema).default([]),
})
    .strict();
export const sessionPackInformationCollectionReviewFileSchema = z
    .object({
    version: z.string().min(1),
    slot_schema_version: z.string().min(1).nullable().default(null),
    total_slots: z.number().int().nonnegative().default(0),
    required_slots: z.number().int().nonnegative().default(0),
    satisfied_slots: z.number().int().nonnegative().default(0),
    total_answers: z.number().int().nonnegative().default(0),
    user_message_answer_count: z.number().int().nonnegative().default(0),
    manual_review_answer_count: z.number().int().nonnegative().default(0),
    revision_count: z.number().int().nonnegative().default(0),
    pending_review_count: z.number().int().nonnegative().default(0),
    approved_review_count: z.number().int().nonnegative().default(0),
    rejected_review_count: z.number().int().nonnegative().default(0),
    superseded_review_count: z.number().int().nonnegative().default(0),
    latest_answered_at: isoDateTimeSchema.nullable().default(null),
    latest_reviewed_at: isoDateTimeSchema.nullable().default(null),
    slots: z.array(sessionPackInformationCollectionReviewSlotSummarySchema).default([]),
})
    .strict();
export const sessionPackFileIntegritySchema = z
    .object({
    sha256: sha256HexSchema,
    size: z.number().int().nonnegative(),
    required: z.boolean().optional(),
})
    .strict();
export const sessionPackSignatureSchema = z
    .object({
    algorithm: z.enum(["sha256", "hmac-sha256", "ed25519"]),
    value: z.string().min(1),
    key_id: z.string().min(1).optional(),
})
    .strict();
export const sessionPackManifestSchema = z
    .object({
    manifest_version: z.literal(sessionPackManifestVersion),
    session_id: z.string().min(1),
    session_version: z.string().min(1),
    task_family: z.string().min(1),
    runtime_profile: sessionPackRuntimeProfileSchema,
    slot_schema_version: z.string().min(1),
    required_capabilities: sessionPackRequiredCapabilitiesSchema,
    artifact_contract: sessionPackArtifactContractSchema,
    created_by: sessionPackCreatorSchema,
    created_at: isoDateTimeSchema,
    source: sessionPackSourceSchema.optional(),
    files: z.record(z.string().min(1), sessionPackFileIntegritySchema).default({}),
    signature: sessionPackSignatureSchema.optional(),
    metadata: z.record(z.string().min(1), z.union([z.string(), z.number(), z.boolean()])).optional(),
})
    .strict();
export const sessionPackArchiveEnvelopeSchema = z
    .object({
    format_version: z.literal(sessionPackArchiveFormatVersion),
    manifest: sessionPackManifestSchema,
    files: z.record(z.string().min(1), z.string().min(1)).default({}),
})
    .strict();
//# sourceMappingURL=schema.js.map