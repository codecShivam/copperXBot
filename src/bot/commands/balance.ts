import { Composer, Markup } from 'telegraf';
import { walletApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { 
  backButtonKeyboard, 
  balanceMenuKeyboard, 
  paginatedNetworksKeyboard,
  networkTokensKeyboard,
  walletSettingsKeyboard,
  walletsKeyboard,
  confirmationKeyboard
} from '../keyboards';
import { formatAmount } from '../../utils/format';
import { getSession } from '../../utils/session';
import { Balance, Wallet, WalletWithBalances } from '../../types';
import { formatNetworkForDisplay, getNetworkName } from '../../utils/networks';
import { 
  SECTION, 
  ICON, 
  DIVIDERS,
  formatHeader,
  formatSubheader,
  formatSuccess,
  formatError,
  formatWarning,
  formatLoading,
  formatNetworkIcon,
  getSupportedNetworks
} from '../../constants';

// Cache for balances to avoid frequent API calls
const balanceCache = new Map<string, {
  balances: Balance[],
  timestamp: number,
  balancesByNetwork: Record<string, Balance[]>
}>();

// Cache expiry time - 5 minutes
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

// Balance command handler
const balanceCommand = Composer.command('balance', authMiddleware(), async (ctx) => {
  await showBalanceMenu(ctx);
});

// Balance action handler for main balance button
const balanceAction = Composer.action('balance', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await showBalanceMenu(ctx);
});

// Balance menu display
async function showBalanceMenu(ctx) {
  await ctx.reply(
    formatHeader('Wallet & Balance Management') + '\n\n' +
    'What would you like to do?',
    {
      parse_mode: 'Markdown',
      ...balanceMenuKeyboard()
    }
  );
}

// Show all balances action
const allBalancesAction = Composer.action('balance_all', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await fetchAndDisplayBalances(ctx);
});

// Refresh balances action
const refreshBalancesAction = Composer.action('balance_refresh', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery(`${ICON.refresh} Refreshing your balances...`);
  
  // Clear the cache for this user
  const session = getSession(ctx);
  const userId = session.userId?.toString();
  if (userId) {
    balanceCache.delete(userId);
  }
  
  await fetchAndDisplayBalances(ctx, true);
});

// Show network selection action
const networkSelectionAction = Composer.action('balance_networks', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await showNetworkSelection(ctx);
});

// Wallet details action
const walletDetailsAction = Composer.action('wallet_details', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await showWalletDetails(ctx);
});

// Wallet settings action
const walletSettingsAction = Composer.action('wallet_settings', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply(
    formatHeader('Wallet Settings') + DIVIDERS.medium +
    'Manage your wallet preferences:',
    {
      parse_mode: 'Markdown',
      ...walletSettingsKeyboard()
    }
  );
});

// Set default wallet action
const setDefaultWalletAction = Composer.action('wallet_set_default', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await showSetDefaultWallet(ctx);
});

// View wallet address action
const viewWalletAddressAction = Composer.action('wallet_view_address', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await showWalletAddresses(ctx);
});

// Token details action
const tokenDetailsAction = Composer.action('wallet_token_details', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  console.log('[BALANCE] Token details action triggered');
  await showNetworkSelection(ctx);
});

// Wallet generation action
const generateWalletAction = Composer.action('wallet_generate', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  console.log('[BALANCE] Generate wallet action triggered');
  await showNetworkSelectionForWalletGeneration(ctx);
});

