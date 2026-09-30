/**
 * DemonZ Deployer — GitHub Authentication
 * v3.1.0
 *
 * GitHub OAuth 2.0 Authorization Code Flow.
 *
 * Flow:
 *
 * Browser
 *   ↓
 * GitHub authorization
 *   ↓
 * GitHub redirects back with ?code=&state=
 *   ↓
 * auth.js validates state
 *   ↓
 * Cloudflare Worker /exchange
 *   ↓
 * GitHub token exchange
 *   ↓
 * access_token returned
 *   ↓
 * localStorage session
 *
 * SECURITY:
 * - Client Secret is NEVER stored in browser code.
 * - Client Secret is NEVER sent from the browser.
 * - OAuth state is validated before exchange.
 */

const Auth = (() => {

  // ─────────────────────────────────────────────────────────
  // STORAGE KEYS
  // ─────────────────────────────────────────────────────────

  const STATE_KEY = 'dz_oauth_state';
  const TOKEN_KEY = 'dz_token';
  const USER_KEY = 'dz_user';


  // ─────────────────────────────────────────────────────────
  // RANDOM STATE
  // ─────────────────────────────────────────────────────────

  function generateState() {

    const bytes = new Uint8Array(32);

    crypto.getRandomValues(bytes);

    return Array.from(
      bytes,
      byte => byte.toString(16).padStart(2, '0')
    ).join('');
  }


  // ─────────────────────────────────────────────────────────
  // START GITHUB LOGIN
  // ─────────────────────────────────────────────────────────

  function startOAuthRedirect() {

    if (!window.crypto || !window.crypto.getRandomValues) {
      throw new Error(
        'Secure browser cryptography is unavailable.'
      );
    }

    const state = generateState();

    localStorage.setItem(
      STATE_KEY,
      state
    );

    const params = new URLSearchParams({

      client_id:
        CONFIG.CLIENT_ID,

      redirect_uri:
        CONFIG.REDIRECT_URI,

      scope:
        CONFIG.SCOPES,

      state,

      allow_signup:
        'true'

    });

    const authorizationUrl =
      'https://github.com/login/oauth/authorize?' +
      params.toString();

    window.location.assign(
      authorizationUrl
    );
  }


  // ─────────────────────────────────────────────────────────
  // HANDLE CALLBACK
  // ─────────────────────────────────────────────────────────

  async function handleOAuthCallback() {

    const url =
      new URL(window.location.href);

    const code =
      url.searchParams.get('code');

    const returnedState =
      url.searchParams.get('state');

    const oauthError =
      url.searchParams.get('error');

    const oauthErrorDescription =
      url.searchParams.get('error_description');


    // No OAuth callback present.
    if (!code && !oauthError) {
      return null;
    }


    // GitHub returned an OAuth error.
    if (oauthError) {

      cleanupOAuthUrl();

      throw new Error(
        oauthErrorDescription ||
        oauthError ||
        'GitHub authorization failed.'
      );
    }


    if (!code) {

      cleanupOAuthUrl();

      throw new Error(
        'GitHub did not return an authorization code.'
      );
    }


    // ───────────────────────────────────────────────────────
    // CSRF STATE CHECK
    // ───────────────────────────────────────────────────────

    const savedState =
      localStorage.getItem(STATE_KEY);

    localStorage.removeItem(
      STATE_KEY
    );

    if (
      !savedState ||
      !returnedState ||
      savedState !== returnedState
    ) {

      cleanupOAuthUrl();

      throw new Error(
        'OAuth state mismatch. Please try connecting again.'
      );
    }


    // ───────────────────────────────────────────────────────
    // EXCHANGE CODE
    // ───────────────────────────────────────────────────────

    const token =
      await exchangeCode(code);


    // ───────────────────────────────────────────────────────
    // GET GITHUB USER
    // ───────────────────────────────────────────────────────

    const user =
      await getGitHubUser(token);


    // ───────────────────────────────────────────────────────
    // SAVE SESSION
    // ───────────────────────────────────────────────────────

    saveSession(
      token,
      user
    );


    cleanupOAuthUrl();

    return {
      token,
      user
    };
  }


  // ─────────────────────────────────────────────────────────
  // EXCHANGE CODE THROUGH WORKER
  // ─────────────────────────────────────────────────────────

  async function exchangeCode(code) {

    if (!code) {
      throw new Error(
        'OAuth authorization code is missing.'
      );
    }

    let response;

    try {

      response = await fetch(
        `${CONFIG.PROXY_URL}/exchange`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'Accept':
              'application/json'
          },

          body: JSON.stringify({

            client_id:
              CONFIG.CLIENT_ID,

            code

          })
        }
      );

    } catch (error) {

      console.error(
        'DemonZ OAuth Worker request failed:',
        error
      );

      throw new Error(
        'Failed to connect to the authentication server. Check the Cloudflare Worker URL, deployment, and CORS configuration.'
      );
    }


    let data;

    try {

      data =
        await response.json();

    } catch {

      throw new Error(
        `Authentication server returned an invalid response (${response.status}).`
      );
    }


    if (!response.ok) {

      throw new Error(
        data?.error ||
        `Authentication server error (${response.status}).`
      );
    }


    if (data.error) {

      throw new Error(
        data.error_description ||
        data.error
      );
    }


    if (!data.access_token) {

      throw new Error(
        'Authentication succeeded but no GitHub access token was returned.'
      );
    }


    return data.access_token;
  }


  // ─────────────────────────────────────────────────────────
  // GET GITHUB USER
  // ─────────────────────────────────────────────────────────

  async function getGitHubUser(token) {

    const response =
      await fetch(
        'https://api.github.com/user',
        {
          headers: {
            Accept:
              'application/vnd.github+json',

            Authorization:
              `Bearer ${token}`,

            'X-GitHub-Api-Version':
              '2022-11-28'
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        `Unable to retrieve GitHub account information (${response.status}).`
      );
    }


    return response.json();
  }


  // ─────────────────────────────────────────────────────────
  // SESSION
  // ─────────────────────────────────────────────────────────

  function saveSession(
    token,
    user
  ) {

    localStorage.setItem(
      TOKEN_KEY,
      token
    );

    localStorage.setItem(
      USER_KEY,
      JSON.stringify(user)
    );
  }


  function loadSession() {

    const token =
      localStorage.getItem(
        TOKEN_KEY
      );

    const userString =
      localStorage.getItem(
        USER_KEY
      );


    if (!token || !userString) {
      return null;
    }


    try {

      const user =
        JSON.parse(userString);

      return {
        token,
        user
      };

    } catch {

      clearSession();

      return null;
    }
  }


  function clearSession() {

    localStorage.removeItem(
      TOKEN_KEY
    );

    localStorage.removeItem(
      USER_KEY
    );

    localStorage.removeItem(
      STATE_KEY
    );


    if (
      typeof API !== 'undefined' &&
      typeof API.clearToken === 'function'
    ) {

      API.clearToken();
    }
  }


  // ─────────────────────────────────────────────────────────
  // CLEAN OAUTH URL
  // ─────────────────────────────────────────────────────────

  function cleanupOAuthUrl() {

    const cleanUrl =
      window.location.origin +
      window.location.pathname;

    window.history.replaceState(
      {},
      document.title,
      cleanUrl
    );
  }


  // ─────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────

  return Object.freeze({

    startOAuthRedirect,

    handleOAuthCallback,

    exchangeCode,

    saveSession,

    loadSession,

    clearSession

  });

})();
