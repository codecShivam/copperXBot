import Pusher from 'pusher-js';
import { Telegraf } from 'telegraf';
import { BotContext } from '../types';
import { notificationsApi } from '../api';
import config from '../config';

// Global bot instance reference
let globalBot: Telegraf<BotContext> | null = null;

/**
 * Set the global bot instance
 * @param bot Telegraf bot instance
 */
export const setGlobalBot = (bot: Telegraf<BotContext>): void => {
  globalBot = bot;
};

/**
 * Initialize Pusher client for a user
 * @param bot Telegraf bot instance
 * @param chatId Chat ID to send notifications to
 * @param token User's authentication token
 * @param organizationId User's organization ID
 */
export const initializePusher = (
  bot: Telegraf<BotContext> | null,
  chatId: number,
  token: string,
  organizationId: string,
): Pusher => {
  // Use the provided bot or fall back to global bot
  const telegramBot = bot || globalBot;

  // If no bot is available, log error and return a disconnected Pusher instance
  if (!telegramBot) {
    console.error('No bot instance available for notifications');
    const dummyPusher = new Pusher(config.pusher.key, {
      cluster: config.pusher.cluster,
    });
    dummyPusher.disconnect();
    return dummyPusher;
  }

  // Initialize Pusher client with authentication
  const pusherClient = new Pusher(config.pusher.key, {
    cluster: config.pusher.cluster,
    authorizer: (channel) => ({
      authorize: async (socketId, callback) => {
        try {
          const response = await notificationsApi.authenticatePusher(
            token,
            socketId,
            channel.name,
          );

          if (response && response.auth) {
            callback(null, {
              auth: response.auth,
              channel_data: response.channel_data,
            });
          } else {
            console.error('Invalid Pusher authentication response:', response);
            callback(
              new Error('Pusher authentication failed: Invalid response'),
              null,
            );
          }
        } catch (error) {
          console.error('Pusher authorization error:', error);
          callback(
            error instanceof Error ? error : new Error('Unknown error'),
            null,
          );
        }
      },
    }),
  });

  // Subscribe to organization's private channel
  const channelName = `private-org-${organizationId}`;
  const channel = pusherClient.subscribe(channelName);

  // Log subscription status
  channel.bind('pusher:subscription_succeeded', () => {
    console.log(`Successfully subscribed to channel: ${channelName}`);

    // Notify user
    try {
      telegramBot.telegram
        .sendMessage(
          chatId,
          '🔔 *Notifications Enabled*\n\nYou will now receive real-time notifications for deposits and other events.',
          {
            parse_mode: 'Markdown',
          },
        )
        .catch((err) =>
          console.error('Error sending notification success message:', err),
        );
    } catch (error) {
      console.error('Error sending notification success message:', error);
    }
  });

  channel.bind('pusher:subscription_error', (error: any) => {
    console.error('Subscription error:', error);

    // Notify user
    try {
      telegramBot.telegram
        .sendMessage(
          chatId,
          '⚠️ Failed to enable notifications. You may not receive real-time updates.',
        )
        .catch((err) =>
          console.error('Error sending notification error message:', err),
        );
    } catch (error) {
      console.error('Error sending notification error message:', error);
    }
  });

  // Bind to the deposit event
  channel.bind('deposit', (data: any) => {
    try {
      telegramBot.telegram
        .sendMessage(
          chatId,
          `💰 *New Deposit Received*\n\n${data.amount} ${data.token} deposited on ${data.network}`,
          {
            parse_mode: 'Markdown',
          },
        )
        .catch((err) =>
          console.error('Error sending deposit notification:', err),
        );
    } catch (error) {
      console.error('Error sending deposit notification:', error);
    }
  });

  return pusherClient;
};

/**
 * Store Pusher client for a user
 */
const pusherClients: Record<number, Pusher> = {};

/**
 * Set up notifications for a user
 * @param bot Telegraf bot instance (can be null)
 * @param chatId Chat ID to send notifications to
 * @param token User's authentication token
 * @param organizationId User's organization ID
 */
export const setupNotifications = (
  bot: Telegraf<BotContext> | null,
  chatId: number,
  token: string,
  organizationId: string,
): void => {
  try {
    // Clean up existing client if any
    if (pusherClients[chatId]) {
      pusherClients[chatId].disconnect();
      delete pusherClients[chatId];
    }

    // Initialize new client with the provided bot or global bot
    pusherClients[chatId] = initializePusher(
      bot,
      chatId,
      token,
      organizationId,
    );
  } catch (error) {
    console.error('Error setting up notifications:', error);
  }
};

/**
 * Clean up notifications for a user
 * @param chatId Chat ID to clean up
 */
export const cleanupNotifications = (chatId: number): void => {
  if (pusherClients[chatId]) {
    pusherClients[chatId].disconnect();
    delete pusherClients[chatId];
  }
};