// Network selection for wallet generation
async function showNetworkSelectionForWalletGeneration(ctx) {
  try {
    const message = formatHeader('Generate New Wallet') + DIVIDERS.medium + 
                  'Please select the network for your new wallet:';
    
    // Get supported networks from our constants
    const supportedNetworks = getSupportedNetworks();
    
    // Create network selection buttons with icons
    const buttons = supportedNetworks.map(network => [
      Markup.button.callback(
        `${formatNetworkIcon(network.name)} ${network.name}`,
        `generate_wallet_${network.id}_${network.name}`
      )
    ]);
    
    buttons.push([Markup.button.callback(`${ICON.back} Back to Wallet Settings`, 'wallet_settings')]);
    
    const networkKeyboard = Markup.inlineKeyboard(buttons);
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...networkKeyboard
    });
  } catch (error) {
    console.error('Error showing network selection for wallet generation:', error);
    await ctx.reply(
      formatError('Failed to show network selection') + 
      `\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      { parse_mode: 'Markdown' }
    );
    await ctx.reply(`${ICON.back} Return to wallet settings:`, backButtonKeyboard('wallet_settings'));
  }
}

// Generate wallet action handler
const generateWalletNetworkAction = Composer.action(/^generate_wallet_(.+)_(.+)$/, authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  const [_, networkId, networkName] = ctx.match as RegExpMatchArray;
  console.log(`[BALANCE] Generate wallet for network ${networkName} (ID: ${networkId}) action triggered`);
  await generateNewWallet(ctx, networkId, networkName);
});

// Network pagination action handler
const networkPaginationAction = Composer.action(/^network_page_(\d+)$/, authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  const page = parseInt((ctx.match as RegExpMatchArray)[1]);
  await showNetworkSelection(ctx, page);
});

// Network selection action handler
const networkBalancesAction = Composer.action(/^balance_network_(.+)$/, authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  const network = (ctx.match as RegExpMatchArray)[1];
  await showNetworkBalances(ctx, network);
});

// Token details action handler
const tokenDetailsViewAction = Composer.action(/^token_details_(.+)_(.+)$/, authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  const [_, network, token] = ctx.match as RegExpMatchArray;
  await showTokenDetails(ctx, network, token);
});

// Wallet selection for default setting
const walletSelectionAction = Composer.action(/^set_default_(.+)$/, authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  const walletId = (ctx.match as RegExpMatchArray)[1];
  await setDefaultWalletHandler(ctx, walletId);
});

// Helper function to get and cache balances
async function getCachedBalances(ctx): Promise<{
  balances: Balance[],
  balancesByNetwork: Record<string, Balance[]>
}> {
  // Get user ID from session
  const session = getSession(ctx);
  const userId = session.userId?.toString();
  const token = session.token as string;
  
  console.log(`[BALANCE] Getting cached balances for user ${userId}`);
  
  if (!userId) {
    console.error('[BALANCE] User ID not found in session');
    throw new Error('User ID not found in session');
  }
  
  // Check if we have a valid cache
  const cachedData = balanceCache.get(userId);
  const now = Date.now();
  
  if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRY_MS)) {
    console.log('[BALANCE] Using cached balance data');
    return {
      balances: cachedData.balances,
      balancesByNetwork: cachedData.balancesByNetwork
    };
  }
  
  console.log('[BALANCE] Cache miss or expired, fetching fresh balance data');
  
  // Fetch new data - walletApi.getBalances now returns WalletWithBalances[] directly
  const walletData = await walletApi.getBalances(token);
  console.log(`[BALANCE] Received ${walletData.length} wallets with balances`);
  
  // Flatten all balances from all wallets
  const allBalances: Balance[] = [];
  const balancesByNetwork: Record<string, Balance[]> = {};
  
  // Process each wallet
  walletData.forEach(wallet => {
    const network = wallet.network;
    console.log(`[BALANCE] Processing wallet for network ${network}`);
    
    // Initialize network in the balancesByNetwork if not exists
    if (!balancesByNetwork[network]) {
      balancesByNetwork[network] = [];
    }
    
    // Process each balance in the wallet
    if (wallet.balances && Array.isArray(wallet.balances)) {
      console.log(`[BALANCE] Processing ${wallet.balances.length} token balances`);
      wallet.balances.forEach(balance => {
        // Create a Balance object with the required format
        const balanceObj: Balance = {
          network,
          token: balance.symbol,
          balance: balance.balance,
          formattedBalance: formatAmount(balance.balance),
          walletId: wallet.walletId,
          isDefaultWallet: wallet.isDefault,
          address: balance.address,
          decimals: balance.decimals
        };
        
        console.log(`[BALANCE] Token: ${balance.symbol}, Balance: ${balance.balance}`);
        
        // Add to all balances
        allBalances.push(balanceObj);
        
        // Add to network balances
        balancesByNetwork[network].push(balanceObj);
      });
    } else {
      console.log(`[BALANCE] No balances found for wallet on network ${network}`);
    }
  });
  
  // Cache the data
  console.log(`[BALANCE] Caching balance data for user ${userId}`);
  balanceCache.set(userId, {
    balances: allBalances,
    balancesByNetwork,
    timestamp: now
  });
  
  return { balances: allBalances, balancesByNetwork };
}

// Helper function to fetch and display all balances
async function fetchAndDisplayBalances(ctx, isRefresh = false) {
  try {
    if (!isRefresh) {
      await ctx.reply(
        formatLoading('Fetching your wallet balances...'),
        { parse_mode: 'Markdown' }
      );
    }
    
    const { balances, balancesByNetwork } = await getCachedBalances(ctx);
    
    if (!balances || balances.length === 0) {
      await ctx.reply(
        formatWarning('No balances found') + '\n\nYou don\'t have any tokens in your wallets yet.',
        { parse_mode: 'Markdown' }
      );
      await ctx.reply(
        `${ICON.back} Return to balance menu:`, 
        backButtonKeyboard('balance')
      );
      return;
    }
    
    // Format and display balances
    let message = formatHeader('Your Wallet Balances') + DIVIDERS.medium;
    
    Object.entries(balancesByNetwork).forEach(([network, networkBalances]) => {
      const networkName = formatNetworkForDisplay(network);
      const networkIcon = formatNetworkIcon(networkName);
      
      // Display user-friendly network name with icon
      message += `*${networkIcon} ${networkName}*\n`;
      
      networkBalances.forEach((balance) => {
        const formattedBalance = formatAmount(balance.balance);
        message += `${SECTION.item}${balance.token}: ${formattedBalance}\n`;
      });
      
      message += DIVIDERS.small;
    });
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
    await ctx.reply(
      `${ICON.back} Return to balance menu:`, 
      backButtonKeyboard('balance')
    );
  } catch (error) {
    console.error('Error fetching balances:', error);
    await ctx.reply(
      formatError('Failed to fetch balances') + 
      `\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      { parse_mode: 'Markdown' }
    );
    await ctx.reply(
      `${ICON.back} Return to balance menu:`, 
      backButtonKeyboard('balance')
    );
  }
}

