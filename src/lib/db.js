import pg from 'pg';
import { config } from './config.js';

// Numeric columns come back as strings by default (pg preserves precision).
// Every numeric in this schema is money or a count that fits in a float, so parse them.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => (value === null ? null : parseFloat(value)));
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => (value === null ? null : parseInt(value, 10)));

const globalForPool = globalThis;

export const pool =
  globalForPool.__wybiPool ??
  new pg.Pool({ connectionString: config.databaseUrl, max: 10, idleTimeoutMillis: 30_000 });

if (process.env.NODE_ENV !== 'production') globalForPool.__wybiPool = pool;

export function query(text, params) {
  return pool.query(text, params);
}

/** Runs `fn` inside a transaction, rolling back on any throw. */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
