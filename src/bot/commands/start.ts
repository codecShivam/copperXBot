import { Composer } from 'telegraf';
import { getSession } from '../../utils/session';
import { mainMenuKeyboard } from '../keyboards';

// Start command handler
const startCommand = Composer.command('start', async (ctx) => {
  const username = ctx.from?.first_name || 'there';
  
  await ctx.reply(
    `👋 Hello ${username}! Welcome to the *Copperx Payout Bot* 🚀\n\n` +
      `I'm here to help you manage your USDC transactions directly from Telegram.\n\n` +
      `*What can I do?*\n` +
      `• Check your wallet balances\n` +
      `• Send funds to email addresses\n` +
      `• Send funds to external wallets\n` +
      `• Withdraw to bank accounts\n` +
      `• View your transaction history\n\n` +
      `To get started, please use the /login command to authenticate with your Copperx account.\n\n` +
      `If you need help at any time, just type /help.`,
    {
      parse_mode: 'Markdown',
    },
  );
  
  // Send the main menu keyboard
  await ctx.reply('Please select an option:', mainMenuKeyboard());
});

export default startCommand; 