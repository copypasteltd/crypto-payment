import { type BridgeRegistration } from "@lingban/contracts";
import { z } from "zod";
import type { PostgresRepositoryOptions } from "./postgres-types.js";
export declare const bridgeRegistryStateSchema: z.ZodObject<{
    connections: z.ZodDefault<z.ZodArray<z.ZodObject<{
        bridgeId: z.ZodString;
        runId: z.ZodString;
        workspaceId: z.ZodString;
        targetPath: z.ZodString;
        control: z.ZodOptional<z.ZodObject<{
            baseUrl: z.ZodString;
            authToken: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        supportedCommands: z.ZodDefault<z.ZodArray<z.ZodEnum<{
            approve: "approve";
            sendMessage: "sendMessage";
            cancel: "cancel";
            ping: "ping";
            syncFiles: "syncFiles";
            flushArtifacts: "flushArtifacts";
        }>>>;
        connectedAt: z.ZodString;
        lastSeenAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type BridgeRegistryState = z.infer<typeof bridgeRegistryStateSchema>;
export interface BridgeRegistrationRepository {
    kind: "file" | "postgres";
    init(): Promise<void>;
    list(): Promise<BridgeRegistration[]>;
    save(registration: BridgeRegistration): Promise<void>;
    delete(runId: string): Promise<void>;
    clear(): Promise<void>;
}
export declare abstract class CachedBridgeRegistrationRepository implements BridgeRegistrationRepository {
    #private;
    abstract kind: "file" | "postgres";
    init(): Promise<void>;
    list(): Promise<{
        bridgeId: string;
        runId: string;
        workspaceId: string;
        targetPath: string;
        supportedCommands: ("approve" | "sendMessage" | "cancel" | "ping" | "syncFiles" | "flushArtifacts")[];
        connectedAt: string;
        control?: {
            baseUrl: string;
            authToken?: string | undefined;
        } | undefined;
        lastSeenAt?: string | undefined;
    }[]>;
    save(registration: BridgeRegistration): Promise<void>;
    delete(runId: string): Promise<void>;
    clear(): Promise<void>;
    protected getState(): {
        connections: {
            bridgeId: string;
            runId: string;
            workspaceId: string;
            targetPath: string;
            supportedCommands: ("approve" | "sendMessage" | "cancel" | "ping" | "syncFiles" | "flushArtifacts")[];
            connectedAt: string;
            control?: {
                baseUrl: string;
                authToken?: string | undefined;
            } | undefined;
            lastSeenAt?: string | undefined;
        }[];
    };
    protected abstract loadState(): Promise<BridgeRegistryState>;
    protected abstract persistRegistration(registration: BridgeRegistration): Promise<void>;
    protected abstract deleteRegistration(runId: string): Promise<void>;
    protected abstract clearStorage(): Promise<void>;
}
export declare class PostgresBridgeRegistrationRepository extends CachedBridgeRegistrationRepository {
    #private;
    kind: "postgres";
    constructor(options: PostgresRepositoryOptions);
    protected loadState(): Promise<{
        connections: {
            bridgeId: string;
            runId: string;
            workspaceId: string;
            targetPath: string;
            supportedCommands: ("approve" | "sendMessage" | "cancel" | "ping" | "syncFiles" | "flushArtifacts")[];
            connectedAt: string;
            control?: {
                baseUrl: string;
                authToken?: string | undefined;
            } | undefined;
            lastSeenAt?: string | undefined;
        }[];
    }>;
    protected persistRegistration(registration: BridgeRegistration): Promise<void>;
    protected deleteRegistration(runId: string): Promise<void>;
    protected clearStorage(): Promise<void>;
}
//# sourceMappingURL=bridge-repository.d.ts.map