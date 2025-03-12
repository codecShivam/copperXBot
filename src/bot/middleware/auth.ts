import { MiddlewareFn } from 'telegraf';
import { isAuthenticated } from '../../utils/session';

/**
 * Authentication middleware
 * Checks if the user is authenticated before proceeding
 * Redirects to login if not authenticated
 */
export const authMiddleware = () => async (
  ctx,
  next,
): Promise<void> => {
  if (!isAuthenticated(ctx)) {
    await ctx.reply(
      '⚠️ You need to be logged in to use this command.\n\nPlease use /login to authenticate with your Copperx account.',
    );
    return;
  }
  
  return next();
}; 