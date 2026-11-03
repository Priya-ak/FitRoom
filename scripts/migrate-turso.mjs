// Applies every migrations/*.sql file, in order, to a Turso database. Safe to re-run (all statements use IF NOT EXISTS).
//   Windows (cmd):  set TURSO_DATABASE_URL=libsql://... && set TURSO_AUTH_TOKEN=... && npm run db:migrate:turso
//   macOS/Linux:    TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... npm run db:migrate:turso
import { createClient } from '@libsql/client'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.env.TURSO_DATABASE_URL
if (!url) {
  console.error('Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) first.')
  process.exit(1)
}
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
const dir = fileURLToPath(new URL('../migrations/', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
for (const file of files) {
  const statements = readFileSync(join(dir, file), 'utf8')
    .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    .split(';').map((s) => s.trim()).filter(Boolean)
  await client.batch(statements, 'write')
  console.log(`applied ${file} (${statements.length} statements)`)
}
const tables = await client.execute("select name from sqlite_master where type='table' order by name")
console.log('tables:', tables.rows.map((r) => r.name).join(', '))
client.close()
