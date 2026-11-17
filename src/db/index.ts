import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, PgliteDatabase } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';

export const DDL_STATEMENTS = `
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  caregiver_name TEXT NOT NULL,
  patient_alias TEXT NOT NULL,
  start_time TIMESTAMP NOT NULL DEFAULT NOW(),
  end_time TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  scheduled_slot TEXT NOT NULL,
  is_critical BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_logs (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

export type AnyDb = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __careops_db: AnyDb | undefined;
}

export async function getDb(): Promise<AnyDb> {
  if (globalThis.__careops_db) {
    return globalThis.__careops_db;
  }

  const connectionString = process.env.DATABASE_URL;

  // If real PostgreSQL is configured and FORCE_PGLITE is not set, try connecting
  if (connectionString && !process.env.FORCE_PGLITE) {
    try {
      const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 500,
      });

      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        await client.query(DDL_STATEMENTS);
      } finally {
        client.release();
      }

      const db = drizzlePg(pool, { schema });
      globalThis.__careops_db = db;
      return db;
    } catch {
      // Gracefully fall back to PGlite
    }
  }

  const dataDir = path.resolve(process.cwd(), '.pgdata');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let client: PGlite;
  try {
    client = new PGlite(dataDir);
    await client.exec(DDL_STATEMENTS);
  } catch (err) {
    console.warn('PGlite recovery fallback triggered:', err);
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.mkdirSync(dataDir, { recursive: true });
      client = new PGlite(dataDir);
      await client.exec(DDL_STATEMENTS);
    } catch {
      client = new PGlite();
      await client.exec(DDL_STATEMENTS);
    }
  }

  const db = drizzlePglite(client, { schema });
  globalThis.__careops_db = db;
  return db;
}
