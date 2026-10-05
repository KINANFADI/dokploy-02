const { Pool } = require('pg');

function createPg() {
  if (!process.env.DATABASE_URL) return null;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 3000 });
  pool.on('error', (e) => console.error('[pg]', e.message));
  return pool;
}

let schemaPromise = null;
function ensureSchema(pool) {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS robots (
        id        text PRIMARY KEY,
        battery   real,
        x         real,
        y         real,
        status    text,
        last_seen timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS telemetry (
        id       bigserial PRIMARY KEY,
        robot_id text NOT NULL,
        battery  real,
        x        real,
        y        real,
        status   text,
        at       timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS telemetry_at_idx ON telemetry (at);
      CREATE TABLE IF NOT EXISTS commands (
        id       serial PRIMARY KEY,
        robot_id text NOT NULL,
        command  text NOT NULL,
        at       timestamptz NOT NULL DEFAULT now()
      );
    `).catch((e) => { schemaPromise = null; throw e; });
  }
  return schemaPromise;
}

module.exports = { createPg, ensureSchema };
