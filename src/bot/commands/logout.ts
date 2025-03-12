import { Composer } from 'telegraf';
import { clearSession, getSession } from '../../utils/session';
import { cleanupNotifications } from '../../services/notifications';

// Logout command handler
const logoutCommand = Composer.command('logout', async (ctx) => {
  const session = getSession(ctx);
  
  // Check if authenticated
  if (!session.authenticated) {
    await ctx.reply('❌ You are not logged in.');
    return;
  }
  
  // Clean up notifications
  if (ctx.chat && ctx.chat.id) {
    cleanupNotifications(ctx.chat.id);
  }
  
  // Clear session
  clearSession(ctx);
  
  // Send confirmation
  await ctx.reply(
    '✅ You have been successfully logged out.\n\nUse /login to authenticate again.',
  );
});

export default logoutCommand; 