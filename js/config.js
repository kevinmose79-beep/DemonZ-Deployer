/**
 * DemonZ Deployer — Configuration
 * v3.1.0
 *
 * IMPORTANT:
 * - CLIENT_ID must match the GitHub OAuth App exactly.
 * - CLIENT_SECRET must NEVER be placed in this file.
 * - The OAuth token exchange is handled by the Cloudflare Worker.
 */

const CONFIG = Object.freeze({

  // ─────────────────────────────────────────────────────────
  // APPLICATION
  // ─────────────────────────────────────────────────────────

  VERSION: '3.1.0',

  // ─────────────────────────────────────────────────────────
  // GITHUB OAUTH
  // ─────────────────────────────────────────────────────────

  CLIENT_ID: 'Ov23lihwttlD8fFramM9',

  REDIRECT_URI:
    'https://kevinmose79-beep.github.io/DemonZ-Deployer/',

  SCOPES:
    'repo,workflow',

  // ─────────────────────────────────────────────────────────
  // CLOUDFLARE WORKER
  // ─────────────────────────────────────────────────────────

  PROXY_URL:
    'https://demonzdeployer.kevinmose79.workers.dev',

  // ─────────────────────────────────────────────────────────
  // DEPLOYER REPOSITORY
  // ─────────────────────────────────────────────────────────

  DEPLOYER_REPO:
    'DemonZDevelopment/DemonZ-Deployer',

  WORKFLOW_PATH:
    '.github/workflows/deployer-pipeline.yml',

  // ─────────────────────────────────────────────────────────
  // PIPELINE VERSION
  // ─────────────────────────────────────────────────────────

  PIPELINE_VERSION:
    '3.1.0',

  PIPELINE_VERSION_TAG:
    'DZ_PIPELINE_VERSION',

  // ─────────────────────────────────────────────────────────
  // DEFAULTS
  // ─────────────────────────────────────────────────────────

  DEFAULT_COMMIT_MSG:
    'build(sync): update workspace via DemonZ Deployer',

  MAX_HISTORY_ENTRIES:
    50,

  ACTIONS_POLL_INTERVAL:
    5000,

  ACTIONS_POLL_TIMEOUT:
    300000

});
