module.exports = {
  apps: [
    {
      name: 'daddyai',
      script: 'node_modules/.bin/vinxi-start',
      args: 'start',
      cwd: '/var/www/daddyai',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
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
