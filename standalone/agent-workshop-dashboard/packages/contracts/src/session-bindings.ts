import { z } from "zod";
import { serviceIdSchema, workspaceContextKeySchema } from "./catalog.js";
import { creatorPackageIdSchema } from "./creator.js";
import {
  creatorPackageSessionBindingIdSchema,
  entrySurfaceSchema,
  isoDatetimeSchema,
  serviceSessionBindingIdSchema,
  sessionVersionIdSchema,
  taskVersionIdSchema,
} from "./common.js";

export const sessionBindingStateSchema = z.enum(["candidate", "active", "inactive"]);

export const creatorPackageSessionBindingSchema = z.object({
  bindingId: creatorPackageSessionBindingIdSchema,
  packageId: creatorPackageIdSchema,
  sessionVersionId: sessionVersionIdSchema,
  state: sessionBindingStateSchema,
  version: z.number().int().positive(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});
export const putCreatorPackageSessionBindingInputSchema = z.object({
  sessionVersionId: sessionVersionIdSchema,
  state: sessionBindingStateSchema,
  expectedVersion: z.number().int().nonnegative(),
});
export const creatorPackageSessionBindingsSchema = z.object({
  active: creatorPackageSessionBindingSchema.nullable(),
  candidate: creatorPackageSessionBindingSchema.nullable(),
});

export const serviceSessionBindingSchema = z.object({
  bindingId: serviceSessionBindingIdSchema,
  serviceId: serviceIdSchema,
  workspaceContextKey: workspaceContextKeySchema,
  entrySurface: entrySurfaceSchema,
  taskVersionId: taskVersionIdSchema,
  sessionVersionId: sessionVersionIdSchema,
  state: sessionBindingStateSchema,
  version: z.number().int().positive(),
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
});

export type SessionBindingState = z.infer<typeof sessionBindingStateSchema>;
export type CreatorPackageSessionBinding = z.infer<typeof creatorPackageSessionBindingSchema>;
export type PutCreatorPackageSessionBindingInput = z.infer<
  typeof putCreatorPackageSessionBindingInputSchema
>;
export type CreatorPackageSessionBindings = z.infer<typeof creatorPackageSessionBindingsSchema>;
export type ServiceSessionBinding = z.infer<typeof serviceSessionBindingSchema>;
