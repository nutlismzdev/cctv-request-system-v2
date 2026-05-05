/**
 * ecosystem.config.js — PM2 for Next.js (Windows / Production)
 *
 * Secrets live in .env.production (gitignored). PM2 preloads them via
 * `node -r dotenv/config` BEFORE Next.js starts, so process.env is fully
 * populated by the time auth/db/LINE modules are first evaluated.
 *
 * Fork mode (single instance) on Windows. We tried cluster mode but
 * `next start` + PM2 cluster on Windows has known port-binding issues
 * with Next.js 15 — workers crash on listen. Streaming uploads (busboy)
 * already eliminates the RAM/blocking problem that cluster mode was
 * intended to solve, so fork mode is sufficient here.
 */
const path = require('path')

const APP_DIR = 'C:\\E-services\\cctv-request-system-v2-master'

module.exports = {
  apps: [
    {
      name: 'cctv-request-system-v2-master',
      cwd: APP_DIR,

      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4000',

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,

      // -r dotenv/config: load .env.production into process.env before Next boots.
      // --max-old-space-size: give V8 enough heap for streaming + DB pool.
      node_args: '-r dotenv/config --max-old-space-size=4096',
      max_memory_restart: '3072M',

      env: {
        NODE_ENV: 'production',
        PORT: '4000',
        // Tell `dotenv/config` which file to read. Absolute path so it works
        // regardless of which dir PM2 happens to fork the worker from.
        DOTENV_CONFIG_PATH: path.join(APP_DIR, '.env.production'),
        // Force dotenv to overwrite values inherited from the PM2 daemon's env.
        // Without this, secrets cached in the daemon (from previous configs or
        // `pm2 set` calls) win over what's in .env.production.
        DOTENV_CONFIG_OVERRIDE: 'true',
      },

      time: true,
      error_file: path.join(APP_DIR, 'logs', 'cctv-next-error.log'),
      out_file:   path.join(APP_DIR, 'logs', 'cctv-next-out.log'),
      merge_logs: true,
    },
  ],
}
