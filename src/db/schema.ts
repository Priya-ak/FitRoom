import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth-schema'

export * from './auth-schema'

export const fits = sqliteTable(
  'fits',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
    selfieUrl: text('selfie_url').notNull(),
    garmentUrl: text('garment_url').notNull(),
    garmentName: text('garment_name').notNull(),
    garmentCategory: text('garment_category').notNull(),
    resultUrl: text('result_url').notNull(),
    note: text('note').notNull(),
  },
  (table) => [index('fits_userId_idx').on(table.userId)],
)
