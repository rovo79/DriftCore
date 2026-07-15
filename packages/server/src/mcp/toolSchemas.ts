import { z } from "zod";

export const EmptyInput = z.object({}).strict();

export const ScaffoldInput = z.object({
  machine_name: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/)
    .min(1)
    .max(64),
  target_type: z.literal("module"),
}).strict();
