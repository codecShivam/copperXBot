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
    '💰 *Wallet & Balance Management*\n\nWhat would you like to do?',
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
  await ctx.answerCbQuery('🔄 Refreshing your balances...');
  
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
    '⚙️ *Wallet Settings*\n\nManage your wallet preferences:',
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
  console.log('[BALANCE] Showing network selection for wallet generation');
  
  try {
    await ctx.reply('🔄 Please select a network for your new wallet...');
    
    // Define supported networks with their chain IDs
    const supportedNetworks = [
      { name: 'Polygon', id: '137' },
      { name: 'Ethereum', id: '1' },
      { name: 'Arbitrum', id: '42161' },
      { name: 'Optimism', id: '10' },
      { name: 'Base', id: '8453' }
    ];
    
    // Create network selection buttons
    const buttons = supportedNetworks.map(network => [
      Markup.button.callback(
        network.name,
        `generate_wallet_${network.id}_${network.name}`
      )
    ]);
    
    buttons.push([Markup.button.callback('⬅️ Back to Wallet Settings', 'wallet_settings')]);
    
    const networkKeyboard = Markup.inlineKeyboard(buttons);
    
    await ctx.reply(
      '🌐 *Select Network*\n\nChoose a network for your new wallet:',
      {
        parse_mode: 'Markdown',
        ...networkKeyboard
      }
    );
  } catch (error) {
    console.error('[BALANCE] Error showing network selection for wallet generation:', error);
    await ctx.reply(
      `❌ Failed to show network selection: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
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
      await ctx.reply('🔄 Fetching your wallet balances...');
    }
    
    const { balances, balancesByNetwork } = await getCachedBalances(ctx);
    
    if (!balances || balances.length === 0) {
      await ctx.reply(
        '💰 *No balances found*\n\nYou don\'t have any tokens in your wallets yet.',
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
      return;
    }
    
    // Format and display balances
    let message = '💰 *Your Wallet Balances*\n\n';
    
    Object.entries(balancesByNetwork).forEach(([network, networkBalances]) => {
      // Display user-friendly network name
      message += `*${formatNetworkForDisplay(network)}*\n`;
      
      networkBalances.forEach((balance) => {
        const formattedBalance = formatAmount(balance.balance);
        message += `${balance.token}: ${formattedBalance}\n`;
      });
      
      message += '\n';
    });
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
    
    await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
  } catch (error) {
    console.error('Error fetching balances:', error);
    await ctx.reply(
      `❌ Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
  }
}

