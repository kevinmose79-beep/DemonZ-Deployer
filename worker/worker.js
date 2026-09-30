/**
 * DemonZ Deployer — Cloudflare Worker
 * v3.1.0
 *
 * GitHub OAuth secure token exchange.
 *
 * IMPORTANT:
 * CLIENT_SECRET must be configured in Cloudflare:
 *
 * Worker
 * → Settings
 * → Variables and Secrets
 * → Add Secret
 *
 * Name:
 * CLIENT_SECRET
 *
 * Never place the secret in this code.
 */

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const CLIENT_ID =
  'Ov23lihwttlD8fFramM9';


const ALLOWED_ORIGINS = new Set([

  'https://kevinmose79-beep.github.io',

  'http://localhost',

  'http://127.0.0.1'

]);


const EXCHANGE_PATH =
  '/exchange';


const MAX_BODY_BYTES =
  2048;


// ─────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────

function getOrigin(request) {

  const origin =
    request.headers.get('Origin');

  if (
    !origin ||
    !ALLOWED_ORIGINS.has(origin)
  ) {

    return null;
  }

  return origin;
}


function corsHeaders(origin) {

  const headers = {
    'Vary': 'Origin'
  };


  if (origin) {

    headers[
      'Access-Control-Allow-Origin'
    ] = origin;

    headers[
      'Access-Control-Allow-Methods'
    ] = 'POST, OPTIONS';

    headers[
      'Access-Control-Allow-Headers'
    ] = 'Content-Type';

    headers[
      'Access-Control-Max-Age'
    ] = '86400';
  }


  return headers;
}


// ─────────────────────────────────────────────────────────────
// JSON RESPONSE
// ─────────────────────────────────────────────────────────────

function json(data, status, origin = null) {

  return new Response(

    JSON.stringify(data),

    {
      status,

      headers: {

        'Content-Type':
          'application/json; charset=utf-8',

        ...corsHeaders(origin),

        'Cache-Control':
          'no-store',

        'Pragma':
          'no-cache'

      }
    }

  );
}


// ─────────────────────────────────────────────────────────────
// REQUEST BODY
// ─────────────────────────────────────────────────────────────

async function readBody(request) {

  const contentLength =
    request.headers.get(
      'Content-Length'
    );


  if (contentLength) {

    const length =
      Number(contentLength);

    if (
      Number.isFinite(length) &&
      length > MAX_BODY_BYTES
    ) {

      throw new Error(
        'PAYLOAD_TOO_LARGE'
      );
    }
  }


  const text =
    await request.text();


  const bytes =
    new TextEncoder()
      .encode(text)
      .length;


  if (bytes > MAX_BODY_BYTES) {

    throw new Error(
      'PAYLOAD_TOO_LARGE'
    );
  }


  try {

    return JSON.parse(text);

  } catch {

    throw new Error(
      'INVALID_JSON'
    );
  }
}


// ─────────────────────────────────────────────────────────────
// GITHUB TOKEN EXCHANGE
// ─────────────────────────────────────────────────────────────

async function exchangeCode(
  code,
  env
) {

  if (!env.CLIENT_SECRET) {

    console.error(
      'CLIENT_SECRET is not configured.'
    );

    throw new Error(
      'SERVER_MISCONFIGURED'
    );
  }


  const response =
    await fetch(
      'https://github.com/login/oauth/access_token',
      {

        method:
          'POST',

        headers: {

          'Accept':
            'application/json',

          'Content-Type':
            'application/json',

          'User-Agent':
            'DemonZ-Deployer/3.1.0'

        },

        body:
          JSON.stringify({

            client_id:
              CLIENT_ID,

            client_secret:
              env.CLIENT_SECRET,

            code

          })

      }
    );


  const text =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(text);

  } catch {

    console.error(
      'GitHub returned non-JSON OAuth response.'
    );

    throw new Error(
      'GITHUB_INVALID_RESPONSE'
    );
  }


  return {
    response,
    data
  };
}


// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

