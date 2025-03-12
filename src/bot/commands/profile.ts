import { Composer } from 'telegraf';
import { authMiddleware } from '../middleware/auth';
import { backButtonKeyboard } from '../keyboards';
import { getSession } from '../../utils/session';

// Profile command handler
const profileCommand = Composer.command('profile', authMiddleware(), async (ctx) => {
  await fetchAndDisplayProfile(ctx);
});

// Profile action handler
const profileAction = Composer.action('profile', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await fetchAndDisplayProfile(ctx);
});

// Helper function to fetch and display profile
async function fetchAndDisplayProfile(ctx) {
  try {
    const session = getSession(ctx);
    
    // In a real implementation, this would fetch user profile from the API
    // For this demo, we'll use session data
    
    await ctx.reply(
      `👤 *Your Profile*\n\n` +
        `*Email:* ${session.email}\n` +
        `*User ID:* ${session.userId}\n` +
        `*Organization ID:* ${session.organizationId}\n`,
      {
        parse_mode: 'Markdown',
      },
    );
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  } catch (error) {
    console.error('Error fetching profile:', error);
    await ctx.reply(
      `❌ Failed to fetch profile: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  }
}

export default Composer.compose([profileCommand, profileAction]); 