// Product API for the Dokploy lab.
// Env: DATABASE_URL, REDIS_URL, APP_ENV, SECRET_KEY, FAIL_MODE (none|slow|errors|leak), DATA_DIR, PORT
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { withTimeout, createPg, ensureSchema, createRedis } = require('./db');
const release = require('./release.json');

const PORT = Number(process.env.PORT) || 3000;
const APP_ENV = process.env.APP_ENV || 'local';
const FAIL_MODE = process.env.FAIL_MODE || 'none';
const DATA_DIR = process.env.DATA_DIR || '/data';
const BUILD_VERSION = process.env.BUILD_VERSION || 'dev';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const leak = [];
let shuttingDown = false;

// ---- Simulated bad release: set "broken": true in release.json and push.
if (release.broken) {
  console.error(`[api] release ${release.version}: running database migration...`);
  setTimeout(() => {
    console.error('[api] FATAL: migration failed: column "customer_id" does not exist');
    process.exit(1);
  }, 1500);
  return;
}

const pg = createPg();
const redis = createRedis('api');

// ---- Volume: notes + boot log
fs.mkdirSync(path.join(DATA_DIR, 'notes'), { recursive: true });
fs.appendFileSync(path.join(DATA_DIR, 'boots.log'), `${new Date().toISOString()} ${os.hostname()} ${release.version}\n`);

function volumeInfo() {
  try {
    const boots = fs.readFileSync(path.join(DATA_DIR, 'boots.log'), 'utf8').trim().split('\n').length;
    const notes = fs.readdirSync(path.join(DATA_DIR, 'notes')).length;
    return { status: 'ok', path: DATA_DIR, boots, notes };
  } catch (e) {
    return { status: 'error', detail: e.message };
  }
}

async function dbInfo() {
  if (!pg) return { status: 'off', detail: 'DATABASE_URL not set' };
  try {
    await withTimeout(ensureSchema(pg), 3000, 'schema');
    const { rows } = await withTimeout(pg.query(`
      SELECT count(*) FILTER (WHERE status = 'pending')::int AS pending,
             count(*) FILTER (WHERE status = 'done')::int    AS done,
             (SELECT count(*) FROM reports)::int             AS reports,
             (SELECT max(created_at) FROM reports)           AS last_report
      FROM orders`), 3000, 'query');
    return { status: 'ok', ...rows[0] };
  } catch (e) {
    return { status: 'error', detail: e.message };
  }
}

async function redisInfo() {
  if (!redis) return { status: 'off', detail: 'REDIS_URL not set' };
  if (!redis.isReady) return { status: 'error', detail: 'not connected, retrying' };
  try {
    const [queue, hb] = await withTimeout(Promise.all([
      redis.lLen('orders'), redis.get('worker:heartbeat'),
    ]), 3000, 'redis');
    const worker = hb ? JSON.parse(hb) : null;
    return {
      status: 'ok',
      queue,
      worker: worker ? { host: worker.host, ageSec: Math.round((Date.now() - worker.ts) / 1000) } : null,
    };
  } catch (e) {
    return { status: 'error', detail: e.message };
  }
}

async function info() {
  const [database, cache] = await Promise.all([dbInfo(), redisInfo()]);
  const secret = process.env.SECRET_KEY;
  return {
    service: 'api',
    release: release.version,
    build: BUILD_VERSION,
    env: APP_ENV,
    failMode: FAIL_MODE,
    host: os.hostname(),
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1e6),
    secretKey: secret ? `${secret.slice(0, 2)}**** (${secret.length} chars)` : 'not set',
    database,
    redis: cache,
    volume: volumeInfo(),
  };
}

// ---- HTTP helpers
const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};
function send(res, code, obj) { res.writeHead(code, HEADERS); res.end(JSON.stringify(obj, null, 2)); }

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 10_000) { reject(new Error('Body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

async function failMode(pathname) {
  if (pathname === '/health') return null;
  if (FAIL_MODE === 'slow') await sleep(2000 + Math.random() * 2000);
  if (FAIL_MODE === 'errors' && Math.random() < 0.5) return 'Simulated failure (FAIL_MODE=errors)';
  if (FAIL_MODE === 'leak') leak.push(Buffer.alloc(5 * 1024 * 1024, 1)); // ~5 MB per request
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = `${req.method} ${url.pathname}`;
  const t = Date.now();
  res.on('finish', () => {
    if (url.pathname !== '/health') console.log(`${route} ${res.statusCode} ${Date.now() - t}ms`);
  });

  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    const failure = await failMode(url.pathname);
    if (failure) return send(res, 500, { error: failure });

    switch (route) {
      case 'GET /':
        return send(res, 200, { service: 'lab-api', try: ['/health', '/api/info', '/api/orders', '/api/notes'] });

      case 'GET /health':
        return shuttingDown ? send(res, 503, { status: 'stopping' }) : send(res, 200, { status: 'ok' });

      case 'GET /api/info':
        return send(res, 200, await info());

      case 'GET /api/orders': {
        if (!pg) return send(res, 503, { error: 'Database not configured' });
        await ensureSchema(pg);
        const { rows } = await pg.query('SELECT * FROM orders ORDER BY id DESC LIMIT 20');
        return send(res, 200, rows);
      }

      case 'POST /api/orders': {
        if (!pg) return send(res, 503, { error: 'Database not configured' });
        const body = await readBody(req);
        const item = String(body.item || '').trim().slice(0, 100);
        if (!item) return send(res, 400, { error: 'Field "item" is required' });
        await ensureSchema(pg);
        const { rows } = await pg.query('INSERT INTO orders (item) VALUES ($1) RETURNING *', [item]);
        let queued = false;
        if (redis && redis.isReady) {
          await redis.lPush('orders', JSON.stringify({ id: rows[0].id }));
          queued = true;
        }
        return send(res, 201, { order: rows[0], queued, note: queued ? undefined : 'Redis down: order stays pending' });
      }

      case 'GET /api/notes': {
        const dir = path.join(DATA_DIR, 'notes');
        const files = fs.readdirSync(dir).sort().reverse().slice(0, 20);
        return send(res, 200, files.map((f) => ({ file: f, text: fs.readFileSync(path.join(dir, f), 'utf8') })));
      }

      case 'POST /api/notes': {
        const body = await readBody(req);
        const text = String(body.text || '').trim().slice(0, 500);
        if (!text) return send(res, 400, { error: 'Field "text" is required' });
        const file = `${Date.now()}.txt`;
        fs.writeFileSync(path.join(DATA_DIR, 'notes', file), text);
        return send(res, 201, { saved: file });
      }

      default:
        return send(res, 404, { error: 'Not found' });
    }
  } catch (e) {
    console.error(`[api] ${route} failed:`, e.message);
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] release ${release.version} (build ${BUILD_VERSION}) env=${APP_ENV} failMode=${FAIL_MODE} on :${PORT}`);
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[api] ${signal}: draining`);
  setTimeout(() => process.exit(0), 10_000).unref();
  server.close(async () => {
    await Promise.allSettled([pg && pg.end(), redis && redis.isOpen && redis.quit()]);
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
