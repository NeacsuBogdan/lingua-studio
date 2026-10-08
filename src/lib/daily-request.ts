import { z } from 'zod';
// The browser requests Start; every plan field and identity comes from the server.
export const dailyStartSchema = z.object({}).strict();
