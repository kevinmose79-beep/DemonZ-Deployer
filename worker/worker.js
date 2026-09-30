/**
 * DemonZ Deployer — Cloudflare Worker
 * v3.1.0
 *
 * Secure GitHub OAuth token exchange.
 *
 * Frontend:
 * https://kevinmose79-beep.github.io/DemonZ-Deployer/
 *
 * IMPORTANT:
 * CLIENT_SECRET must ONLY exist as a Cloudflare Worker Secret.
 */

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const EXPECTED_CLIENT_ID = 'Ov23liFAyEj9YNz0XrRN';

const ALLOWED_ORIGINS = new Set([
  'https://kevinmose79-beep.github.io',
  'http://localhost',
  'http://127.0.0.1',
]);

const EXCHANGE_PATH = '/exchange';

const MAX_BODY_BYTES = 2048;

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 300;

// Fallback rate-limit store.
// KV is preferred when RATE_LIMIT is configured.
const memoryRateLimit = new Map();


// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin');

  if (!origin) {
    return null;
  }

  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(origin) {
  const headers = {
    'Vary': 'Origin',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }

  return headers;
}


// ─────────────────────────────────────────────────────────────
// JSON RESPONSE
// ─────────────────────────────────────────────────────────────

function jsonResponse(data, status, origin = null, extraHeaders = {}) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders(origin),
        ...extraHeaders,
      },
    }
  );
}


// ─────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────

async function checkRateLimit(ip, env) {
  const now = Math.floor(Date.now() / 1000);
  const key = `oauth:${ip}`;

  // ── Cloudflare KV ──────────────────────────────────────────
  if (env.RATE_LIMIT) {
    let entry = null;

    try {
      const stored = await env.RATE_LIMIT.get(key);

      if (stored) {
        entry = JSON.parse(stored);
      }
    } catch (error) {
      console.error('KV read failed:', error.message);
    }

    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + RATE_LIMIT_WINDOW_SECONDS,
      };
    }

    entry.count += 1;

    try {
      await env.RATE_LIMIT.put(
        key,
        JSON.stringify(entry),
        {
          expirationTtl: RATE_LIMIT_WINDOW_SECONDS + 10,
        }
      );
    } catch (error) {
      console.error('KV write failed:', error.message);
    }

    return {
      limited: entry.count > RATE_LIMIT_MAX,
      retryAfter: Math.max(1, entry.resetAt - now),
    };
  }

  // ── In-memory fallback ────────────────────────────────────

  let entry = memoryRateLimit.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + RATE_LIMIT_WINDOW_SECONDS,
    };
  }

  entry.count += 1;

  memoryRateLimit.set(key, entry);

  // Periodic cleanup
  if (memoryRateLimit.size > 5000) {
    for (const [storedKey, storedEntry] of memoryRateLimit.entries()) {
      if (now >= storedEntry.resetAt) {
        memoryRateLimit.delete(storedKey);
      }
    }
  }

  return {
    limited: entry.count > RATE_LIMIT_MAX,
    retryAfter: Math.max(1, entry.resetAt - now),
  };
}


// ─────────────────────────────────────────────────────────────
// REQUEST BODY
// ─────────────────────────────────────────────────────────────

async function readJsonBody(request) {
  const contentLength = request.headers.get('Content-Length');

  if (contentLength) {
    const length = Number(contentLength);

    if (
      Number.isFinite(length) &&
      length > MAX_BODY_BYTES
    ) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
  }

  const text = await request.text();

  const byteLength = new TextEncoder().encode(text).length;

  if (byteLength > MAX_BODY_BYTES) {
    throw new Error('PAYLOAD_TOO_LARGE');
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('INVALID_JSON');
  }
}


// ─────────────────────────────────────────────────────────────
// OAUTH EXCHANGE
// ─────────────────────────────────────────────────────────────

async function exchangeGitHubCode(payload, env) {

  if (!env.CLIENT_SECRET) {
    console.error(
      'DemonZ Deployer Worker: CLIENT_SECRET is missing.'
    );

    throw new Error('SERVER_MISCONFIGURED');
  }

  // Validate client ID
  if (
    typeof payload.client_id !== 'string' ||
    payload.client_id !== EXPECTED_CLIENT_ID
  ) {
    throw new Error('INVALID_CLIENT_ID');
  }

  // Validate OAuth code
  if (
    typeof payload.code !== 'string' ||
    payload.code.length === 0 ||
    payload.code.length > 512
  ) {
    throw new Error('INVALID_CODE');
  }

  // Exchange the temporary OAuth code with GitHub.
  const githubResponse = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',

      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'DemonZ-Deployer/3.1.0',
      },

      body: JSON.stringify({
        client_id: EXPECTED_CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        code: payload.code,
      }),
    }
  );

  const responseText = await githubResponse.text();

  let githubData;

  try {
    githubData = JSON.parse(responseText);
  } catch {
    console.error(
      'GitHub returned non-JSON response:',
      responseText.slice(0, 500)
    );

    throw new Error('GITHUB_INVALID_RESPONSE');
  }

  if (!githubResponse.ok) {
    console.error(
      'GitHub OAuth HTTP error:',
      githubResponse.status
    );

    return {
      ok: false,
      status: githubResponse.status,
      data: githubData,
    };
  }

  if (githubData.error) {
    return {
      ok: false,
      status: 400,
      data: githubData,
    };
  }

  if (!githubData.access_token) {
    console.error(
      'GitHub OAuth response contained no access token.'
    );

    throw new Error('NO_ACCESS_TOKEN');
  }

  return {
    ok: true,
    status: 200,
    data: githubData,
  };
}


