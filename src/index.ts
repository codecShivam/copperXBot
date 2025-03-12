import { Telegraf, session } from 'telegraf';
import { BotContext, SessionData } from './types';
import config from './config';
import startCommand from './bot/commands/start';
import helpCommand from './bot/commands/help';
import loginCommand from './bot/commands/login';
import logoutCommand from './bot/commands/logout';
import balanceCommand from './bot/commands/balance';
import profileCommand from './bot/commands/profile';
import historyCommand from './bot/commands/history';
import sendCommand from './bot/commands/send';
import withdrawCommand from './bot/commands/withdraw';
import { mainMenuKeyboard } from './bot/keyboards';
import { checkRunningBot, registerBotProcess, setupGracefulShutdown } from './utils/lifecycle';
import { setGlobalBot } from './services/notifications';

// Check if another bot instance is already running
const runningPid = checkRunningBot();
if (runningPid) {
  console.error(`❌ Another bot instance is already running with PID: ${runningPid}`);
  console.error('Please stop that instance before starting a new one, or use "npm run clean-start"');
  process.exit(1);
}

// Initialize the bot
const bot = new Telegraf<BotContext>(config.bot.token, {
  telegram: {
    // Add some retries for API requests
    apiRoot: 'https://api.telegram.org',
  },
  handlerTimeout: 90000, // 90 seconds timeout for long-running handlers
});

// Set the global bot instance for notifications
setGlobalBot(bot);

// Set up session middleware
bot.use(session({
  defaultSession: () => ({ authenticated: false }),
}));

// Export the bot instance for other modules
export { bot };

// Register commands
bot.use(startCommand);
bot.use(helpCommand);
bot.use(loginCommand);
bot.use(logoutCommand);
bot.use(balanceCommand);
bot.use(profileCommand);
bot.use(historyCommand);
bot.use(sendCommand);
bot.use(withdrawCommand);

// Handle callback queries
bot.action('main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Main Menu:', {
    reply_markup: {
      remove_keyboard: true,
    },
  });
  await ctx.reply('Please select an option:', mainMenuKeyboard());
});

// Handle help action
bot.action('help', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    `*📚 Copperx Payout Bot Help*\n\n` +
      `Here are the commands you can use:\n\n` +
      `/start - Start the bot and show the main menu\n` +
      `/login - Authenticate with your Copperx account\n` +
      `/balance - Check your wallet balances\n` +
      `/send - Send funds to an email or wallet\n` +
      `/withdraw - Withdraw funds to a bank account\n` +
      `/history - View your transaction history\n` +
      `/profile - View your account profile\n` +
      `/help - Show this help message\n` +
      `/logout - Log out from your account\n\n` +
      `*Need more help?*\n` +
      `Contact Copperx support: [Telegram Support](https://t.me/copperxcommunity/2183)`,
    {
      parse_mode: 'Markdown',
    },
  );
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('An error occurred while processing your request. Please try again later.');
});

// Start the bot
const startBot = async () => {
  try {
    console.log('Starting bot...');
    
    // Register the bot process
    registerBotProcess();
    
    // Setup graceful shutdown
    setupGracefulShutdown(bot);
    
    await bot.launch();
    console.log('Bot started successfully!');
  } catch (error) {
    console.error('Error starting bot:', error);
    
    // Ensure we try to stop the bot if it's running
    try {
      bot.stop('ERROR');
    } catch (stopError) {
      console.error('Error stopping bot:', stopError);
    }
    
    // Give time for connections to close properly
    console.log('Exiting in 2 seconds...');
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  }
};

startBot(); 