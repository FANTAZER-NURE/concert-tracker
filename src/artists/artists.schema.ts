import { z } from 'zod';

export const createArtistSchema = z.object({
  name: z.string().min(1),
});

export type CreateArtistInput = z.infer<typeof createArtistSchema>;
