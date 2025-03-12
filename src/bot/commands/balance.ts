import { Composer } from 'telegraf';
import { walletApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { backButtonKeyboard } from '../keyboards';
import { formatAmount } from '../../utils/format';
import { getSession } from '../../utils/session';

// Balance command handler
const balanceCommand = Composer.command('balance', authMiddleware(), async (ctx) => {
  await fetchAndDisplayBalances(ctx);
});

// Balance action handler
const balanceAction = Composer.action('balance', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await fetchAndDisplayBalances(ctx);
});

// Helper function to fetch and display balances
async function fetchAndDisplayBalances(ctx) {
  try {
    await ctx.reply('🔄 Fetching your wallet balances...');
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Fetch balances
    const balancesResponse = await walletApi.getBalances(token);
    const balances = balancesResponse.data;
    
    if (!balances || balances.length === 0) {
      await ctx.reply(
        '💰 *No balances found*\n\nYou don\'t have any tokens in your wallets yet.',
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }
    
    // Group balances by network
    const balancesByNetwork: Record<string, typeof balances> = {};
    
    balances.forEach((balance) => {
      if (!balancesByNetwork[balance.network]) {
        balancesByNetwork[balance.network] = [];
      }
      
      balancesByNetwork[balance.network].push(balance);
    });
    
    // Format and display balances
    let message = '💰 *Your Wallet Balances*\n\n';
    
    Object.entries(balancesByNetwork).forEach(([network, networkBalances]) => {
      message += `*${network.toUpperCase()}*\n`;
      
      networkBalances.forEach((balance) => {
        const formattedBalance = formatAmount(balance.balance);
        message += `${balance.token}: ${formattedBalance}\n`;
      });
      
      message += '\n';
    });
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  } catch (error) {
    console.error('Error fetching balances:', error);
    await ctx.reply(
      `❌ Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  }
}

export default Composer.compose([balanceCommand, balanceAction]); 