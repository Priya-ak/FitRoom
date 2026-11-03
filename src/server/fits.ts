import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { fits } from '@/db/schema'
import { getDb } from '@/lib/db'
import { currentUser } from '@/lib/session.server'
import type { FitRecord } from '@/lib/fitroom'

const saveSchema = z.object({
  id: z.string().min(8),
  createdAt: z.string().min(8),
  selfieUrl: z.string().min(1),
  garmentUrl: z.string().min(1),
  garmentName: z.string().min(1).max(120),
  garmentCategory: z.string().min(1).max(60),
  resultUrl: z.string().min(1),
  note: z.string().max(400).optional(),
})

export const listUserFits = createServerFn({ method: 'GET' }).handler(async (): Promise<FitRecord[]> => {
  try {
    const user = await currentUser()
    if (!user) return []
    const db = await getDb()
    const rows = await db.select().from(fits).where(eq(fits.userId, user.id)).orderBy(desc(fits.createdAt)).limit(40)
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      selfieUrl: row.selfieUrl,
      garmentUrl: row.garmentUrl,
      garmentName: row.garmentName,
      garmentCategory: row.garmentCategory,
      resultUrl: row.resultUrl,
      note: row.note,
    }))
  } catch (error) {
    console.error('[fitroom] list fits failed', error)
    return []
  }
})

export const saveUserFit = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as z.infer<typeof saveSchema>)
  .handler(async ({ data }) => {
    const parsed = saveSchema.safeParse(data)
    if (!parsed.success) throw new Error('That look could not be saved.')
    const user = await currentUser()
    if (!user) return { saved: false as const, reason: 'guest' }
    try {
      const db = await getDb()
      await db.insert(fits).values({ ...parsed.data, userId: user.id, note: parsed.data.note ?? '' })
      return { saved: true as const }
    } catch (error) {
      console.error('[fitroom] save fit failed', error)
      throw new Error('Could not save that look to your account. It is still stored on this device.')
    }
  })

export const deleteUserFit = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as { id: string })
  .handler(async ({ data }) => {
    const id = typeof data?.id === 'string' ? data.id : ''
    if (!id) throw new Error('Missing look id.')
    const user = await currentUser()
    if (!user) return { deleted: false as const }
    const db = await getDb()
    await db.delete(fits).where(and(eq(fits.id, id), eq(fits.userId, user.id)))
    return { deleted: true as const }
  })
