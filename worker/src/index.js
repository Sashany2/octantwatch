/**
 * OCTANT — order intake.
 *
 * The page cannot talk to Telegram directly: doing so would mean shipping the
 * bot token to every visitor, and a bot token in page source is a bot someone
 * else owns by lunchtime. So the browser talks to this worker, and only this
 * worker knows the token.
 *
 * Secrets (never in this file, never in git):
 *   wrangler secret put BOT_TOKEN     — from @BotFather
 *   wrangler secret put CHAT_ID       — your own chat id, from @userinfobot
 */

const ALLOWED_ORIGINS = [
    'https://octantwatch.xyz',
    'https://www.octantwatch.xyz',
    // local development: 8000 is what the README tells you to serve on, 8099 is
    // what the quality gate uses. A missing origin here comes back as a 403 on
    // your own machine and looks like a broken form.
    'http://localhost:8000',
    'http://localhost:8099',
];

const MODELS = {
    'OCT-01': 'Meridian 38',
    'OCT-02': 'Meridian 41',
    'OCT-03': 'Sector',
    'OCT-04': 'Nocturne',
    'OCT-05': 'Reserve',
    'OCT-06': 'Skeleton',
};

const corsHeaders = (origin) => ({
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
});

const json = (body, status, origin) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });

/* Telegram parses this as HTML, so anything a stranger typed has to be escaped
   before it gets there — otherwise a name containing "<b>" rewrites my message,
   and a name containing worse rewrites more than that. */
const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Ask Cloudflare whether this token is real, was minted for this widget, and has
 * not been spent already. The secret never leaves the worker.
 *
 * If TURNSTILE_SECRET_KEY is not configured, this REFUSES the order rather than
 * waving it through. A spam gate that fails open is not a gate — and the failure
 * would be invisible, which is worse than loud.
 */
async function verifyTurnstile(token, request, env) {
    if (!env.TURNSTILE_SECRET_KEY) {
        console.error('TURNSTILE_SECRET_KEY is not set — run wrangler secret put');
        return { ok: false, status: 500, error: 'the spam check is not configured' };
    }
    if (!token || typeof token !== 'string') {
        return { ok: false, status: 400, error: 'the spam check did not run — reload the page and try again' };
    }

    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    // The visitor's IP, so Cloudflare can weigh where the token was actually used
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.append('remoteip', ip);

    let outcome;
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: form,
        });
        outcome = await res.json();
    } catch (err) {
        console.error('siteverify unreachable:', err);
        return { ok: false, status: 502, error: 'could not run the spam check' };
    }

    if (!outcome.success) {
        console.warn('turnstile rejected a token:', JSON.stringify(outcome['error-codes'] || []));
        return { ok: false, status: 403, error: 'the spam check failed — reload the page and try again' };
    }

    return { ok: true };
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get('Origin') || '';

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }
        if (request.method !== 'POST') {
            return json({ ok: false, error: 'POST only' }, 405, origin);
        }
        if (origin && !ALLOWED_ORIGINS.includes(origin)) {
            return json({ ok: false, error: 'origin not allowed' }, 403, origin);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return json({ ok: false, error: 'malformed body' }, 400, origin);
        }

        /* The Turnstile gate, and it has to be here rather than in the browser.
           The Origin check above only stops other people's *pages*; it stops
           nothing that speaks HTTP directly, because a client that is not a
           browser sets Origin to whatever it likes. curl forges it in one flag —
           that is exactly how this worker was tested.

           A Turnstile token cannot be forged the same way: it is minted by
           Cloudflare for a real browser that passed a real challenge, it is
           bound to this widget, and it is only good once. Verify it server-side
           and the flood stops at the door. */
        const turnstile = await verifyTurnstile(body.turnstile, request, env);
        if (!turnstile.ok) {
            return json({ ok: false, error: turnstile.error }, turnstile.status, origin);
        }

        // Validate here, not in the browser. The browser's validation is a
        // courtesy to honest visitors; it stops nobody who does not want to be
        // stopped, because anyone can POST to this URL directly.
        const name = String(body.name || '').trim().slice(0, 80);
        const email = String(body.email || '').trim().slice(0, 120);
        const ref = String(body.ref || '').trim();
        const engraving = String(body.engraving || '').trim().slice(0, 24);

        if (!name) return json({ ok: false, error: 'name is required' }, 400, origin);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'email looks wrong' }, 400, origin);
        if (!MODELS[ref]) return json({ ok: false, error: 'unknown model' }, 400, origin);

        if (!env.BOT_TOKEN || !env.CHAT_ID) {
            console.error('BOT_TOKEN or CHAT_ID is not set — run wrangler secret put');
            return json({ ok: false, error: 'intake is not configured' }, 500, origin);
        }

        const lines = [
            '<b>OCTANT — new order</b>',
            '',
            `<b>Model:</b> ${escapeHtml(MODELS[ref])} (${escapeHtml(ref)})`,
            `<b>Name:</b> ${escapeHtml(name)}`,
            `<b>Email:</b> ${escapeHtml(email)}`,
            engraving ? `<b>Engraving:</b> ${escapeHtml(engraving)}` : null,
        ].filter(Boolean);

        const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: env.CHAT_ID,
                text: lines.join('\n'),
                parse_mode: 'HTML',
            }),
        });

        if (!tg.ok) {
            // The visitor must not be told "thank you" for an order that went
            // nowhere. That was the whole bug this worker exists to fix.
            const detail = await tg.text();
            console.error('telegram rejected the order:', tg.status, detail);
            return json({ ok: false, error: 'could not record the order' }, 502, origin);
        }

        return json({ ok: true }, 200, origin);
    },
};
