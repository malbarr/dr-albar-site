/* dr-albar.com — blind contact relay (Cloudflare Worker)
 *
 * Route:  dr-albar.com/api/contact*
 *
 * The visitor POSTs JSON. Nothing about the owner's phone or address is ever
 * sent to the browser. The Worker:
 *   1. validates + rate-limits,
 *   2. pushes the message into KV  (key: msg:<ts>:<rand>)  so the owner's
 *      relay can pull it and deliver it over WhatsApp,
 *   3. optionally fires an instant Telegram notification.
 *
 * Bindings
 *   KV namespace : CONTACT      (required)
 *   secret       : PULL_KEY     (required — guards the pull endpoint)
 *   secret       : TG_TOKEN     (optional — instant Telegram ping)
 *   secret       : TG_CHAT      (optional — chat id / "chat_id:thread_id")
 *
 * Owner-side pull (used by scripts/pull_contact.js):
 *   GET /api/contact/pull?key=<PULL_KEY>      -> { items: [...] }  (and deletes)
 */

const MAX_PER_IP_PER_HOUR = 5;
const MAX_MSG = 4000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact/pull') return pull(request, env, url);
    if (url.pathname !== '/api/contact') return json({ error: 'not found' }, 404);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

    /* honeypot: silently pretend success so bots don't retry */
    if (body.website) return json({ ok: true });

    const name = str(body.name, 120);
    const reply = str(body.reply, 160);
    const topic = str(body.topic, 120) || 'غير محدّد';
    const message = str(body.message, MAX_MSG);

    if (!name || name.length < 2) return json({ error: 'name' }, 400);
    if (!reply) return json({ error: 'reply' }, 400);
    if (!message || message.length < 15) return json({ error: 'message' }, 400);
    if (body.ack !== true) return json({ error: 'ack' }, 400);

    /* rate limit per IP, 1 hour window */
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const rlKey = 'rl:' + ip;
    const seen = parseInt((await env.CONTACT.get(rlKey)) || '0', 10);
    if (seen >= MAX_PER_IP_PER_HOUR) return json({ error: 'rate' }, 429);
    await env.CONTACT.put(rlKey, String(seen + 1), { expirationTtl: 3600 });

    const item = {
      ts: new Date().toISOString(),
      name, reply, topic, message,
      page: str(body.page, 120),
      country: request.headers.get('CF-IPCountry') || '',
      ua: str(request.headers.get('User-Agent'), 200)
    };

    const key = 'msg:' + Date.now() + ':' + crypto.randomUUID().slice(0, 8);
    /* keep 30 days, then expire on its own */
    await env.CONTACT.put(key, JSON.stringify(item), { expirationTtl: 60 * 60 * 24 * 30 });

    if (env.TG_TOKEN && env.TG_CHAT) {
      /* fire and forget — a failed ping must not fail the submission */
      try { await notifyTelegram(env, item); } catch { /* ignored */ }
    }

    return cors(json({ ok: true }));
  }
};

async function pull(request, env, url) {
  if (url.searchParams.get('key') !== env.PULL_KEY) return json({ error: 'forbidden' }, 403);
  const list = await env.CONTACT.list({ prefix: 'msg:', limit: 50 });
  const items = [];
  for (const k of list.keys) {
    const v = await env.CONTACT.get(k.name);
    if (v) items.push({ key: k.name, ...JSON.parse(v) });
  }
  if (url.searchParams.get('peek') !== '1') {
    for (const it of items) await env.CONTACT.delete(it.key);
  }
  return json({ items, more: !list.list_complete });
}

async function notifyTelegram(env, it) {
  const [chat, thread] = String(env.TG_CHAT).split(':');
  const text =
    '📨 رسالة جديدة من موقع dr-albar.com\n\n' +
    'الاسم: ' + it.name + '\n' +
    'الرد على: ' + it.reply + '\n' +
    'الموضوع: ' + it.topic + '\n' +
    (it.country ? 'الدولة: ' + it.country + '\n' : '') +
    '\n' + it.message;
  const payload = { chat_id: chat, text };
  if (thread) payload.message_thread_id = Number(thread);
  await fetch('https://api.telegram.org/bot' + env.TG_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', 'https://dr-albar.com');
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}
