import { sql } from 'drizzle-orm';
import type { getDb } from '../db/client';
type Database = ReturnType<typeof getDb>;

/** Derive every field from persisted assessed evidence. Caller supplies only a source ID. */
export async function recordMistakes(db: Database, attemptId?: string) {
  const rows = await db.execute(sql`
    insert into mistake_occurrences (user_id, weakness_id, attempt_id, created_at)
    select a.user_id, m.weakness_id, a.id, a.created_at
    from exercise_attempts a
    join activity_weaknesses m on m.activity_id = a.activity_id and m.content_version = a.content_version
    where not a.is_correct ${attemptId ? sql`and a.id = ${attemptId}::uuid` : sql``}
    on conflict (attempt_id, weakness_id) do nothing returning id
  `);
  return Array.isArray(rows)
    ? rows.length
    : (rows as unknown as { rows: unknown[] }).rows.length;
}
export async function backfillMistakes(db: Database) {
  return db.transaction(async (tx) => ({
    created: await recordMistakes(tx as unknown as Database),
  }));
}
