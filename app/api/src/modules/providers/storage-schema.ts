import { z } from "zod";
import {
  providerIdParamsSchema,
  providerProfileSchema,
  workspaceProviderBindingIdParamsSchema,
  workspaceProviderBindingSchema,
} from "@lingban/contracts";

export const providersStateSchema = z.object({
  providers: z.array(providerProfileSchema).default([]),
  bindings: z.array(workspaceProviderBindingSchema).default([]),
});

export {
  providerIdParamsSchema,
  workspaceProviderBindingIdParamsSchema,
};

export type ProvidersState = z.infer<typeof providersStateSchema>;
