import { providersStateSchema, type ProvidersState } from "./storage-schema.js";

export const seedProvidersState: ProvidersState = providersStateSchema.parse({
  providers: [],
  bindings: [],
});