// Helper function to show network selection
async function showNetworkSelection(ctx, page = 0) {
  try {
    await ctx.reply(`${ICON.loading} Fetching your networks...`);
    
    const { balancesByNetwork } = await getCachedBalances(ctx);
    
    if (Object.keys(balancesByNetwork).length === 0) {
      await ctx.reply(
        `${ICON.warning} *No balances found*\n\nYou don\'t have any tokens in your wallets yet.`,
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
      return;
    }
    
    // Get unique networks
    const networks = Object.keys(balancesByNetwork);
    
    await ctx.reply(
      `${ICON.network} *Select Network*\n\nChoose a network to view token balances:`,
      {
        parse_mode: 'Markdown',
        ...paginatedNetworksKeyboard(networks, page)
      }
    );
  } catch (error) {
    console.error('Error fetching networks:', error);
    await ctx.reply(
      `${ICON.error} Failed to fetch networks: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
  }
}

// Helper function to show network balances
async function showNetworkBalances(ctx, network: string) {
  try {
    const { balancesByNetwork } = await getCachedBalances(ctx);
    
    const networkBalances = balancesByNetwork[network] || [];
    
    if (networkBalances.length === 0) {
      await ctx.reply(
        `${ICON.warning} *No balances found for ${formatNetworkForDisplay(network)}*\n\nYou don't have any tokens on this network.`,
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to networks:', backButtonKeyboard('balance_networks'));
      return;
    }
    
    // Show the balances with token selection
    await ctx.reply(
      `${ICON.balance} *${formatNetworkForDisplay(network)} Balances*\n\nSelect a token for more details:`,
      {
        parse_mode: 'Markdown',
        ...networkTokensKeyboard(networkBalances, network)
      }
    );
  } catch (error) {
    console.error('Error fetching network balances:', error);
    await ctx.reply(
      `${ICON.error} Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to networks:', backButtonKeyboard('balance_networks'));
  }
}

// Helper function to show token details
async function showTokenDetails(ctx, network: string, token: string) {
  try {
    const { balancesByNetwork } = await getCachedBalances(ctx);
    
    const networkBalances = balancesByNetwork[network] || [];
    const tokenBalance = networkBalances.find(b => b.token === token);
    
    if (!tokenBalance) {
      await ctx.reply(
        `${ICON.error} Token details not found for ${token} on ${formatNetworkForDisplay(network)}.`,
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to network balances:', backButtonKeyboard(`balance_network_${network}`));
      return;
    }
    
    const formattedBalance = formatAmount(tokenBalance.balance);
    
    let message = `${ICON.balance} *${token} Details on ${formatNetworkForDisplay(network)}*\n\n`;
    message += `Balance: ${formattedBalance}\n`;
    message += `Token: ${token}\n`;
    message += `Network: ${formatNetworkForDisplay(network)}\n`;
    
    // Include wallet address if available in the API response
    if ('walletAddress' in tokenBalance) {
      message += `\nWallet Address: \`${(tokenBalance as any).walletAddress}\`\n`;
    }
    
    // Add additional details if available
    if ('usdValue' in tokenBalance) {
      message += `USD Value: $${formatAmount((tokenBalance as any).usdValue)}\n`;
    }
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
    
    // Offer options for this token
    const actionButtons = Markup.inlineKeyboard([
      [Markup.button.callback(`${ICON.send} Send`, `send_init_${network}_${token}`)],
      [Markup.button.callback(`${ICON.withdraw} Withdraw`, `withdraw_init_${network}_${token}`)],
      [Markup.button.callback(`${ICON.back} Back to ${formatNetworkForDisplay(network)}`, `balance_network_${network}`)],
    ]);
    
    await ctx.reply('Actions for this token:', actionButtons);
  } catch (error) {
    console.error('Error fetching token details:', error);
    await ctx.reply(
      `${ICON.error} Failed to fetch token details: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply(`Return to ${formatNetworkForDisplay(network)} balances:`, backButtonKeyboard(`balance_network_${network}`));
  }
}

// Display detailed information about a wallet
async function showWalletDetails(ctx) {
  try {
    await ctx.reply(
      formatLoading('Fetching wallet details...'),
      { parse_mode: 'Markdown' }
    );

    const session = getSession(ctx);
    const token = session.token as string;
    const wallets = await walletApi.getWallets(token);

    if (!wallets || wallets.length === 0) {
      await ctx.reply(
        formatWarning('No wallets found') + '\n\nYou don\'t have any wallets configured yet.',
        { parse_mode: 'Markdown' }
      );
      await ctx.reply(
        `${ICON.back} Return to balance menu:`, 
        backButtonKeyboard('balance')
      );
      return;
    }

    let message = formatHeader('Your Wallets') + DIVIDERS.medium;
    
    wallets.forEach((wallet) => {
      const networkName = formatNetworkForDisplay(wallet.network);
      message += `${SECTION.item}Network: ${formatNetworkIcon(networkName)} *${networkName}*${wallet.isDefault ? ' (Default)' : ''}\n`;
      message += `${SECTION.item}Address: \`${wallet.walletAddress}\`\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });

    // Provide wallet management options
    const options = {
      inline_keyboard: [
          [{ text: `${ICON.back} Back`, callback_data: 'balance' }]
      ]
    };

    await ctx.reply(formatSubheader('Return to Balance Menu'), {
      parse_mode: 'Markdown',
      reply_markup: options
    });
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    await ctx.reply(
      formatError('Failed to fetch wallet details') + 
      `\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.reply(
      `${ICON.back} Return to balance menu:`, 
      backButtonKeyboard('balance')
    );
  }
}

// Show all wallet addresses
async function showWalletAddresses(ctx) {
  try {
    await ctx.reply(
      formatLoading('Fetching your wallet addresses...'),
      { parse_mode: 'Markdown' }
    );

    const session = getSession(ctx);
    const token = session.token as string;
    const wallets = await walletApi.getWallets(token);

    if (!wallets || wallets.length === 0) {
      await ctx.reply(
        formatWarning('No wallets found') + '\n\nYou don\'t have any wallets configured yet.',
        { parse_mode: 'Markdown' }
      );
      
      // Offer to generate a wallet
      const options = {
        inline_keyboard: [
          [{ text: `${ICON.back} Back`, callback_data: 'balance' }]
        ]
      };
      
      await ctx.reply('Return to Balance Menu', { reply_markup: options });
      return;
    }

    let message = formatHeader('Your Wallet Addresses') + DIVIDERS.medium;
    
    // Group wallets by network
    const walletsByNetwork = {};
    wallets.forEach(wallet => {
      if (!walletsByNetwork[wallet.network]) {
        walletsByNetwork[wallet.network] = [];
      }
      walletsByNetwork[wallet.network].push(wallet);
    });
    
    // Display wallets grouped by network
    Object.entries(walletsByNetwork).forEach(([network, networkWallets]) => {
      const networkName = formatNetworkForDisplay(network);
      const networkIcon = formatNetworkIcon(networkName);
      
      message += `*${networkIcon} ${networkName}*\n`;
      
      (networkWallets as Wallet[]).forEach((wallet, index) => {
        message += `${SECTION.item}${wallet.isDefault ? '✓ Default: ' : `Wallet ${index + 1}: `}`;
        message += `\`${wallet.walletAddress}\`\n`;
      });
      
      message += DIVIDERS.small;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
    
    // Provide wallet management options
    const options = {
      inline_keyboard: [
        [{ text: `${ICON.back} Back`, callback_data: 'balance' }]
      ]
    };
    
    await ctx.reply(formatSubheader('Return to Balance Menu'), {
      parse_mode: 'Markdown',
      reply_markup: options
    });
  } catch (error) {
    console.error('Error fetching wallet addresses:', error);
    await ctx.reply(
      formatError('Failed to fetch wallet addresses') + 
      `\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.reply(
      `${ICON.back} Return to balance menu:`, 
      backButtonKeyboard('balance')
    );
  }
}

// Helper function to show set default wallet
async function showSetDefaultWallet(ctx) {
  try {
    await ctx.reply(`${ICON.loading} Fetching your wallets...`);
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Fetch wallets - walletApi.getWallets now returns Wallet[] directly
    const wallets = await walletApi.getWallets(token);
    console.log(`[BALANCE] Fetched ${wallets.length} wallets for default selection`);
    
    if (!wallets || wallets.length === 0) {
      await ctx.reply(
        `${ICON.wallet} *No wallets found*\n\nYou don\'t have any wallets configured yet.`,
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
      return;
    }
    
    await ctx.reply(
      `${ICON.loading} *Set Default Wallet*\n\nSelect a wallet to set as default:`,
      {
        parse_mode: 'Markdown',
        ...walletsKeyboard(wallets, 'set_default')
      }
    );
  } catch (error) {
    console.error('Error fetching wallets:', error);
    await ctx.reply(
      `${ICON.error} Failed to fetch wallets: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  }
}

// Helper function to set default wallet
async function setDefaultWalletHandler(ctx, walletId: string) {
  try {
    await ctx.reply(`${ICON.loading} Setting wallet as default...`);
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Set default wallet
    await walletApi.setDefaultWallet(token, walletId);
    
    await ctx.reply(
      `${ICON.success} *Default wallet updated successfully!*\n\nThis wallet will now be used as the default for transactions.`,
      {
        parse_mode: 'Markdown',
      }
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  } catch (error) {
    console.error('Error setting default wallet:', error);
    await ctx.reply(
      `${ICON.error} Failed to set default wallet: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  }
}

// Generate a new wallet
async function generateNewWallet(ctx, networkId: string, networkName: string) {
  try {
    await ctx.reply(
      formatLoading(`Generating a new wallet on ${formatNetworkForDisplay(networkName)}...`),
      { parse_mode: 'Markdown' }
    );

    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;

    const response = await walletApi.generateWallet(token, networkId);
    const wallet = response;
    
    console.log('Generated wallet data:', wallet);

    // Clear cache to ensure fresh data on next balance check
    const userId = session.userId?.toString();
    if (userId) {
      balanceCache.delete(userId);
    }

    let message = formatSuccess('Wallet generated successfully!') + DIVIDERS.medium;
    message += `${ICON.wallet} Network: ${formatNetworkIcon(networkName)} *${formatNetworkForDisplay(networkName)}*\n`;
    message += `${ICON.address} Address: \`${wallet.walletAddress}\`\n\n`;

    await ctx.reply(message, { 
      parse_mode: 'Markdown'
    });

    await ctx.reply(
      `${ICON.back} Return to wallet menu:`, 
      backButtonKeyboard('wallet_settings')
    );
  } catch (error) {
    console.error('Wallet generation error:', error);
    await ctx.reply(
      formatError('Failed to generate wallet') + 
      `\n\n${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      { parse_mode: 'Markdown' }
    );
    
    await ctx.reply(
      `${ICON.back} Return to wallet menu:`, 
      backButtonKeyboard('wallet_settings')
    );
  }
}

// Compose all action handlers
export default Composer.compose([
  balanceCommand, 
  balanceAction,
  allBalancesAction,
  refreshBalancesAction,
  networkSelectionAction,
  walletDetailsAction,
  walletSettingsAction,
  setDefaultWalletAction,
  viewWalletAddressAction,
  tokenDetailsAction,
  generateWalletAction,
  generateWalletNetworkAction,
  networkPaginationAction,
  networkBalancesAction,
  tokenDetailsViewAction,
  walletSelectionAction
]); 