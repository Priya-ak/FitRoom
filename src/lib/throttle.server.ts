// SERVER-ONLY. Fixed-window counters in the database (shared by every serverless instance).
// Used for the password step of sign-in, which is not a Better Auth endpoint and so is not covered by its limiter.
import { eq } from 'drizzle-orm'
import { rateLimit } from '@/db/schema'
import { getDb } from './db'

/** Returns true when the call is allowed, false when `key` already used `max` calls in the last `windowSec` seconds. */
export async function throttle(key: string, max: number, windowSec: number): Promise<boolean> {
  const db = await getDb()
  const now = Date.now()
  const [row] = await db.select().from(rateLimit).where(eq(rateLimit.key, key)).limit(1)
  if (!row) {
    await db
      .insert(rateLimit)
      .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
      .onConflictDoNothing()
    return true
  }
  if (now - row.lastRequest > windowSec * 1000) {
    await db.update(rateLimit).set({ count: 1, lastRequest: now }).where(eq(rateLimit.key, key))
    return true
  }
  if (row.count >= max) return false
  // lastRequest stays at the window start, so the window cannot be extended forever by retrying.
  await db.update(rateLimit).set({ count: row.count + 1 }).where(eq(rateLimit.key, key))
  return true
}
