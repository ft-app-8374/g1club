/**
 * Cloudflare Worker — Betfair API Proxy
 *
 * Proxies requests to Betfair's API through Cloudflare's edge network.
 * This avoids AWS IP geo-blocking by Betfair.
 *
 * Deploy: npx wrangler deploy
 * Test: curl -X POST https://your-worker.workers.dev/api/login -H "X-Proxy-Key: YOUR_SECRET" ...
 */

const BETFAIR_HOSTS = {
  login: 'https://identitysso.betfair.com',
  api: 'https://api.betfair.com',
};

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Application, X-Authentication, X-Proxy-Key',
        },
      });
    }

    // Verify proxy secret to prevent open relay
    const proxyKey = request.headers.get('X-Proxy-Key');
    if (!proxyKey || proxyKey !== env.PROXY_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized proxy access' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Route: /login → Betfair SSO login
    // Route: /exchange/* → Betfair Exchange API
    let targetUrl;
    if (path === '/api/login' || path === '/login') {
      targetUrl = `${BETFAIR_HOSTS.login}/api/login`;
    } else if (path.startsWith('/exchange/')) {
      targetUrl = `${BETFAIR_HOSTS.api}${path}`;
    } else {
      return new Response(JSON.stringify({ error: 'Unknown route', path }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward the request to Betfair
    const headers = new Headers();
    // Copy relevant headers
    for (const key of ['Content-Type', 'X-Application', 'X-Authentication', 'Authorization']) {
      const val = request.headers.get(key);
      if (val) headers.set(key, val);
    }

    try {
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      const body = await resp.text();
      return new Response(body, {
        status: resp.status,
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy fetch failed', detail: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
