// Scheduled job: delete telemetry older than PRUNE_HOURS (default 24).
// Dokploy Schedules command (service fleet-api): node prune.js
const { createPg, ensureSchema } = require('./db');

(async () => {
  const pg = createPg();
  if (!pg) { console.error('[prune] DATABASE_URL not set'); process.exit(1); }
  const hours = Number(process.env.PRUNE_HOURS) || 24;
  try {
    await ensureSchema(pg);
    const r = await pg.query(`DELETE FROM telemetry WHERE at < now() - make_interval(hours => $1)`, [hours]);
    console.log(`[prune] removed ${r.rowCount} telemetry rows older than ${hours}h`);
  } catch (e) {
    console.error('[prune] failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pg.end();
  }
})();
