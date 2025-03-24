import { Composer, Markup } from 'telegraf';
import { transfersApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { formatAmount } from '../../utils/format';
import { getSession } from '../../utils/session';
import config from '../../config';
import {
  ICON,
  SECTION,
  DIVIDERS,
  formatHeader,
  formatSubheader,
  formatSuccess,
  formatWarning,
  formatError,
  formatLoading,
} from '../../constants';

// Number of transactions to show per page
const ITEMS_PER_PAGE = 5;

// Status options mapping
const STATUS_OPTIONS = {
  all: { label: 'All', icon: ICON.history },
  success: { label: 'Success', icon: ICON.success },
  pending: { label: 'Pending', icon: ICON.loading },
  failed: { label: 'Failed', icon: ICON.error },
  processing: { label: 'Processing', icon: ICON.loading },
  canceled: { label: 'Canceled', icon: ICON.error },
  refunded: { label: 'Refunded', icon: ICON.warning },
};

// State tracking for user's current view (in memory)
const userViewState = new Map<
  string,
  {
    currentPage: number;
    currentStatus: string | undefined;
    totalItems: number;
    lastFetched: number;
  }
>();

// History command handler
const historyCommand = Composer.command(
  'history',
  authMiddleware(),
  async (ctx) => {
    await fetchAndDisplayHistory(ctx);
  },
);

// History action handler
const historyAction = Composer.action(
  'history',
  authMiddleware(),
  async (ctx) => {
    await ctx.answerCbQuery();
    await fetchAndDisplayHistory(ctx);
  },
);

// Helper function to get user's unique identifier
function getUserId(ctx): string {
  const session = getSession(ctx);
  return session.userId?.toString() || '';
}

// Helper function to escape Markdown characters
function escapeMarkdown(text) {
  if (!text) return '';
  return text
    .toString()
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
}

// Helper function to map API transaction to UI format
function mapTransactionForUI(transaction) {
  // Add helper properties for backward compatibility with existing display code
  return {
    ...transaction,
    // Map currency and amount fields
    token: transaction.fromCurrency,
    amount: transaction.fromAmount,
    // Extract network from account if available
    network:
      transaction.fromAccount?.network ||
      transaction.toAccount?.network ||
      'unknown',
  };
}

// Helper function to fetch and display transaction history with pagination
async function fetchAndDisplayHistory(ctx, page = 1) {
  try {
    const userId = getUserId(ctx);
    console.log(`[HISTORY] Fetching history for user ${userId}, page ${page}`);

    // Validate page input
    if (page < 1) {
      console.warn(`[HISTORY] Invalid page number ${page}, defaulting to page 1`);
      page = 1;
    }

    // Show loading message on first page only
    if (page === 1) {
      await ctx.reply(formatLoading('Fetching your transaction history...'), {
        parse_mode: 'Markdown',
      });
    }

    // Get session token
    const session = getSession(ctx);
    const token = session.token as string;

    if (!token) {
      console.error('[HISTORY] No authentication token found');
      throw new Error('Authentication token not found. Please login again.');
    }

    console.log(`[HISTORY] Making API request to /transactions`);

    // Fetch transactions with pagination only (no status filter)
    const response = await transfersApi.getTransferHistory(
      token,
      page,
      ITEMS_PER_PAGE,
    );

    // Validate response structure
    if (!response || typeof response !== 'object') {
      console.error('[HISTORY] Invalid response format - not an object');
      throw new Error('API returned invalid response format');
    }

    if (!response.data) {
      console.error('[HISTORY] Response missing data property');
      throw new Error('API response missing data property');
    }

    // Extract data from the response, with fallbacks for missing properties
    let rawTransactions = [];
    let totalItems = 0;
    let hasMore = false;

    if (response.data.data && Array.isArray(response.data.data)) {
      rawTransactions = response.data.data;
    } else if (Array.isArray(response.data)) {
      // Alternative format: data itself might be an array
      console.log('[HISTORY] Alternative response format detected: response.data is an array');
      rawTransactions = response.data;
    } else {
      console.error('[HISTORY] No transaction data found in response');
    }

    // Extract count/total with fallbacks
    if (typeof response.data.count === 'number') {
      totalItems = response.data.count;
    } else if (typeof (response.data as any).total === 'number') {
      totalItems = (response.data as any).total;
    } else {
      // If no count found, estimate based on current page and items per page
      const estimatedTotal =
        (page - 1) * ITEMS_PER_PAGE + rawTransactions.length;
      totalItems = Math.max(estimatedTotal, rawTransactions.length);
      console.log(`[HISTORY] No count/total field found, estimating total`);
    }

    // Make sure total is at least the number of items we have
    if (totalItems < rawTransactions.length) {
      totalItems = rawTransactions.length;
    }

    // Force minimum total to ensure pagination works
    if (totalItems <= 0 && rawTransactions.length > 0) {
      totalItems = Math.max(ITEMS_PER_PAGE, rawTransactions.length);
      console.log(`[HISTORY] Forced minimum total items to enable pagination`);
    }

    // Extract hasMore with fallbacks
    if (typeof response.data.hasMore === 'boolean') {
      hasMore = response.data.hasMore;
    } else {
      // If we can't determine, calculate based on current page, total items and items per page
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      hasMore = page < totalPages;

      // If on page 1 with full page of results, assume there might be more
      if (page === 1 && rawTransactions.length >= ITEMS_PER_PAGE) {
        hasMore = true;
      }
    }

    // Force hasMore to true if we have a full page of results
    if (!hasMore && rawTransactions.length >= ITEMS_PER_PAGE) {
      hasMore = true;
    }

    console.log(`[HISTORY] Extracted ${rawTransactions.length} transactions`);

    // Map transactions to UI format
    const transactions = rawTransactions.map(mapTransactionForUI);

    // Update user's view state
    userViewState.set(userId, {
      currentPage: page,
      currentStatus: undefined,
      totalItems: totalItems,
      lastFetched: Date.now(),
    });

    // Check if we have any transactions
    if (!transactions || transactions.length === 0) {
      console.log(`[HISTORY] No transactions found, displaying empty state message`);

      // We need to show a message but also offer a way back to the menu
      await ctx.reply(
        formatWarning(`No transactions found`) +
          "\n\nYou don't have any transactions.",
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback(
                  `${ICON.back} Back to Main Menu`,
                  'main_menu',
                ),
              ],
            ],
          },
        },
      );

      return; // Important - don't continue to display pagination controls
    }

    console.log(`[HISTORY] Displaying ${transactions.length} transactions`);

    // Display the transactions
    await displayTransactions(ctx, transactions, page, totalItems);

    // Show pagination controls if needed
    await displayPaginationControls(ctx, page, totalItems, hasMore);
  } catch (error) {
    console.error('[HISTORY] Error fetching transaction history:', error);
    await ctx.reply(
      formatError('Failed to fetch transaction history') +
        `\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                `${ICON.back} Back to Main Menu`,
                'main_menu',
              ),
            ],
          ],
        },
      },
    );
  }
}

// Helper function to display transactions
async function displayTransactions(ctx, transactions, currentPage, totalItems) {
  // Create header
  let headerText = 'Your Transaction History';

  // Calculate displayed range
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(startItem + transactions.length - 1, totalItems);

  let message = formatHeader(headerText) + DIVIDERS.medium;
  message += `Showing ${startItem}-${endItem} of ${totalItems} transactions\n\n`;

  // Display transactions
  transactions.forEach((transfer, index) => {
    try {
      // Format date
      const dateObj = new Date(transfer.createdAt);
      const date = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

      // Format amount and other details - use mapped fields which include both original and helper properties
      // Divide the amount by 10^8 as requested
      const originalAmount = parseFloat(
        transfer.amount || transfer.fromAmount || '0',
      );
      const divisor = Math.pow(10, 8);
      const adjustedAmount = originalAmount / divisor;
      const amount = formatAmount(adjustedAmount);

      const currency = escapeMarkdown(
        transfer.token || transfer.fromCurrency || 'unknown',
      );
      const transferStatus = escapeMarkdown(
        transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1),
      );
      const type = escapeMarkdown(
        transfer.type.charAt(0).toUpperCase() + transfer.type.slice(1),
      );

      // Use status-specific icons
      let statusIcon = ICON.history;
      if (transfer.status.toLowerCase() === 'success') {
        statusIcon = ICON.success;
      } else if (
        ['pending', 'processing', 'initiated', 'awaiting_funds'].includes(
          transfer.status.toLowerCase(),
        )
      ) {
        statusIcon = ICON.loading;
      } else if (
        ['failed', 'canceled'].includes(transfer.status.toLowerCase())
      ) {
        statusIcon = ICON.error;
      } else if (transfer.status.toLowerCase() === 'refunded') {
        statusIcon = ICON.warning;
      }

      // Global index across all pages
      const globalIndex = startItem + index;

      // Create transaction entry - safely escape all user/API-provided text
      message += `${statusIcon} *${globalIndex}. ${type} - ${date}*\n`;
      message += `${SECTION.item}Amount: ${amount} ${currency}\n`;

      // Add network info if available
      const network = escapeMarkdown(
        transfer.network ||
          transfer.fromAccount?.network ||
          transfer.toAccount?.network ||
          'unknown',
      );
      message += `${SECTION.item}Network: ${network}\n`;

      message += `${SECTION.item}Status: ${transferStatus}\n`;

      // Add recipient info based on transaction type
      if (transfer.type.toLowerCase() === 'deposit') {
        if (transfer.toAccount?.walletAddress) {
          const address = transfer.toAccount.walletAddress;
          const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
          message += `${SECTION.item}To: ${escapeMarkdown(shortAddress)}\n`;
        }
      } else if (transfer.type.toLowerCase() === 'withdraw') {
        if (transfer.toAccount?.type === 'bank_ifsc') {
          message += `${SECTION.item}To: ${escapeMarkdown(transfer.toAccount.bankName || 'N/A')}\n`;
          if (transfer.toAccount.bankAccountNumber) {
            const accountNumber = transfer.toAccount.bankAccountNumber;
            const maskedNumber = `xxxx${accountNumber.substring(accountNumber.length - 4)}`;
            message += `${SECTION.item}Acct: ${escapeMarkdown(maskedNumber)}\n`;
          }
        } else if (transfer.toAccount?.walletAddress) {
          const address = transfer.toAccount.walletAddress;
          const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
          message += `${SECTION.item}To: ${escapeMarkdown(shortAddress)}\n`;
        }
      }

      // Add transaction hash if available
      if (transfer.transactionHash) {
        const shortHash = `${transfer.transactionHash.substring(0, 6)}...${transfer.transactionHash.substring(transfer.transactionHash.length - 4)}`;
        message += `${SECTION.item}Tx: ${escapeMarkdown(shortHash)}\n`;
      }

      message += DIVIDERS.small;
    } catch (err) {
      // If there's an error formatting a specific transaction, log it and add a simplified entry
      console.error(`[HISTORY] Error formatting transaction ${index}`);
      message += `${ICON.warning} *${startItem + index}. Transaction*\n`;
      message += `${SECTION.item}Error displaying details for this transaction\n`;
      message += DIVIDERS.small;
    }
  });

  // Add a try-catch for the actual message sending in case it's still too large
  try {
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (sendError) {
    console.error('[HISTORY] Error sending transaction message');

    // Try sending a simplified message instead
    await ctx.reply(
      formatError('Error displaying transaction history') +
        '\n\nThere was a problem formatting the transaction details. ' +
        'Please try again or contact support if the issue persists.',
      { parse_mode: 'Markdown' },
    );
  }
}

// Helper function to display pagination controls
async function displayPaginationControls(
  ctx,
  currentPage,
  totalItems,
  hasMore,
) {
  try {
    console.log(`[HISTORY] Setting up pagination controls: page=${currentPage}`);

    // Calculate total pages - enforce minimum of 1 page
    const totalPages = Math.max(Math.ceil(totalItems / ITEMS_PER_PAGE), 1);

    // Make sure current page doesn't exceed total pages
    // If it does, we're in an error state and should reset
    if (currentPage > totalPages && totalPages > 0) {
      console.error(`[HISTORY] ERROR: Current page ${currentPage} exceeds total pages ${totalPages}`);
      currentPage = totalPages; // Fix the currentPage to avoid display issues
    }

    // Determine if we need a next page button
    const hasNextPage = hasMore || currentPage < totalPages;

    const navigationButtons = [];

    // Create navigation row
    const navRow = [];

    // Previous button if needed
    if (currentPage > 1) {
      navRow.push(
        Markup.button.callback(
          `⬅️ Previous`,
          `history_page_${currentPage - 1}_all`,
        ),
      );
    }

    // Add page indicator with proper validation
    // Make sure the display makes logical sense
    const displayPage = Math.min(currentPage, totalPages);
    navRow.push(
      Markup.button.callback(
        `${displayPage}/${totalPages}`,
        'do_nothing', // No-op action
      ),
    );

    // Next button if needed
    if (hasNextPage) {
      navRow.push(
        Markup.button.callback(
          `Next ➡️`,
          `history_page_${currentPage + 1}_all`,
        ),
      );
    }

    // Only add the nav row if it has any buttons
    if (navRow.length > 0) {
      navigationButtons.push(navRow);
    }

    // Back button (always show)
    navigationButtons.push([
      Markup.button.callback(`${ICON.back} Back to Main Menu`, 'main_menu'),
    ]);

    // User-friendly message for when there are no more pages
    let navigationMessage = formatSubheader('Transaction Navigation');
    if (!hasNextPage && currentPage >= totalPages && currentPage > 1) {
      navigationMessage +=
        '\n\nYou have reached the last page of your transaction history.';
    } else if (currentPage === 1 && totalPages === 1) {
      navigationMessage += '\n\nAll your transactions are shown on this page.';
    }

    await ctx.reply(navigationMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: navigationButtons,
      },
    });
  } catch (error) {
    console.error(`[HISTORY] Error displaying pagination controls`);
    // Instead of silent fail, try to at least send back button
    try {
      await ctx.reply(formatSubheader('Return to Menu'), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              Markup.button.callback(
                `${ICON.back} Back to Main Menu`,
                'main_menu',
              ),
            ],
          ],
        },
      });
    } catch (fallbackError) {
      console.error(`[HISTORY] Failed to send fallback navigation`);
    }
  }
}

// No-op action handler for page indicator button
const doNothingAction = Composer.action('do_nothing', async (ctx) => {
  await ctx.answerCbQuery('Current page indicator');
});

// Pagination handlers for simplified version (no status filter)
const pageAction = Composer.action(
  /^history_page_(\d+)_(.+)$/,
  authMiddleware(),
  async (ctx) => {
    try {
      await ctx.answerCbQuery('Loading page...');
      const [_, pageStr] = ctx.match as RegExpMatchArray;
      const page = parseInt(pageStr);

      console.log(`[HISTORY] User selected page ${page}`);

      // Basic validation
      if (isNaN(page) || page < 1) {
        console.error(`[HISTORY] Invalid page number: ${pageStr}`);
        await ctx.reply(formatError('Invalid page number. Please try again.'));
        return;
      }

      console.log(`[HISTORY] Fetching page ${page} in pageAction`);

      // Send loading message for better UX
      const loadingMsg = await ctx.reply(
        formatLoading(`Loading page ${page}...`),
        { parse_mode: 'Markdown' },
      );

      // Fetch and display history
      await fetchAndDisplayHistory(ctx, page);

      // Try to delete the loading message
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (deleteError) {
        console.warn('[HISTORY] Could not delete loading message');
      }
    } catch (error) {
      console.error('[HISTORY] Error handling page action');

      try {
        await ctx.answerCbQuery('Error loading page. Please try again.');
        await ctx.reply(
          formatError('Failed to load the requested page') +
            '\n\nPlease try again.',
          { parse_mode: 'Markdown' },
        );
      } catch (replyError) {
        console.error('[HISTORY] Failed to send error message');
      }
    }
  },
);

// Debug helper command to test API connectivity
const historyTestCommand = Composer.command(
  'historytest',
  authMiddleware(),
  async (ctx) => {
    try {
      await ctx.reply(formatLoading('Testing API connection...'), {
        parse_mode: 'Markdown',
      });

      // Get session token
      const session = getSession(ctx);
      const token = session.token as string;

      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      // Log information about the request
      console.log('[HISTORYTEST] Starting API test');
      console.log('[HISTORYTEST] API base URL:', config.api.baseURL);

      // Make a simple GET request to the API
      const response = await transfersApi.getTransferHistory(token, 1, 1);

      // Send the response info to the user
      await ctx.reply(
        formatSuccess('API connection test completed') +
          `\n\nResponse status: ${response.status || 'unknown'}` +
          `\n\nFound ${response.data?.count || 0} total transactions` +
          `\n\nFirst page has ${response.data?.data?.length || 0} transactions` +
          `\n\nResponse structure: ${Object.keys(response).join(', ')}` +
          `\n\nData structure: ${Object.keys(response.data || {}).join(', ')}`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      console.error('[HISTORYTEST] Error testing API connection');

      // Send detailed error info to the user
      await ctx.reply(
        formatError('API connection test failed') +
          `\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}` +
          `\n\nPlease check the server logs for more details.`,
        { parse_mode: 'Markdown' },
      );
    }
  },
);

// Debug command to check API configuration
const historyConfigCommand = Composer.command(
  'historyconfig',
  authMiddleware(),
  async (ctx) => {
    try {
      // Get API base URL from config
      const baseUrl = config.api.baseURL;
      const transactionsUrl = `${baseUrl}/transactions`;

      // Check API base URL
      console.log('[HISTORYCONFIG] Checking API configuration');

      await ctx.reply(
        formatHeader('API Configuration') +
          `\n\nBase URL: \`${baseUrl}\`` +
          `\n\nTransactions URL: \`${transactionsUrl}\`` +
          `\n\nItems per page: ${ITEMS_PER_PAGE}` +
          `\n\nStatus mapping:` +
          Object.entries(STATUS_OPTIONS)
            .map(([key, value]) => `\n- ${key}: "${value.label}"`)
            .join(''),
        { parse_mode: 'Markdown' },
      );

      // Show currently logged in user info
      const session = getSession(ctx);
      if (session.authenticated && session.userId && session.email) {
        await ctx.reply(
          formatSubheader('User Session Info') +
            `\n\nUser ID: ${session.userId}` +
            `\n\nEmail: ${session.email}` +
            `\n\nAuthenticated: ${session.authenticated}` +
            `\n\nOrganization ID: ${session.organizationId || 'Not set'}` +
            `\n\nToken present: ${session.token ? 'Yes' : 'No'}`,
          { parse_mode: 'Markdown' },
        );
      }
    } catch (error) {
      console.error('[HISTORYCONFIG] Error');
      await ctx.reply(
        formatError('Error checking API configuration') +
          `\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        { parse_mode: 'Markdown' },
      );
    }
  },
);

export default Composer.compose([
  historyCommand,
  historyAction,
  pageAction,
  doNothingAction,
  historyTestCommand,
  historyConfigCommand,
]);
