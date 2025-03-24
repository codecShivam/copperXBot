import { Composer } from 'telegraf';
import { mainMenuKeyboard } from '../keyboards';
import {
  formatHeader,
  formatSubheader,
  ICON,
  SECTION,
  DIVIDERS,
} from '../../constants';

const startCommand = Composer.command('start', async (ctx) => {
  const username = ctx.from?.first_name || 'there';

  await ctx.reply(
    `${formatHeader('Welcome to Copperx')} 🚀\n\n` +
      `${ICON.welcome} Hello ${username}! I'm your personal Copperx assistant for managing USDC transactions directly from Telegram.\n` +
      DIVIDERS.section +
      `${formatSubheader('What can I do?')}\n` +
      `${SECTION.item}${ICON.balance} Check your wallet balances\n` +
      `${SECTION.item}${ICON.email} Send funds to email addresses\n` +
      `${SECTION.item}${ICON.wallet} Send funds to external wallets\n` +
      `${SECTION.item}${ICON.bank} Withdraw to bank accounts\n` +
      `${SECTION.item}${ICON.history} View your transaction history\n` +
      DIVIDERS.section +
      `To get started, please use the /login command to authenticate with your Copperx account.\n\n` +
      `If you need help at any time, just type /help.`,
    {
      parse_mode: 'Markdown',
    },
  );

  // Send the main menu keyboard
  await ctx.reply(
    `${ICON.settings} Please select an option:`,
    mainMenuKeyboard(),
  );
});

export default startCommand;
