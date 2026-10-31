// The app's shared data. One POST /sync: the device sends what it has, the server merges it
// with what's stored, saves any change and returns the result. Every device ends up the same.
import Logic from '../logic.js';

const ORIGINS = ['https://thezeroquotient.github.io'];

const cors = req => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(req.headers.get('Origin')) ? req.headers.get('Origin') : ORIGINS[0],
  'Access-Control-Allow-Headers': 'Content-Type, X-Key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});
const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(req) } });

function validKey(given, real) {
  const enc = new TextEncoder(), a = enc.encode(given || ''), b = enc.encode(real || '');
  return a.length > 0 && a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}

// Stored as one row per month, plus one for the plan, so no row ever gets large.
async function load(db) {
  const { results } = await db.prepare('SELECT k, v FROM store').all();
  const out = { plan: null, days: {} };
  for (const { k, v } of results) {
    if (k === 'plan') out.plan = JSON.parse(v);
    else Object.assign(out.days, JSON.parse(v));
  }
  return out;
}
function toRows(store) {
  const rows = new Map();
  if (store.plan) rows.set('plan', store.plan);
  for (const k of Object.keys(store.days).sort()) {
    const month = k.slice(0, 7);
    rows.set(month, { ...rows.get(month), [k]: store.days[k] });
  }
  return rows;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    if (!validKey(req.headers.get('X-Key'), env.KEY)) return json(req, { error: 'Bad link' }, 401);
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/sync') return json(req, { error: 'Not found' }, 404);

    let incoming;
    try { incoming = await req.json(); } catch { return json(req, { error: 'Bad data' }, 400); }
    if (typeof incoming?.days !== 'object' || incoming.days === null) return json(req, { error: 'Bad data' }, 400);

    const stored = await load(env.DB);
    const merged = Logic.mergeStore(stored, incoming);

    const before = toRows(stored), writes = [];
    for (const [k, value] of toRows(merged)) {
      const text = JSON.stringify(value);
      if (JSON.stringify(before.get(k)) !== text) {
        writes.push(env.DB.prepare('INSERT OR REPLACE INTO store (k, v) VALUES (?, ?)').bind(k, text));
      }
    }
    if (writes.length) await env.DB.batch(writes);
    return json(req, merged);
  },
};
