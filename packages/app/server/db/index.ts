import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import { join, resolve } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { config as appConfig } from '../../../../forgecrawl.config'

let _db: ReturnType<typeof drizzle<typeof schema>>
let _sqlite: InstanceType<typeof Database> | null = null

export function getSqlite() {
  return _sqlite
}

export function getDb() {
  if (_db) return _db

  const config = useRuntimeConfig()
  const dataDir = config.dataDir || './data'
  const dbPath = join(dataDir, 'forgecrawl.sqlite')

  // Ensure data directory exists
  mkdirSync(dataDir, { recursive: true })

  _sqlite = new Database(dbPath)

  // Performance and safety pragmas
  _sqlite.pragma('journal_mode = WAL')
  _sqlite.pragma('synchronous = NORMAL')
  _sqlite.pragma('foreign_keys = ON')
  _sqlite.pragma(`busy_timeout = ${appConfig.db.busyTimeout}`)
  _sqlite.pragma('cache_size = -64000')

  _db = drizzle(_sqlite, { schema })

  // Auto-migrate on startup
  // In dev mode, CWD is packages/app/. In production, migrations are bundled.
  const migrationsPath = resolve('server/db/migrations')
  if (existsSync(migrationsPath)) {
    migrate(_db, { migrationsFolder: migrationsPath })
  }

  return _db
}
