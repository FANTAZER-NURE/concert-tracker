import { SourceType } from '@prisma/client';
import { z } from 'zod';

export const createSourceSchema = z
  .object({
    artistId: z.string().min(1).optional().nullable(),
    type: z.nativeEnum(SourceType),
    name: z.string().min(1),
    url: z.string().url().optional().nullable(),
    externalId: z.string().min(1).optional().nullable(),
  })
  .refine((value) => value.url || value.externalId, {
    message: 'Either url or externalId is required',
    path: ['url'],
  });

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
