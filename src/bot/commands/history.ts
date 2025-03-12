import { Composer } from 'telegraf';
import { transfersApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { backButtonKeyboard } from '../keyboards';
import { formatAmount } from '../../utils/format';
import { getSession } from '../../utils/session';

// History command handler
const historyCommand = Composer.command('history', authMiddleware(), async (ctx) => {
  await fetchAndDisplayHistory(ctx);
});

// History action handler
const historyAction = Composer.action('history', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await fetchAndDisplayHistory(ctx);
});

// Helper function to fetch and display transaction history
async function fetchAndDisplayHistory(ctx) {
  try {
    await ctx.reply('🔄 Fetching your transaction history...');
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Fetch transaction history
    const historyResponse = await transfersApi.getTransferHistory(token);
    
    // Check if the response has the expected format
    let transfers = [];
    if (historyResponse.data && Array.isArray(historyResponse.data)) {
      // Direct array of transfers
      transfers = historyResponse.data;
    } else if (historyResponse.data && historyResponse.data.items && Array.isArray(historyResponse.data.items)) {
      // Paginated response format
      transfers = historyResponse.data.items;
    }
    
    if (!transfers || transfers.length === 0) {
      await ctx.reply(
        '📜 *No transactions found*\n\nYou don\'t have any transactions yet.',
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }
    
    // Format and display transaction history
    let message = '📜 *Your Transaction History*\n\n';
    
    // Sort transfers by date (newest first)
    const sortedTransfers = [...transfers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    
    // Display the 10 most recent transfers
    const recentTransfers = sortedTransfers.slice(0, 10);
    
    recentTransfers.forEach((transfer, index) => {
      const date = new Date(transfer.createdAt).toLocaleDateString();
      const amount = formatAmount(transfer.amount);
      const status = transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1);
      const type = transfer.type.charAt(0).toUpperCase() + transfer.type.slice(1);
      
      message += `*${index + 1}. ${type} - ${date}*\n`;
      message += `Amount: ${amount} ${transfer.token}\n`;
      message += `Network: ${transfer.network}\n`;
      message += `Status: ${status}\n`;
      
      if (transfer.type === 'email' && transfer.receiver) {
        message += `To: ${transfer.receiver.email}\n`;
      } else if (transfer.type === 'wallet' && transfer.receiver) {
        message += `To: ${transfer.receiver.address}\n`;
      } else if (transfer.type === 'bank' && transfer.bankAccount) {
        message += `To: ${transfer.bankAccount.name}\n`;
      }
      
      message += '\n';
    });
    
    if (transfers.length > 10) {
      message += `_Showing 10 most recent out of ${transfers.length} transactions._`;
    }
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    await ctx.reply(
      `❌ Failed to fetch transaction history: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  }
}

export default Composer.compose([historyCommand, historyAction]); 