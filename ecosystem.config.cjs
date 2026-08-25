module.exports = {
  apps: [
    {
      name: 'daddyai',
      script: '.output/server/index.mjs',
      cwd: '/var/www/daddyai',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // PostgreSQL (self-hosted)
        PGHOST: 'localhost',
        PGPORT: '5432',
        PGDATABASE: 'daddyai',
        PGUSER: 'daddyai',
        PGPASSWORD: 'daddyai_2026_secure',
        // JWT Auth
        JWT_SECRET: 'daddyai_jwt_secret_2026_change_me_in_production_xk9m2p',
        // App
        SITE_URL: 'https://daddyai.online',
        VITE_SITE_URL: 'https://daddyai.online',
        APP_NAME: 'Daddy AI',
        APP_DOMAIN: 'daddyai.online',
        // Sync credentials
        SYNC_TOKEN: 'f5e1f9b68be9fc8d69867283a6ebdf61755f23e93ff0c014def36f555d7fb42f',
        SYNC_SECRET: 'c05d89defdc77a396b6543c85bce957bb5a12394a0828c54825817d51b3cd58a',
        CRON_SECRET: 'daddyai_cron_2026_secret',
        WEBHOOK_SECRET: 'daddyai_webhook_2026_secret',
        // AI Provider (MiMo)
        MIMO_API_KEY: 'sk-s5he51jfvwcp0lgumatyt6mdlrd13oygx9dh3jqpzkrmvspa',
        // Meta (Facebook) Platform Credentials
        META_APP_ID: '',
        META_APP_SECRET: '',
        META_ACCESS_TOKEN: '',
        META_PAGE_ID: '',
        META_WHATSAPP_BUSINESS_ACCOUNT_ID: '',
        META_WEBHOOK_VERIFY_TOKEN: '',
        META_API_VERSION: 'v19.0',
      },
      max_memory_restart: '500M',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