async function handleRequest(
  request,
  env
) {

  const url =
    new URL(request.url);


  const origin =
    getOrigin(request);


  // ─────────────────────────────────────────────────────────
  // PREFLIGHT
  // ─────────────────────────────────────────────────────────

  if (
    request.method === 'OPTIONS'
  ) {

    if (!origin) {

      return new Response(
        null,
        {
          status: 403
        }
      );
    }


    return new Response(
      null,
      {
        status: 204,
        headers:
          corsHeaders(origin)
      }
    );
  }


  // ─────────────────────────────────────────────────────────
  // ORIGIN CHECK
  // ─────────────────────────────────────────────────────────

  if (!origin) {

    return json(
      {
        error:
          'Forbidden origin.'
      },
      403
    );
  }


  // ─────────────────────────────────────────────────────────
  // PATH
  // ─────────────────────────────────────────────────────────

  if (
    url.pathname !== EXCHANGE_PATH
  ) {

    return json(
      {
        error:
          'Not found.'
      },
      404,
      origin
    );
  }


  // ─────────────────────────────────────────────────────────
  // METHOD
  // ─────────────────────────────────────────────────────────

  if (
    request.method !== 'POST'
  ) {

    return new Response(

      JSON.stringify({
        error:
          'Method not allowed.'
      }),

      {
        status: 405,

        headers: {

          'Content-Type':
            'application/json',

          'Allow':
            'POST, OPTIONS',

          ...corsHeaders(origin)

        }
      }

    );
  }


  // ─────────────────────────────────────────────────────────
  // BODY
  // ─────────────────────────────────────────────────────────

  let payload;

  try {

    payload =
      await readBody(request);

  } catch (error) {

    if (
      error.message ===
      'PAYLOAD_TOO_LARGE'
    ) {

      return json(
        {
          error:
            'Payload too large.'
        },
        413,
        origin
      );
    }


    return json(
      {
        error:
          'Invalid JSON body.'
      },
      400,
      origin
    );
  }


  // ─────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────

  if (
    !payload ||
    typeof payload !== 'object'
  ) {

    return json(
      {
        error:
          'Invalid request body.'
      },
      400,
      origin
    );
  }


  if (
    payload.client_id !== CLIENT_ID
  ) {

    return json(
      {
        error:
          'Invalid OAuth client ID.'
      },
      400,
      origin
    );
  }


  if (
    typeof payload.code !== 'string' ||
    payload.code.length < 1 ||
    payload.code.length > 512
  ) {

    return json(
      {
        error:
          'Missing or invalid OAuth code.'
      },
      400,
      origin
    );
  }


  // ─────────────────────────────────────────────────────────
  // TOKEN EXCHANGE
  // ─────────────────────────────────────────────────────────

  try {

    const result =
      await exchangeCode(
        payload.code,
        env
      );


    const githubData =
      result.data;


    if (
      githubData.error
    ) {

      console.error(
        'GitHub OAuth error:',
        githubData.error
      );


      return json(
        {
          error:
            githubData.error,

          error_description:
            githubData.error_description ||
            undefined
        },
        400,
        origin
      );
    }


    if (
      !githubData.access_token
    ) {

      console.error(
        'GitHub returned no access token.'
      );


      return json(
        {
          error:
            'GitHub did not return an access token.'
        },
        502,
        origin
      );
    }


    return json(
      githubData,
      200,
      origin
    );


  } catch (error) {

    console.error(
      'OAuth exchange failed:',
      error.message
    );


    if (
      error.message ===
      'SERVER_MISCONFIGURED'
    ) {

      return json(
        {
          error:
            'Worker configuration error: CLIENT_SECRET is not configured.'
        },
        500,
        origin
      );
    }


    if (
      error.message ===
      'GITHUB_INVALID_RESPONSE'
    ) {

      return json(
        {
          error:
            'GitHub returned an invalid response.'
        },
        502,
        origin
      );
    }


    return json(
      {
        error:
          'Unable to complete GitHub OAuth exchange.'
      },
      502,
      origin
    );
  }
}


// ─────────────────────────────────────────────────────────────
// CLOUDFLARE ENTRY POINT
// ─────────────────────────────────────────────────────────────

export default {

  async fetch(
    request,
    env
  ) {

    return handleRequest(
      request,
      env
    );

  }

};
