// Order worker: takes jobs from the Redis "orders" list and marks them done in Postgres.
// Env: DATABASE_URL, REDIS_URL, WORK_DELAY_MS (default 1500), PORT (health, default 3000)
const http = require('http');
const os = require('os');
const { Pool } = require('pg');
const { createClient } = require('redis');

const PORT = Number(process.env.PORT) || 3000;
const DELAY = Number(process.env.WORK_DELAY_MS) || 1500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let running = true;

http.createServer((req, res) => {
  res.writeHead(running ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ role: 'worker', status: running ? 'ok' : 'stopping' }));
}).listen(PORT, '0.0.0.0');

if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
  console.error('[worker] DATABASE_URL and REDIS_URL are required. Idling.');
} else {
  const pg = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  pg.on('error', (e) => console.error('[pg]', e.message));

  const opts = { url: process.env.REDIS_URL, socket: { reconnectStrategy: (n) => Math.min(n * 500, 5000) } };
  const redis = createClient(opts);
  const blocking = createClient(opts);
  for (const [name, c] of [['main', redis], ['queue', blocking]]) {
    let last = '';
    c.on('error', (e) => { if (e.message !== last) console.error(`[redis:${name}] ${e.message}`); last = e.message; });
    c.on('ready', () => { last = ''; console.log(`[redis:${name}] connected`); });
    c.connect().catch(() => {});
  }

  setInterval(() => {
    if (redis.isReady) {
      redis.set('worker:heartbeat', JSON.stringify({ ts: Date.now(), host: os.hostname() }), { EX: 30 })
        .catch((e) => console.error('[worker] heartbeat:', e.message));
    }
  }, 5000);

  (async function loop() {
    console.log(`[worker] started on ${os.hostname()}, delay ${DELAY}ms`);
    while (running) {
      if (!blocking.isReady) { await sleep(1000); continue; }
      try {
        const item = await blocking.brPop('orders', 5);
        if (!item) continue;
        const { id } = JSON.parse(item.element);
        await sleep(DELAY);
        await pg.query(
          "UPDATE orders SET status = 'done', processed_at = now(), processed_by = $1 WHERE id = $2",
          [os.hostname(), id],
        );
        console.log(`[worker] order #${id} done`);
      } catch (e) {
        if (running) { console.error('[worker]', e.message); await sleep(1000); }
      }
    }
  })();

  const stop = async (sig) => {
    if (!running) return;
    running = false;
    console.log(`[worker] ${sig}: stopping`);
    setTimeout(() => process.exit(0), 5000).unref();
    await Promise.allSettled([blocking.isOpen && blocking.disconnect(), redis.isOpen && redis.quit(), pg.end()]);
    process.exit(0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}
