// Fleet API: listens to robot telemetry over MQTT, stores it, serves the ops dashboard,
// and sends commands (dock / resume / stop) back to robots.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mqtt = require('mqtt');
const { createPg, ensureSchema } = require('./db');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || '/data';
const FLEET_NAME = process.env.FLEET_NAME || 'Lab fleet';
const OFFLINE_AFTER = Number(process.env.OFFLINE_AFTER_SEC) || 15;
const COMMANDS = ['dock', 'resume', 'stop'];
const PAGE = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));

const pg = createPg();
let mqttConnected = false;
let messages = 0;

// ---- Volume: fleet config (stands in for maps, zones, calibration files)
fs.mkdirSync(DATA_DIR, { recursive: true });
const configFile = path.join(DATA_DIR, 'fleet-config.json');
if (!fs.existsSync(configFile)) {
  fs.writeFileSync(configFile, JSON.stringify({
    createdAt: new Date().toISOString(),
    createdBy: os.hostname(),
    map: 'warehouse-a',
    dock: { x: 0, y: 0 },
    zones: ['loading', 'storage', 'packing'],
  }, null, 2));
  console.log('[fleet] created new fleet-config.json on the volume');
}
const fleetConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));

// ---- MQTT
const client = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883', {
  clientId: `fleet-api-${os.hostname()}`,
  reconnectPeriod: 2000,
});
client.on('connect', () => {
  mqttConnected = true;
  console.log('[mqtt] connected');
  client.subscribe(['fleet/+/telemetry', 'fleet/+/ack']);
});
client.on('close', () => { if (mqttConnected) console.warn('[mqtt] disconnected'); mqttConnected = false; });
client.on('error', (e) => console.error('[mqtt]', e.message));

client.on('message', async (topic, payload) => {
  const [, robotId, kind] = topic.split('/');
  let msg;
  try { msg = JSON.parse(payload.toString()); } catch { return console.warn(`[mqtt] bad JSON from ${robotId}`); }
  if (kind === 'ack') return console.log(`[fleet] ${robotId} acknowledged "${msg.command}" -> ${msg.status}`);
  messages++;
  if (!pg) return;
  try {
    await ensureSchema(pg);
    await pg.query(
      `INSERT INTO robots (id, battery, x, y, status, last_seen) VALUES ($1,$2,$3,$4,$5, now())
       ON CONFLICT (id) DO UPDATE SET battery=$2, x=$3, y=$4, status=$5, last_seen=now()`,
      [robotId, msg.battery, msg.x, msg.y, msg.status],
    );
    await pg.query('INSERT INTO telemetry (robot_id, battery, x, y, status) VALUES ($1,$2,$3,$4,$5)',
      [robotId, msg.battery, msg.x, msg.y, msg.status]);
  } catch (e) {
    console.error('[fleet] store failed:', e.message);
  }
});

// ---- HTTP
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body, null, 2) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 2000) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok' });

    if (req.method === 'GET' && url.pathname === '/api/fleet') {
      let db = { status: 'off' };
      if (pg) {
        try {
          await ensureSchema(pg);
          const { rows } = await pg.query(`
            SELECT (SELECT count(*) FROM telemetry)::int AS telemetry_rows,
                   pg_size_pretty(pg_total_relation_size('telemetry')) AS telemetry_size,
                   (SELECT count(*) FROM commands)::int AS commands_sent`);
          db = { status: 'ok', ...rows[0] };
        } catch (e) { db = { status: 'error', detail: e.message }; }
      }
      return send(res, 200, {
        fleet: FLEET_NAME, host: os.hostname(), uptimeSec: Math.round(process.uptime()),
        mqtt: mqttConnected ? 'connected' : 'disconnected', messagesSinceStart: messages,
        database: db, config: fleetConfig,
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/robots') {
      if (!pg) return send(res, 503, { error: 'Database not configured' });
      await ensureSchema(pg);
      const { rows } = await pg.query(
        `SELECT *, extract(epoch FROM now() - last_seen)::int AS age_sec FROM robots ORDER BY id`);
      return send(res, 200, rows.map((r) => ({ ...r, online: r.age_sec < OFFLINE_AFTER })));
    }

    const m = url.pathname.match(/^\/api\/robots\/([\w-]+)\/command$/);
    if (req.method === 'POST' && m) {
      const { command } = await readBody(req);
      if (!COMMANDS.includes(command)) return send(res, 400, { error: `Command must be one of: ${COMMANDS.join(', ')}` });
      if (!mqttConnected) return send(res, 503, { error: 'MQTT broker not connected' });
      client.publish(`fleet/${m[1]}/command`, JSON.stringify({ command, at: Date.now() }), { qos: 1 });
      if (pg) await pg.query('INSERT INTO commands (robot_id, command) VALUES ($1, $2)', [m[1], command]);
      console.log(`[fleet] sent "${command}" to ${m[1]}`);
      return send(res, 200, { sent: command, robot: m[1] });
    }

    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[http]', e.message);
    return send(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`[fleet] "${FLEET_NAME}" dashboard on :${PORT}`));

function shutdown(sig) {
  console.log(`[fleet] ${sig}: stopping`);
  setTimeout(() => process.exit(0), 8000).unref();
  server.close(async () => {
    client.end(true);
    if (pg) await pg.end().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