// Helper function to show network selection
async function showNetworkSelection(ctx, page = 0) {
  try {
    await ctx.reply('🔄 Fetching your networks...');
    
    const { balancesByNetwork } = await getCachedBalances(ctx);
    
    if (Object.keys(balancesByNetwork).length === 0) {
      await ctx.reply(
        '💰 *No balances found*\n\nYou don\'t have any tokens in your wallets yet.',
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
      '🌐 *Select Network*\n\nChoose a network to view token balances:',
      {
        parse_mode: 'Markdown',
        ...paginatedNetworksKeyboard(networks, page)
      }
    );
  } catch (error) {
    console.error('Error fetching networks:', error);
    await ctx.reply(
      `❌ Failed to fetch networks: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
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
        `💰 *No balances found for ${formatNetworkForDisplay(network)}*\n\nYou don't have any tokens on this network.`,
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to networks:', backButtonKeyboard('balance_networks'));
      return;
    }
    
    // Show the balances with token selection
    await ctx.reply(
      `💰 *${formatNetworkForDisplay(network)} Balances*\n\nSelect a token for more details:`,
      {
        parse_mode: 'Markdown',
        ...networkTokensKeyboard(networkBalances, network)
      }
    );
  } catch (error) {
    console.error('Error fetching network balances:', error);
    await ctx.reply(
      `❌ Failed to fetch balances: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
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
        `❌ Token details not found for ${token} on ${formatNetworkForDisplay(network)}.`,
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to network balances:', backButtonKeyboard(`balance_network_${network}`));
      return;
    }
    
    const formattedBalance = formatAmount(tokenBalance.balance);
    
    let message = `💰 *${token} Details on ${formatNetworkForDisplay(network)}*\n\n`;
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
      [Markup.button.callback('💸 Send', `send_init_${network}_${token}`)],
      [Markup.button.callback('🏦 Withdraw', `withdraw_init_${network}_${token}`)],
      [Markup.button.callback(`⬅️ Back to ${formatNetworkForDisplay(network)}`, `balance_network_${network}`)],
    ]);
    
    await ctx.reply('Actions for this token:', actionButtons);
  } catch (error) {
    console.error('Error fetching token details:', error);
    await ctx.reply(
      `❌ Failed to fetch token details: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply(`Return to ${formatNetworkForDisplay(network)} balances:`, backButtonKeyboard(`balance_network_${network}`));
  }
}

// Helper function to show wallet details
async function showWalletDetails(ctx) {
  try {
    await ctx.reply('🔄 Fetching your wallet details...');
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Fetch wallets - walletApi.getWallets now returns Wallet[] directly
    const wallets = await walletApi.getWallets(token);
    console.log(`[BALANCE] Fetched ${wallets.length} wallets`);
    
    if (!wallets || wallets.length === 0) {
      await ctx.reply(
        '💼 *No wallets found*\n\nYou don\'t have any wallets configured yet.',
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
      return;
    }
    
    // Format and display wallets
    let message = '💼 *Your Wallets*\n\n';
    
    wallets.forEach((wallet) => {
      message += `*${formatNetworkForDisplay(wallet.network)}*${wallet.isDefault ? ' (Default)' : ''}\n`;
      message += `Address: \`${wallet.walletAddress || wallet.address || 'Not available'}\`\n\n`;
    });
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
    
    await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    await ctx.reply(
      `❌ Failed to fetch wallet details: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to balance menu:', backButtonKeyboard('balance'));
  }
}

// Helper function to show wallet addresses
async function showWalletAddresses(ctx) {
  try {
    await ctx.reply('🔄 Fetching your wallet addresses...');
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Fetch wallets - walletApi.getWallets now returns Wallet[] directly
    const wallets = await walletApi.getWallets(token);
    console.log(`[BALANCE] Fetched ${wallets.length} wallet addresses`);
    
    if (!wallets || wallets.length === 0) {
      await ctx.reply(
        '💼 *No wallets found*\n\nYou don\'t have any wallets configured yet.',
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
      return;
    }
    
    // Loop through each wallet and send as separate messages for easier copying
    for (const wallet of wallets) {
      await ctx.reply(
        `*${formatNetworkForDisplay(wallet.network)}*${wallet.isDefault ? ' (Default)' : ''}\n` +
        `Address: \`${wallet.walletAddress || wallet.address || 'Not available'}\``,
        {
          parse_mode: 'Markdown',
        }
      );
    }
    
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  } catch (error) {
    console.error('Error fetching wallet addresses:', error);
    await ctx.reply(
      `❌ Failed to fetch wallet addresses: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  }
}

// Helper function to show set default wallet
async function showSetDefaultWallet(ctx) {
  try {
    await ctx.reply('🔄 Fetching your wallets...');
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Fetch wallets - walletApi.getWallets now returns Wallet[] directly
    const wallets = await walletApi.getWallets(token);
    console.log(`[BALANCE] Fetched ${wallets.length} wallets for default selection`);
    
    if (!wallets || wallets.length === 0) {
      await ctx.reply(
        '💼 *No wallets found*\n\nYou don\'t have any wallets configured yet.',
        {
          parse_mode: 'Markdown',
        },
      );
      await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
      return;
    }
    
    await ctx.reply(
      '🔄 *Set Default Wallet*\n\nSelect a wallet to set as default:',
      {
        parse_mode: 'Markdown',
        ...walletsKeyboard(wallets, 'set_default')
      }
    );
  } catch (error) {
    console.error('Error fetching wallets:', error);
    await ctx.reply(
      `❌ Failed to fetch wallets: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  }
}

// Helper function to set default wallet
async function setDefaultWalletHandler(ctx, walletId: string) {
  try {
    await ctx.reply(`🔄 Setting wallet as default...`);
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Set default wallet
    await walletApi.setDefaultWallet(token, walletId);
    
    await ctx.reply(
      '✅ *Default wallet updated successfully!*\n\nThis wallet will now be used as the default for transactions.',
      {
        parse_mode: 'Markdown',
      }
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  } catch (error) {
    console.error('Error setting default wallet:', error);
    await ctx.reply(
      `❌ Failed to set default wallet: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  }
}

// Helper function to generate a new wallet
async function generateNewWallet(ctx, networkId: string, networkName: string) {
  console.log(`[BALANCE] Generating new wallet for network ${networkName} with ID ${networkId}`);
  
  try {
    await ctx.reply(`🔄 Generating a new ${networkName} wallet...`);
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    console.log(`[BALANCE] Using token for user ${session.userId}`);
    
    // Generate new wallet using network ID - walletApi.generateWallet now returns Wallet directly
    console.log(`[BALANCE] Calling walletApi.generateWallet with networkId: ${networkId}`);
    const wallet = await walletApi.generateWallet(token, networkId);
    console.log('[BALANCE] Wallet received:', JSON.stringify(wallet));
    
    // Clear cache to ensure fresh data on next balance check
    const userId = session.userId?.toString();
    if (userId) {
      console.log(`[BALANCE] Clearing balance cache for user ${userId}`);
      balanceCache.delete(userId);
    }
    
    if (!wallet) {
      console.error('[BALANCE] Wallet data is undefined or null');
      throw new Error('Failed to generate wallet - API returned no data');
    }
    
    console.log(`[BALANCE] Wallet created with address: ${wallet.walletAddress || wallet.address || 'undefined'}`);
    
    let message = `✅ *New ${networkName} Wallet Created*\n\n`;
    message += `Network: ${networkName}\n`;
    
    // Handle different wallet address property formats
    if (wallet.walletAddress) {
      message += `Address: \`${wallet.walletAddress}\`\n\n`;
    } else if (wallet.address) {
      console.log('[BALANCE] Using wallet.address instead of walletAddress');
      message += `Address: \`${wallet.address}\`\n\n`;
    } else {
      console.error('[BALANCE] Neither walletAddress nor address found in wallet object');
      message += `Address: Not available\n\n`;
    }
    
    message += `Your wallet is ready to receive funds!`;
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
    
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
  } catch (error) {
    console.error(`[BALANCE] Error generating wallet for ${networkName} (ID: ${networkId}):`, error);
    await ctx.reply(
      `❌ Failed to generate wallet: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to wallet settings:', backButtonKeyboard('wallet_settings'));
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