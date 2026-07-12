import { initializeAuthInfrastructure } from "../modules/auth/service.js";
import { initializeCredentialsInfrastructure } from "../modules/credentials/service.js";
import { initializeCreatorInfrastructure } from "../modules/creator/service.js";
import { initializeMcpInfrastructure } from "../modules/mcp/service.js";
import { initializeQuotaInfrastructure } from "../modules/quotas/service.js";
import { initializeSessionInfrastructure } from "../modules/sessions/service.js";
import { initializeWorkshopInfrastructure } from "../modules/workshops/service.js";

export async function seedApiReferenceData() {
  await initializeAuthInfrastructure();
  await initializeCredentialsInfrastructure();
  await initializeMcpInfrastructure();
  await initializeWorkshopInfrastructure();
  await initializeSessionInfrastructure();
  await initializeCreatorInfrastructure();
  await initializeQuotaInfrastructure();

  return {
    seeded: true,
    modules: ["auth", "credentials", "mcp", "workshops", "sessions", "creator", "quotas"],
  };
}
