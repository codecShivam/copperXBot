import { Composer } from 'telegraf';
import { getSession } from '../../utils/session';
import { backButtonKeyboard } from '../keyboards';

// Help command handler
const helpCommand = Composer.command('help', async (ctx) => {
  await ctx.reply(
    `*📚 Copperx Payout Bot Help*\n\n` +
      `Here are the commands you can use:\n\n` +
      `/start - Start the bot and show the main menu\n` +
      `/login - Authenticate with your Copperx account\n` +
      `/balance - Check your wallet balances\n` +
      `/send - Send funds to an email, wallet, or multiple recipients\n` +
      `/withdraw - Withdraw funds to a bank account\n` +
      `/history - View your transaction history\n` +
      `/profile - View your account profile\n` +
      `/help - Show this help message\n` +
      `/logout - Log out from your account\n\n` +
      `*Need more help?*\n` +
      `Contact Copperx support: [Telegram Support](https://t.me/copperxcommunity/2183)`,
    {
      parse_mode: 'Markdown',
      reply_markup: backButtonKeyboard().reply_markup
    },
  );
});

export default helpCommand; 