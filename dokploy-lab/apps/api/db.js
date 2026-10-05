const { Pool } = require('pg');
const { createClient } = require('redis');

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
      CREATE TABLE IF NOT EXISTS orders (
        id           serial PRIMARY KEY,
        item         text NOT NULL,
        status       text NOT NULL DEFAULT 'pending',
        created_at   timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        processed_by text
      );
      CREATE TABLE IF NOT EXISTS reports (
        id         serial PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        summary    jsonb NOT NULL
      );
    `).catch((e) => { schemaPromise = null; throw e; });
  }
  return schemaPromise;
}

function createRedis(name) {
  if (!process.env.REDIS_URL) return null;
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 3000, reconnectStrategy: (n) => Math.min(n * 500, 5000) },
  });
  let last = '';
  client.on('error', (e) => { if (e.message !== last) console.error(`[redis:${name}] ${e.message}`); last = e.message; });
  client.on('ready', () => { last = ''; console.log(`[redis:${name}] connected`); });
  client.connect().catch(() => {});
  return client;
}

module.exports = { withTimeout, createPg, ensureSchema, createRedis };
