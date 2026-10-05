// Simulates a fleet of warehouse robots talking MQTT, like real robots on Tailscale would.
// Env: MQTT_URL, ROBOT_COUNT (5), ROBOT_PREFIX (R), FAULTY_ROBOT (e.g. R-03: drops offline every 2 min)
const mqtt = require('mqtt');

const COUNT = Math.min(Number(process.env.ROBOT_COUNT) || 5, 50);
const PREFIX = process.env.ROBOT_PREFIX || 'R';
const FAULTY = process.env.FAULTY_ROBOT || '';
const rand = (a, b) => a + Math.random() * (b - a);

const robots = Array.from({ length: COUNT }, (_, i) => ({
  id: `${PREFIX}-${String(i + 1).padStart(2, '0')}`,
  battery: rand(40, 100),
  x: rand(-20, 20),
  y: rand(-20, 20),
  status: 'working',
}));

const client = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883', {
  clientId: `robot-sim-${process.pid}`,
  reconnectPeriod: 2000,
});

client.on('connect', () => {
  console.log(`[sim] connected, simulating ${COUNT} robots (${robots.map((r) => r.id).join(', ')})`);
  client.subscribe('fleet/+/command');
});
client.on('error', (e) => console.error('[sim]', e.message));

client.on('message', (topic, payload) => {
  const id = topic.split('/')[1];
  const robot = robots.find((r) => r.id === id);
  if (!robot) return;
  let command;
  try { ({ command } = JSON.parse(payload.toString())); } catch { return; }
  if (command === 'dock') robot.status = 'returning';
  if (command === 'resume' && robot.battery > 10) robot.status = 'working';
  if (command === 'stop') robot.status = 'stopped';
  console.log(`[sim] ${id} got "${command}" -> ${robot.status}`);
  client.publish(`fleet/${id}/ack`, JSON.stringify({ command, status: robot.status }));
});

function step(r) {
  if (r.status === 'working') {
    r.battery -= rand(0.3, 1.0);
    r.x += rand(-1.5, 1.5);
    r.y += rand(-1.5, 1.5);
    if (r.battery < 15) { r.status = 'returning'; console.log(`[sim] ${r.id} battery low, returning to dock`); }
  } else if (r.status === 'returning') {
    r.battery -= 0.2;
    r.x *= 0.7;
    r.y *= 0.7;
    if (Math.hypot(r.x, r.y) < 1) { r.x = 0; r.y = 0; r.status = 'charging'; }
  } else if (r.status === 'charging') {
    r.battery = Math.min(100, r.battery + 3);
    if (r.battery >= 100) r.status = 'working';
  }
  r.battery = Math.max(0, r.battery);
}

setInterval(() => {
  if (!client.connected) return;
  const faultyOffline = FAULTY && Math.floor(Date.now() / 1000) % 120 < 30; // offline 30s of every 2 min
  for (const r of robots) {
    step(r);
    if (r.id === FAULTY && faultyOffline) continue;
    client.publish(`fleet/${r.id}/telemetry`, JSON.stringify({
      battery: Number(r.battery.toFixed(1)), x: Number(r.x.toFixed(2)), y: Number(r.y.toFixed(2)), status: r.status,
    }));
  }
}, 2000);

const stop = () => { console.log('[sim] stopping'); client.end(true, () => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
