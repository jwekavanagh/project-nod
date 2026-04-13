import { z } from "zod";

export const funnelSurfaceImpressionSchema = z.object({
  surface: z.enum(["acquisition", "integrate"]),
});

export type FunnelSurfaceImpressionBody = z.infer<typeof funnelSurfaceImpressionSchema>;
