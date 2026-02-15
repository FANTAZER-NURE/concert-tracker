import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  userId: z.string().min(1),
  artistId: z.string().min(1),
  continent: z.string().min(1).optional().nullable(),
  country: z.string().min(1).optional().nullable(),
  city: z.string().min(1).optional().nullable(),
  radiusKm: z.number().int().positive().optional().nullable(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
