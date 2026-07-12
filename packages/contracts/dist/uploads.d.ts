import { z } from "zod";
export declare const runUploadStatusSchema: z.ZodEnum<{
    blocked: "blocked";
    expired: "expired";
    created: "created";
    uploaded: "uploaded";
    attached: "attached";
}>;
export declare const runFileScanStatusSchema: z.ZodEnum<{
    error: "error";
    pending: "pending";
    blocked: "blocked";
    clean: "clean";
    skipped: "skipped";
}>;
export declare const runDownloadSourceKindSchema: z.ZodEnum<{
    "run-target-path": "run-target-path";
    "uploaded-object": "uploaded-object";
    "object-store": "object-store";
}>;
export declare const runUploadRecordSchema: z.ZodObject<{
    uploadId: z.ZodString;
    runId: z.ZodString;
    workspaceId: z.ZodString;
    fileName: z.ZodString;
    contentType: z.ZodNullable<z.ZodString>;
    declaredSizeBytes: z.ZodNullable<z.ZodNumber>;
    storedSizeBytes: z.ZodNullable<z.ZodNumber>;
    sha256: z.ZodNullable<z.ZodString>;
    objectKey: z.ZodString;
    status: z.ZodEnum<{
        blocked: "blocked";
        expired: "expired";
        created: "created";
        uploaded: "uploaded";
        attached: "attached";
    }>;
    scanStatus: z.ZodDefault<z.ZodEnum<{
        error: "error";
        pending: "pending";
        blocked: "blocked";
        clean: "clean";
        skipped: "skipped";
    }>>;
    scanEngine: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scanReasonCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scanDetail: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scanSignature: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    scannedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    attachedPath: z.ZodNullable<z.ZodString>;
    attachedLabel: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const createRunUploadInputSchema: z.ZodObject<{
    fileName: z.ZodString;
    contentType: z.ZodOptional<z.ZodString>;
    sizeBytes: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const createRunUploadResponseSchema: z.ZodObject<{
    upload: z.ZodObject<{
        uploadId: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        fileName: z.ZodString;
        contentType: z.ZodNullable<z.ZodString>;
        declaredSizeBytes: z.ZodNullable<z.ZodNumber>;
        storedSizeBytes: z.ZodNullable<z.ZodNumber>;
        sha256: z.ZodNullable<z.ZodString>;
        objectKey: z.ZodString;
        status: z.ZodEnum<{
            blocked: "blocked";
            expired: "expired";
            created: "created";
            uploaded: "uploaded";
            attached: "attached";
        }>;
        scanStatus: z.ZodDefault<z.ZodEnum<{
            error: "error";
            pending: "pending";
            blocked: "blocked";
            clean: "clean";
            skipped: "skipped";
        }>>;
        scanEngine: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scanReasonCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scanDetail: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scanSignature: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scannedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        attachedPath: z.ZodNullable<z.ZodString>;
        attachedLabel: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    uploadUrl: z.ZodString;
    method: z.ZodLiteral<"PUT">;
    maxBytes: z.ZodNumber;
    contentType: z.ZodLiteral<"application/octet-stream">;
}, z.core.$strip>;
export declare const finalizeRunUploadInputSchema: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const finalizeRunUploadResponseSchema: z.ZodObject<{
    upload: z.ZodObject<{
        uploadId: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        fileName: z.ZodString;
        contentType: z.ZodNullable<z.ZodString>;
        declaredSizeBytes: z.ZodNullable<z.ZodNumber>;
        storedSizeBytes: z.ZodNullable<z.ZodNumber>;
        sha256: z.ZodNullable<z.ZodString>;
        objectKey: z.ZodString;
        status: z.ZodEnum<{
            blocked: "blocked";
            expired: "expired";
            created: "created";
            uploaded: "uploaded";
            attached: "attached";
        }>;
        scanStatus: z.ZodDefault<z.ZodEnum<{
            error: "error";
            pending: "pending";
            blocked: "blocked";
            clean: "clean";
            skipped: "skipped";
        }>>;
        scanEngine: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scanReasonCode: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scanDetail: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scanSignature: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        scannedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        attachedPath: z.ZodNullable<z.ZodString>;
        attachedLabel: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    attachment: z.ZodObject<{
        path: z.ZodString;
        label: z.ZodString;
        slotKey: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const runDownloadTicketSchema: z.ZodObject<{
    ticketId: z.ZodString;
    runId: z.ZodString;
    workspaceId: z.ZodString;
    path: z.ZodString;
    fileName: z.ZodString;
    mimeType: z.ZodString;
    sourceKind: z.ZodEnum<{
        "run-target-path": "run-target-path";
        "uploaded-object": "uploaded-object";
        "object-store": "object-store";
    }>;
    objectKey: z.ZodNullable<z.ZodString>;
    uploadId: z.ZodNullable<z.ZodString>;
    checksum: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    expiresAt: z.ZodString;
    createdAt: z.ZodString;
    createdByUserId: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export declare const createRunDownloadTicketInputSchema: z.ZodObject<{
    path: z.ZodString;
}, z.core.$strip>;
export declare const createRunDownloadTicketResponseSchema: z.ZodObject<{
    ticket: z.ZodObject<{
        ticketId: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        path: z.ZodString;
        fileName: z.ZodString;
        mimeType: z.ZodString;
        sourceKind: z.ZodEnum<{
            "run-target-path": "run-target-path";
            "uploaded-object": "uploaded-object";
            "object-store": "object-store";
        }>;
        objectKey: z.ZodNullable<z.ZodString>;
        uploadId: z.ZodNullable<z.ZodString>;
        checksum: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        expiresAt: z.ZodString;
        createdAt: z.ZodString;
        createdByUserId: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    downloadUrl: z.ZodString;
}, z.core.$strip>;
export type RunUploadStatus = z.infer<typeof runUploadStatusSchema>;
export type RunFileScanStatus = z.infer<typeof runFileScanStatusSchema>;
export type RunUploadRecord = z.infer<typeof runUploadRecordSchema>;
export type CreateRunUploadInput = z.infer<typeof createRunUploadInputSchema>;
export type CreateRunUploadResponse = z.infer<typeof createRunUploadResponseSchema>;
export type FinalizeRunUploadInput = z.infer<typeof finalizeRunUploadInputSchema>;
export type FinalizeRunUploadResponse = z.infer<typeof finalizeRunUploadResponseSchema>;
export type RunDownloadSourceKind = z.infer<typeof runDownloadSourceKindSchema>;
export type RunDownloadTicket = z.infer<typeof runDownloadTicketSchema>;
export type CreateRunDownloadTicketInput = z.infer<typeof createRunDownloadTicketInputSchema>;
export type CreateRunDownloadTicketResponse = z.infer<typeof createRunDownloadTicketResponseSchema>;
//# sourceMappingURL=uploads.d.ts.map