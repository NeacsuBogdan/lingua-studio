import nextEnv from '@next/env';
import { defineConfig } from 'drizzle-kit';
nextEnv.loadEnvConfig(process.cwd());
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
});
