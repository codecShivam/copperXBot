import { Context, MiddlewareFn } from 'telegraf';
import { loadSession, saveSession } from './sessionStore';
import { SessionData } from '../types';

/**
 * Telegraf middleware to handle Redis-backed sessions
 * @returns Middleware function
 */
export default function redisSession(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    // Skip if no from user (service messages, etc)
    if (!ctx.from?.id) {
      return next();
    }

    // User ID from Telegram
    const userId = ctx.from.id;

    try {
      // Load session from Redis
      const sessionData = await loadSession(userId);

      // Attach session to context
      Object.defineProperty(ctx, 'session', {
        get: function () {
          return sessionData;
        },
        set: function (newValue) {
          // This won't ever be called directly, but we include it for completeness
          Object.assign(sessionData, newValue);
        },
      });

      // Call the next middleware in the chain
      await next();

      // Save session back to Redis after middleware chain completes
      await saveSession(userId, sessionData);
    } catch (error) {
      console.error(`Session error for user ${userId}:`, error);

      // Create an empty session as fallback
      const emptySession: SessionData = { authenticated: false };

      // Attach fallback session to context
      Object.defineProperty(ctx, 'session', {
        get: function () {
          return emptySession;
        },
        set: function (newValue) {
          Object.assign(emptySession, newValue);
        },
      });

      // Continue with the empty session
      await next();
    }
  };
}
