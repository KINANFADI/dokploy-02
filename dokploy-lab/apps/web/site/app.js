const cfg = window.APP_CONFIG || {};
const api = (cfg.apiUrl || '').replace(/\/$/, '');
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const bar = $('env-bar');
bar.className = cfg.env || '';
bar.textContent = `Environment: ${cfg.env || 'unknown'}${cfg.banner ? `. ${cfg.banner}` : ''}`;

fetch('version.json').then((r) => r.json()).then((v) => {
  $('build').textContent = `Web build ${v.version}, built ${v.builtAt}. API: ${api || 'not configured (set API_URL)'}`;
}).catch(() => {});

function say(text) { $('message').textContent = text; }

async function call(path, options) {
  if (!api) throw new Error('API_URL is not set for the web service');
  const r = await fetch(api + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

async function refresh() {
  try {
    $('status').textContent = JSON.stringify(await call('/api/info'), null, 2);
    const orders = await call('/api/orders');
    $('orders').innerHTML = orders.length
      ? orders.map((o) => `<tr><td>${o.id}</td><td>${esc(o.item)}</td><td class="${esc(o.status)}">${esc(o.status)}</td><td>${esc(o.processed_by || '')}</td></tr>`).join('')
      : '<tr><td colspan="4" class="muted">No orders yet.</td></tr>';
    const notes = await call('/api/notes');
    $('notes').innerHTML = notes.map((n) => `<li>${esc(n.text)}</li>`).join('') || '<li class="muted">No notes yet.</li>';
  } catch (e) {
    $('status').textContent = `Can't reach the API: ${e.message}`;
  }
}

$('order-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await call('/api/orders', { method: 'POST', body: JSON.stringify({ item: $('item').value }) });
    say(`Order #${r.order.id} placed.${r.note ? ` ${r.note}` : ''}`);
    $('item').value = '';
  } catch (err) { say(`Order failed: ${err.message}`); }
  refresh();
});

$('note-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await call('/api/notes', { method: 'POST', body: JSON.stringify({ text: $('note').value }) });
    say('Note saved.');
    $('note').value = '';
  } catch (err) { say(`Note failed: ${err.message}`); }
  refresh();
});

refresh();
setInterval(refresh, 4000);
