/**
 * DemonZ Deployer — Configuration
 * v3.0.2
 */

const CONFIG = Object.freeze({

  // ─────────────────────────────────────────────
  // APPLICATION
  // ─────────────────────────────────────────────

  VERSION: '3.0.2',

  APP_URL:
    'https://kevinmose79-beep.github.io/DemonZ-Deployer/',


  // ─────────────────────────────────────────────
  // GITHUB OAUTH
  // ─────────────────────────────────────────────

  CLIENT_ID:
    'Ov23lihwttlD8fFramM9',

  PROXY_URL:
    'https://demonzdeployer.demonzdevelopment.workers.dev',

  OAUTH_AUTHORIZE_URL:
    'https://github.com/login/oauth/authorize',

  OAUTH_EXCHANGE_PATH:
    '/exchange',

  SCOPES:
    'repo,workflow',


  // ─────────────────────────────────────────────
  // DEPLOYER REPOSITORY
  // ─────────────────────────────────────────────

  DEPLOYER_REPO:
    'DemonZDevelopment/DemonZ-Deployer',

  WORKFLOW_PATH:
    '.github/workflows/deployer-pipeline.yml',


  // ─────────────────────────────────────────────
  // PIPELINE VERSION
  // ─────────────────────────────────────────────

  PIPELINE_VERSION:
    '3.0.2',

  PIPELINE_VERSION_TAG:
    'DZ_PIPELINE_VERSION',


  // ─────────────────────────────────────────────
  // DEPLOYMENT DEFAULTS
  // ─────────────────────────────────────────────

  DEFAULT_COMMIT_MSG:
    'build(sync): update workspace via DemonZ Deployer',

  MAX_HISTORY_ENTRIES:
    50,

  ACTIONS_POLL_INTERVAL:
    5000,

  ACTIONS_POLL_TIMEOUT:
    300000,


  // ─────────────────────────────────────────────
  // LOCAL STORAGE
  // ─────────────────────────────────────────────

  STORAGE_KEYS: Object.freeze({

    TOKEN:
      'dz_token',

    USER:
      'dz_user',

    OAUTH_STATE:
      'dz_oauth_state',

    HISTORY:
      'dz_deployment_history',

    SOUND:
      'dz_sound_enabled'

  })

});
