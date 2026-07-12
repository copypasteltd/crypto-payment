import { z } from "zod";
export declare const sessionPackRuntimeProfileSchema: z.ZodObject<{
    profile_id: z.ZodString;
    runner_image: z.ZodOptional<z.ZodString>;
    node_version: z.ZodOptional<z.ZodString>;
    python_version: z.ZodOptional<z.ZodString>;
    browser_required: z.ZodOptional<z.ZodBoolean>;
    playwright_required: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const sessionPackRuntimeConfigSchema: z.ZodObject<{
    profile_id: z.ZodString;
    entrypoint: z.ZodOptional<z.ZodString>;
    command: z.ZodDefault<z.ZodArray<z.ZodString>>;
    args: z.ZodDefault<z.ZodArray<z.ZodString>>;
    env: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    working_directory: z.ZodOptional<z.ZodString>;
    bootstrap_timeout_seconds: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const sessionPackMcpCapabilitySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    protocol: z.ZodOptional<z.ZodString>;
    risk_level: z.ZodOptional<z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
        critical: "critical";
    }>>;
    required: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const sessionPackCredentialCapabilitySchema: z.ZodObject<{
    id: z.ZodString;
    placement: z.ZodOptional<z.ZodEnum<{
        file: "file";
        env: "env";
        "browser-state": "browser-state";
    }>>;
    required: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const sessionPackRequiredCapabilitiesSchema: z.ZodObject<{
    browser: z.ZodOptional<z.ZodBoolean>;
    filesystem: z.ZodOptional<z.ZodBoolean>;
    downloads: z.ZodOptional<z.ZodBoolean>;
    apis: z.ZodOptional<z.ZodArray<z.ZodString>>;
    mcps: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        protocol: z.ZodOptional<z.ZodString>;
        risk_level: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
    credentials: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        placement: z.ZodOptional<z.ZodEnum<{
            file: "file";
            env: "env";
            "browser-state": "browser-state";
        }>>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const sessionPackArtifactOutputSchema: z.ZodObject<{
    name: z.ZodString;
    kind: z.ZodEnum<{
        file: "file";
        directory: "directory";
        report: "report";
        receipt: "receipt";
        archive: "archive";
        image: "image";
        document: "document";
    }>;
    required: z.ZodOptional<z.ZodBoolean>;
    path_pattern: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const sessionPackArtifactContractSchema: z.ZodObject<{
    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        kind: z.ZodEnum<{
            file: "file";
            directory: "directory";
            report: "report";
            receipt: "receipt";
            archive: "archive";
            image: "image";
            document: "document";
        }>;
        required: z.ZodOptional<z.ZodBoolean>;
        path_pattern: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const sessionPackCreatorSchema: z.ZodObject<{
    user_id: z.ZodString;
    display_name: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const sessionPackSourceSchema: z.ZodObject<{
    workspace_id: z.ZodOptional<z.ZodString>;
    creator_package_id: z.ZodOptional<z.ZodString>;
    creator_release_id: z.ZodOptional<z.ZodString>;
    lineage_parent_version_id: z.ZodOptional<z.ZodString>;
    rollback_from_version_id: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const sessionPackSlotFieldTypeSchema: z.ZodEnum<{
    string: "string";
    number: "number";
    boolean: "boolean";
    date: "date";
    file: "file";
    enum: "enum";
    directory: "directory";
    datetime: "datetime";
    json: "json";
}>;
export declare const sessionPackSlotChoiceSchema: z.ZodObject<{
    value: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const sessionPackSlotDefinitionSchema: z.ZodObject<{
    key: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<{
        string: "string";
        number: "number";
        boolean: "boolean";
        date: "date";
        file: "file";
        enum: "enum";
        directory: "directory";
        datetime: "datetime";
        json: "json";
    }>;
    required: z.ZodDefault<z.ZodBoolean>;
    secret: z.ZodDefault<z.ZodBoolean>;
    repeatable: z.ZodDefault<z.ZodBoolean>;
    prompt: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    placeholder: z.ZodOptional<z.ZodString>;
    default_value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
    choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
    accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
    pattern: z.ZodOptional<z.ZodString>;
    min_length: z.ZodOptional<z.ZodNumber>;
    max_length: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export declare const sessionPackSlotSchemaFileSchema: z.ZodObject<{
    version: z.ZodString;
    slots: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            date: "date";
            file: "file";
            enum: "enum";
            directory: "directory";
            datetime: "datetime";
            json: "json";
        }>;
        required: z.ZodDefault<z.ZodBoolean>;
        secret: z.ZodDefault<z.ZodBoolean>;
        repeatable: z.ZodDefault<z.ZodBoolean>;
        prompt: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        placeholder: z.ZodOptional<z.ZodString>;
        default_value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>>;
        choices: z.ZodDefault<z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            label: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
        accepts: z.ZodDefault<z.ZodArray<z.ZodString>>;
        pattern: z.ZodOptional<z.ZodString>;
        min_length: z.ZodOptional<z.ZodNumber>;
        max_length: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const sessionPackMcpRequirementsFileSchema: z.ZodObject<{
    connectors: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        protocol: z.ZodOptional<z.ZodString>;
        risk_level: z.ZodOptional<z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
            critical: "critical";
        }>>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
    credentials: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        placement: z.ZodOptional<z.ZodEnum<{
            file: "file";
            env: "env";
            "browser-state": "browser-state";
        }>>;
        required: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const sessionPackRedactionTargetSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        text: "text";
        "file-path": "file-path";
        "json-path": "json-path";
        header: "header";
        cookie: "cookie";
    }>;
    selector: z.ZodString;
}, z.core.$strict>;
export declare const sessionPackRedactionRuleSchema: z.ZodObject<{
    rule_id: z.ZodString;
    slot_key: z.ZodOptional<z.ZodString>;
    target: z.ZodObject<{
        kind: z.ZodEnum<{
            text: "text";
            "file-path": "file-path";
            "json-path": "json-path";
            header: "header";
            cookie: "cookie";
        }>;
        selector: z.ZodString;
    }, z.core.$strict>;
    strategy: z.ZodEnum<{
        mask: "mask";
        remove: "remove";
        replace: "replace";
        hash: "hash";
    }>;
    replacement: z.ZodOptional<z.ZodString>;
    rationale: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const sessionPackRedactionMapSchema: z.ZodObject<{
    version: z.ZodString;
    secret_slot_keys: z.ZodDefault<z.ZodArray<z.ZodString>>;
    rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        rule_id: z.ZodString;
        slot_key: z.ZodOptional<z.ZodString>;
        target: z.ZodObject<{
            kind: z.ZodEnum<{
                text: "text";
                "file-path": "file-path";
                "json-path": "json-path";
                header: "header";
                cookie: "cookie";
            }>;
            selector: z.ZodString;
        }, z.core.$strict>;
        strategy: z.ZodEnum<{
            mask: "mask";
            remove: "remove";
            replace: "replace";
            hash: "hash";
        }>;
        replacement: z.ZodOptional<z.ZodString>;
        rationale: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const sessionPackInformationCollectionReviewSlotSchema: z.ZodObject<{
    key: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<{
        string: "string";
        number: "number";
        boolean: "boolean";
        date: "date";
        file: "file";
        enum: "enum";
        directory: "directory";
        datetime: "datetime";
        json: "json";
    }>;
    required: z.ZodDefault<z.ZodBoolean>;
    secret: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodEnum<{
        optional: "optional";
        missing: "missing";
        satisfied: "satisfied";
    }>;
    answer_count: z.ZodDefault<z.ZodNumber>;
    pending_review_count: z.ZodDefault<z.ZodNumber>;
    approved_review_count: z.ZodDefault<z.ZodNumber>;
    rejected_review_count: z.ZodDefault<z.ZodNumber>;
    superseded_review_count: z.ZodDefault<z.ZodNumber>;
    last_answered_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    last_reviewed_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const sessionPackInformationCollectionReviewAnswerKindSchema: z.ZodEnum<{
    text: "text";
    attachment: "attachment";
}>;
export declare const sessionPackInformationCollectionReviewAnswerSourceSchema: z.ZodEnum<{
    "user-message": "user-message";
    "manual-review": "manual-review";
}>;
export declare const sessionPackInformationCollectionReviewAnswerReviewStatusSchema: z.ZodEnum<{
    pending: "pending";
    approved: "approved";
    rejected: "rejected";
    superseded: "superseded";
}>;
export declare const sessionPackInformationCollectionReviewAnswerTraceSchema: z.ZodObject<{
    answer_id: z.ZodString;
    kind: z.ZodEnum<{
        text: "text";
        attachment: "attachment";
    }>;
    source: z.ZodEnum<{
        "user-message": "user-message";
        "manual-review": "manual-review";
    }>;
    source_message_id: z.ZodString;
    review_status: z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
        superseded: "superseded";
    }>;
    reviewed_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reviewed_by_user_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    supersedes_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    superseded_by_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    created_at: z.ZodString;
}, z.core.$strict>;
export declare const sessionPackInformationCollectionReviewSlotSummarySchema: z.ZodObject<{
    key: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<{
        string: "string";
        number: "number";
        boolean: "boolean";
        date: "date";
        file: "file";
        enum: "enum";
        directory: "directory";
        datetime: "datetime";
        json: "json";
    }>;
    required: z.ZodDefault<z.ZodBoolean>;
    secret: z.ZodDefault<z.ZodBoolean>;
    status: z.ZodEnum<{
        optional: "optional";
        missing: "missing";
        satisfied: "satisfied";
    }>;
    answer_count: z.ZodDefault<z.ZodNumber>;
    tracked_answer_count: z.ZodDefault<z.ZodNumber>;
    user_message_answer_count: z.ZodDefault<z.ZodNumber>;
    manual_review_answer_count: z.ZodDefault<z.ZodNumber>;
    revision_count: z.ZodDefault<z.ZodNumber>;
    pending_review_count: z.ZodDefault<z.ZodNumber>;
    approved_review_count: z.ZodDefault<z.ZodNumber>;
    rejected_review_count: z.ZodDefault<z.ZodNumber>;
    superseded_review_count: z.ZodDefault<z.ZodNumber>;
    last_answered_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    last_reviewed_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    latest_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    latest_source: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "user-message": "user-message";
        "manual-review": "manual-review";
    }>>>;
    latest_source_message_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    effective_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    effective_source: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
        "user-message": "user-message";
        "manual-review": "manual-review";
    }>>>;
    effective_source_message_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        answer_id: z.ZodString;
        kind: z.ZodEnum<{
            text: "text";
            attachment: "attachment";
        }>;
        source: z.ZodEnum<{
            "user-message": "user-message";
            "manual-review": "manual-review";
        }>;
        source_message_id: z.ZodString;
        review_status: z.ZodEnum<{
            pending: "pending";
            approved: "approved";
            rejected: "rejected";
            superseded: "superseded";
        }>;
        reviewed_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        reviewed_by_user_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        supersedes_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        superseded_by_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        created_at: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const sessionPackInformationCollectionReviewFileSchema: z.ZodObject<{
    version: z.ZodString;
    slot_schema_version: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    total_slots: z.ZodDefault<z.ZodNumber>;
    required_slots: z.ZodDefault<z.ZodNumber>;
    satisfied_slots: z.ZodDefault<z.ZodNumber>;
    total_answers: z.ZodDefault<z.ZodNumber>;
    user_message_answer_count: z.ZodDefault<z.ZodNumber>;
    manual_review_answer_count: z.ZodDefault<z.ZodNumber>;
    revision_count: z.ZodDefault<z.ZodNumber>;
    pending_review_count: z.ZodDefault<z.ZodNumber>;
    approved_review_count: z.ZodDefault<z.ZodNumber>;
    rejected_review_count: z.ZodDefault<z.ZodNumber>;
    superseded_review_count: z.ZodDefault<z.ZodNumber>;
    latest_answered_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    latest_reviewed_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    slots: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<{
            string: "string";
            number: "number";
            boolean: "boolean";
            date: "date";
            file: "file";
            enum: "enum";
            directory: "directory";
            datetime: "datetime";
            json: "json";
        }>;
        required: z.ZodDefault<z.ZodBoolean>;
        secret: z.ZodDefault<z.ZodBoolean>;
        status: z.ZodEnum<{
            optional: "optional";
            missing: "missing";
            satisfied: "satisfied";
        }>;
        answer_count: z.ZodDefault<z.ZodNumber>;
        tracked_answer_count: z.ZodDefault<z.ZodNumber>;
        user_message_answer_count: z.ZodDefault<z.ZodNumber>;
        manual_review_answer_count: z.ZodDefault<z.ZodNumber>;
        revision_count: z.ZodDefault<z.ZodNumber>;
        pending_review_count: z.ZodDefault<z.ZodNumber>;
        approved_review_count: z.ZodDefault<z.ZodNumber>;
        rejected_review_count: z.ZodDefault<z.ZodNumber>;
        superseded_review_count: z.ZodDefault<z.ZodNumber>;
        last_answered_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        last_reviewed_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        latest_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        latest_source: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "user-message": "user-message";
            "manual-review": "manual-review";
        }>>>;
        latest_source_message_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        effective_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        effective_source: z.ZodDefault<z.ZodNullable<z.ZodEnum<{
            "user-message": "user-message";
            "manual-review": "manual-review";
        }>>>;
        effective_source_message_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        answers: z.ZodDefault<z.ZodArray<z.ZodObject<{
            answer_id: z.ZodString;
            kind: z.ZodEnum<{
                text: "text";
                attachment: "attachment";
            }>;
            source: z.ZodEnum<{
                "user-message": "user-message";
                "manual-review": "manual-review";
            }>;
            source_message_id: z.ZodString;
            review_status: z.ZodEnum<{
                pending: "pending";
                approved: "approved";
                rejected: "rejected";
                superseded: "superseded";
            }>;
            reviewed_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            reviewed_by_user_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            supersedes_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            superseded_by_answer_id: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            created_at: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export declare const sessionPackFileIntegritySchema: z.ZodObject<{
    sha256: z.ZodString;
    size: z.ZodNumber;
    required: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
export declare const sessionPackSignatureSchema: z.ZodObject<{
    algorithm: z.ZodEnum<{
        sha256: "sha256";
        "hmac-sha256": "hmac-sha256";
        ed25519: "ed25519";
    }>;
    value: z.ZodString;
    key_id: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const sessionPackManifestSchema: z.ZodObject<{
    manifest_version: z.ZodLiteral<"lingban.session-pack/v1">;
    session_id: z.ZodString;
    session_version: z.ZodString;
    task_family: z.ZodString;
    runtime_profile: z.ZodObject<{
        profile_id: z.ZodString;
        runner_image: z.ZodOptional<z.ZodString>;
        node_version: z.ZodOptional<z.ZodString>;
        python_version: z.ZodOptional<z.ZodString>;
        browser_required: z.ZodOptional<z.ZodBoolean>;
        playwright_required: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>;
    slot_schema_version: z.ZodString;
    required_capabilities: z.ZodObject<{
        browser: z.ZodOptional<z.ZodBoolean>;
        filesystem: z.ZodOptional<z.ZodBoolean>;
        downloads: z.ZodOptional<z.ZodBoolean>;
        apis: z.ZodOptional<z.ZodArray<z.ZodString>>;
        mcps: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodOptional<z.ZodString>;
            protocol: z.ZodOptional<z.ZodString>;
            risk_level: z.ZodOptional<z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
                critical: "critical";
            }>>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
        credentials: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            placement: z.ZodOptional<z.ZodEnum<{
                file: "file";
                env: "env";
                "browser-state": "browser-state";
            }>>;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
    }, z.core.$strict>;
    artifact_contract: z.ZodObject<{
        outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            kind: z.ZodEnum<{
                file: "file";
                directory: "directory";
                report: "report";
                receipt: "receipt";
                archive: "archive";
                image: "image";
                document: "document";
            }>;
            required: z.ZodOptional<z.ZodBoolean>;
            path_pattern: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
    }, z.core.$strict>;
    created_by: z.ZodObject<{
        user_id: z.ZodString;
        display_name: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    created_at: z.ZodString;
    source: z.ZodOptional<z.ZodObject<{
        workspace_id: z.ZodOptional<z.ZodString>;
        creator_package_id: z.ZodOptional<z.ZodString>;
        creator_release_id: z.ZodOptional<z.ZodString>;
        lineage_parent_version_id: z.ZodOptional<z.ZodString>;
        rollback_from_version_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    files: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        sha256: z.ZodString;
        size: z.ZodNumber;
        required: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>>;
    signature: z.ZodOptional<z.ZodObject<{
        algorithm: z.ZodEnum<{
            sha256: "sha256";
            "hmac-sha256": "hmac-sha256";
            ed25519: "ed25519";
        }>;
        value: z.ZodString;
        key_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
}, z.core.$strict>;
export declare const sessionPackArchiveEnvelopeSchema: z.ZodObject<{
    format_version: z.ZodLiteral<"lingban.session-pack.archive/v1">;
    manifest: z.ZodObject<{
        manifest_version: z.ZodLiteral<"lingban.session-pack/v1">;
        session_id: z.ZodString;
        session_version: z.ZodString;
        task_family: z.ZodString;
        runtime_profile: z.ZodObject<{
            profile_id: z.ZodString;
            runner_image: z.ZodOptional<z.ZodString>;
            node_version: z.ZodOptional<z.ZodString>;
            python_version: z.ZodOptional<z.ZodString>;
            browser_required: z.ZodOptional<z.ZodBoolean>;
            playwright_required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>;
        slot_schema_version: z.ZodString;
        required_capabilities: z.ZodObject<{
            browser: z.ZodOptional<z.ZodBoolean>;
            filesystem: z.ZodOptional<z.ZodBoolean>;
            downloads: z.ZodOptional<z.ZodBoolean>;
            apis: z.ZodOptional<z.ZodArray<z.ZodString>>;
            mcps: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                name: z.ZodOptional<z.ZodString>;
                protocol: z.ZodOptional<z.ZodString>;
                risk_level: z.ZodOptional<z.ZodEnum<{
                    low: "low";
                    medium: "medium";
                    high: "high";
                    critical: "critical";
                }>>;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
            credentials: z.ZodOptional<z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                placement: z.ZodOptional<z.ZodEnum<{
                    file: "file";
                    env: "env";
                    "browser-state": "browser-state";
                }>>;
                required: z.ZodOptional<z.ZodBoolean>;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
        artifact_contract: z.ZodObject<{
            outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                kind: z.ZodEnum<{
                    file: "file";
                    directory: "directory";
                    report: "report";
                    receipt: "receipt";
                    archive: "archive";
                    image: "image";
                    document: "document";
                }>;
                required: z.ZodOptional<z.ZodBoolean>;
                path_pattern: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>>>;
        }, z.core.$strict>;
        created_by: z.ZodObject<{
            user_id: z.ZodString;
            display_name: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        created_at: z.ZodString;
        source: z.ZodOptional<z.ZodObject<{
            workspace_id: z.ZodOptional<z.ZodString>;
            creator_package_id: z.ZodOptional<z.ZodString>;
            creator_release_id: z.ZodOptional<z.ZodString>;
            lineage_parent_version_id: z.ZodOptional<z.ZodString>;
            rollback_from_version_id: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        files: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
            sha256: z.ZodString;
            size: z.ZodNumber;
            required: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>>;
        signature: z.ZodOptional<z.ZodObject<{
            algorithm: z.ZodEnum<{
                sha256: "sha256";
                "hmac-sha256": "hmac-sha256";
                ed25519: "ed25519";
            }>;
            value: z.ZodString;
            key_id: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>>;
    }, z.core.$strict>;
    files: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strict>;
export type SessionPackRuntimeProfile = z.infer<typeof sessionPackRuntimeProfileSchema>;
export type SessionPackRuntimeConfig = z.infer<typeof sessionPackRuntimeConfigSchema>;
export type SessionPackMcpCapability = z.infer<typeof sessionPackMcpCapabilitySchema>;
export type SessionPackCredentialCapability = z.infer<typeof sessionPackCredentialCapabilitySchema>;
export type SessionPackRequiredCapabilities = z.infer<typeof sessionPackRequiredCapabilitiesSchema>;
export type SessionPackArtifactOutput = z.infer<typeof sessionPackArtifactOutputSchema>;
export type SessionPackArtifactContract = z.infer<typeof sessionPackArtifactContractSchema>;
export type SessionPackCreator = z.infer<typeof sessionPackCreatorSchema>;
export type SessionPackSource = z.infer<typeof sessionPackSourceSchema>;
export type SessionPackSlotFieldType = z.infer<typeof sessionPackSlotFieldTypeSchema>;
export type SessionPackSlotChoice = z.infer<typeof sessionPackSlotChoiceSchema>;
export type SessionPackSlotDefinition = z.infer<typeof sessionPackSlotDefinitionSchema>;
export type SessionPackSlotSchemaFile = z.infer<typeof sessionPackSlotSchemaFileSchema>;
export type SessionPackMcpRequirementsFile = z.infer<typeof sessionPackMcpRequirementsFileSchema>;
export type SessionPackRedactionTarget = z.infer<typeof sessionPackRedactionTargetSchema>;
export type SessionPackRedactionRule = z.infer<typeof sessionPackRedactionRuleSchema>;
export type SessionPackRedactionMap = z.infer<typeof sessionPackRedactionMapSchema>;
export type SessionPackInformationCollectionReviewSlot = z.infer<typeof sessionPackInformationCollectionReviewSlotSchema>;
export type SessionPackInformationCollectionReviewAnswerTrace = z.infer<typeof sessionPackInformationCollectionReviewAnswerTraceSchema>;
export type SessionPackInformationCollectionReviewFile = z.infer<typeof sessionPackInformationCollectionReviewFileSchema>;
export type SessionPackFileIntegrity = z.infer<typeof sessionPackFileIntegritySchema>;
export type SessionPackSignature = z.infer<typeof sessionPackSignatureSchema>;
export type SessionPackManifest = z.infer<typeof sessionPackManifestSchema>;
export type SessionPackArchiveEnvelope = z.infer<typeof sessionPackArchiveEnvelopeSchema>;
//# sourceMappingURL=schema.d.ts.map