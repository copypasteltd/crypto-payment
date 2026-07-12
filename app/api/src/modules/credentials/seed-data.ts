import { credentialsStateSchema, type CredentialsState } from "./storage-schema.js";

export const seedCredentialsState: CredentialsState = credentialsStateSchema.parse({
  credentials: [],
});
