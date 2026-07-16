import { z } from 'zod';

export const UuidSchema = z.string().uuid();

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  type: z.enum(['all', 'customers', 'devices', 'diagnostics']).default('all'),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
