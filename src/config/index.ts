import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configuration object
const config = {
  // Bot configuration
  bot: {
    token: process.env.BOT_TOKEN || '',
  },

  // API configuration
  api: {
    baseURL: process.env.API_BASE_URL || 'https://income-api.copperx.io/api',
  },

  // Pusher configuration
  pusher: {
    appId: process.env.PUSHER_APP_ID || '',
    key: process.env.PUSHER_KEY || '',
    secret: process.env.PUSHER_SECRET || '',
    cluster: process.env.PUSHER_CLUSTER || 'eu',
  },

  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    expiry: parseInt(process.env.SESSION_EXPIRY || '86400', 10),
  },
};

// Validate required configuration
if (!config.bot.token) {
  console.error('Error: BOT_TOKEN is required');
  process.exit(1);
}

export default config;
