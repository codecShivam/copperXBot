module.exports = {
  apps: [
    {
      name: 'copperx-bot',
      script: './dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: 'YOUR_SECURE_PASSWORD_HERE',
        REDIS_DB: 0,
        SESSION_SECRET: 'GENERATE_A_SECURE_RANDOM_SECRET_HERE',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
    },
  ],
}; 