// ─────────────────────────────────────────────────────────────
// MAIN REQUEST HANDLER
// ─────────────────────────────────────────────────────────────

async function handleRequest(request, env) {

  const url = new URL(request.url);

  const origin = getAllowedOrigin(request);

  // ── CORS preflight ──────────────────────────────────────────

  if (request.method === 'OPTIONS') {

    if (!origin) {
      return new Response(null, {
        status: 403,
      });
    }

    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }


  // ── Origin protection ──────────────────────────────────────

  if (!origin) {
    return jsonResponse(
      {
        error: 'Forbidden',
      },
      403
    );
  }


  // ── Endpoint protection ────────────────────────────────────

  if (url.pathname !== EXCHANGE_PATH) {
    return jsonResponse(
      {
        error: 'Not found',
      },
      404,
      origin
    );
  }


  // ── Method protection ──────────────────────────────────────

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        error: 'Method not allowed',
      },
      405,
      origin,
      {
        'Allow': 'POST, OPTIONS',
      }
    );
  }


  // ── Rate limiting ──────────────────────────────────────────

  const ip =
    request.headers.get('CF-Connecting-IP') ||
    'unknown';

  const rateLimit = await checkRateLimit(ip, env);

  if (rateLimit.limited) {
    return jsonResponse(
      {
        error: 'Too many requests. Please wait and try again.',
      },
      429,
      origin,
      {
        'Retry-After': String(rateLimit.retryAfter),
      }
    );
  }


  // ── Parse request ──────────────────────────────────────────

  let payload;

  try {
    payload = await readJsonBody(request);
  } catch (error) {

    if (error.message === 'PAYLOAD_TOO_LARGE') {
      return jsonResponse(
        {
          error: 'Payload too large.',
        },
        413,
        origin
      );
    }

    return jsonResponse(
      {
        error: 'Invalid JSON body.',
      },
      400,
      origin
    );
  }


  // ── Validate payload ───────────────────────────────────────

  if (!payload || typeof payload !== 'object') {
    return jsonResponse(
      {
        error: 'Invalid request body.',
      },
      400,
      origin
    );
  }


  if (
    typeof payload.client_id !== 'string' ||
    payload.client_id !== EXPECTED_CLIENT_ID
  ) {
    return jsonResponse(
      {
        error: 'Invalid client_id.',
      },
      400,
      origin
    );
  }


  if (
    typeof payload.code !== 'string' ||
    payload.code.length === 0 ||
    payload.code.length > 512
  ) {
    return jsonResponse(
      {
        error: 'Missing or invalid OAuth code.',
      },
      400,
      origin
    );
  }


  // ── Exchange code with GitHub ──────────────────────────────

  try {

    const result = await exchangeGitHubCode(
      payload,
      env
    );


    if (!result.ok) {

      return jsonResponse(
        result.data,
        result.status,
        origin
      );
    }


    return jsonResponse(
      result.data,
      200,
      origin,
      {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      }
    );

  } catch (error) {

    console.error(
      'DemonZ Deployer OAuth exchange error:',
      error.message
    );


    switch (error.message) {

      case 'SERVER_MISCONFIGURED':
        return jsonResponse(
          {
            error:
              'Worker configuration error. CLIENT_SECRET is not configured.',
          },
          500,
          origin
        );


      case 'INVALID_CLIENT_ID':
        return jsonResponse(
          {
            error: 'Invalid OAuth client ID.',
          },
          400,
          origin
        );


      case 'INVALID_CODE':
        return jsonResponse(
          {
            error: 'Invalid OAuth authorization code.',
          },
          400,
          origin
        );


      case 'GITHUB_INVALID_RESPONSE':
        return jsonResponse(
          {
            error:
              'GitHub returned an invalid OAuth response.',
          },
          502,
          origin
        );


      case 'NO_ACCESS_TOKEN':
        return jsonResponse(
          {
            error:
              'GitHub did not return an access token.',
          },
          502,
          origin
        );


      default:
        return jsonResponse(
          {
            error:
              'Unable to complete GitHub OAuth exchange.',
          },
          502,
          origin
        );
    }
  }
}


// ─────────────────────────────────────────────────────────────
// CLOUDFLARE WORKER ENTRY POINT
// ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
