import type { FastifyInstance } from "fastify";
import { migrateLegacySessionArchivesInputSchema } from "@lingban/contracts";
import { AppError } from "../../app/errors.js";
import { requireCurrentWorkspaceAccess } from "../auth/request-auth.js";
import { legacySessionMigrationService } from "./service.js";

const roles = ["owner", "admin", "creator"] as const;

export async function registerSessionMigrationRoutes(server: FastifyInstance) {
  server.post("/session-versions/import", async (request) => {
    const auth = requireCurrentWorkspaceAccess(request, [...roles]);
    if (!(request.body instanceof Buffer) && !(request.body instanceof Uint8Array)) {
      throw new AppError(400, "SESSION_PACK_ARCHIVE_BODY_INVALID", "Session Pack archive body must be application/octet-stream");
    }
    return legacySessionMigrationService.importArchive(new Uint8Array(request.body), {
      workspaceId: auth?.currentWorkspace.workspaceId ?? "wsp_external_import",
      workspaceContextKey: auth?.currentWorkspace.contextKey ?? "personal:external-import",
      userId: auth?.user.userId ?? null,
    });
  });

  server.post("/session-migrations/legacy-archives", async (request) => {
    const auth = requireCurrentWorkspaceAccess(request, [...roles]);
    return legacySessionMigrationService.migrate(
      migrateLegacySessionArchivesInputSchema.parse(request.body ?? {}),
      {
        workspaceId: auth?.currentWorkspace.workspaceId ?? "wsp_legacy_migration",
        userId: auth?.user.userId ?? null,
      }
    );
  });
}
