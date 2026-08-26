#!/usr/bin/env node
/**
 * Applies every db/*.sql file once, in filename order, tracking them in schema_migrations.
 * Safe to re-run: already-applied files are skipped.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db');

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  const line = readFileSync(envFile, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL missing from environment and .env');
  return line.slice('DATABASE_URL='.length).trim();
}

const client = new pg.Client({ connectionString: loadDatabaseUrl() });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`);

const { rows } = await client.query('SELECT filename FROM schema_migrations');
const applied = new Set(rows.map((r) => r.filename));
const pending = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && !applied.has(f)).sort();

for (const filename of pending) {
  const sql = readFileSync(join(migrationsDir, filename), 'utf8');
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    await client.query('COMMIT');
    console.log(`applied ${filename}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`FAILED ${filename}: ${err.message}`);
    process.exitCode = 1;
    break;
  }
}

if (!pending.length) console.log('no pending migrations');
await client.end();
