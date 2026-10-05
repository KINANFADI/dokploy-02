// Scheduled job (Dokploy Schedules): node jobs/daily-report.js
const fs = require('fs');
const path = require('path');
const { createPg, ensureSchema } = require('../db');

(async () => {
  const pg = createPg();
  if (!pg) { console.error('[report] DATABASE_URL not set'); process.exit(1); }
  try {
    await ensureSchema(pg);
    const { rows } = await pg.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE status = 'done')::int    AS done,
             count(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM orders`);
    const summary = { ...rows[0], generatedAt: new Date().toISOString() };
    await pg.query('INSERT INTO reports (summary) VALUES ($1)', [summary]);

    const dir = path.join(process.env.DATA_DIR || '/data', 'reports');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${summary.generatedAt.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(summary, null, 2));
    console.log(`[report] total=${summary.total} done=${summary.done} pending=${summary.pending} -> ${file}`);
  } catch (e) {
    console.error('[report] failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pg.end();
  }
})();
