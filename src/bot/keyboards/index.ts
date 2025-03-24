import { Markup } from 'telegraf';
import { Wallet, Balance } from '../../types';

/**
 * Main menu keyboard
 * @returns Inline keyboard markup
 */
export const mainMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 Check Balance', 'balance'),
      Markup.button.callback('💸 Send Funds', 'send'),
    ],
    [
      Markup.button.callback('🏦 Withdraw', 'withdraw'),
      Markup.button.callback('📋 Transaction History', 'history'),
    ],
    [
      Markup.button.callback('👤 Profile', 'profile'),
      Markup.button.callback('❓ Help', 'help'),
    ],
  ]);
};

/**
 * Send funds menu keyboard
 * @returns Inline keyboard markup
 */
export const sendMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📧 Send to Email', 'send_email'),
      Markup.button.callback('🔑 Send to Wallet', 'send_wallet'),
    ],
    [Markup.button.callback('⬅️ Back to Main Menu', 'main_menu')],
  ]);
};

/**
 * Wallets keyboard
 * @param wallets Array of wallets
 * @param actionPrefix Prefix for callback action
 * @returns Inline keyboard markup
 */
export const walletsKeyboard = (wallets: Wallet[], actionPrefix: string) => {
  const buttons = wallets.map((wallet) => {
    const network = wallet.network.toUpperCase();
    const isDefault = wallet.isDefault ? ' (Default)' : '';

    return [
      Markup.button.callback(
        `${network}${isDefault}`,
        `${actionPrefix}_${wallet.id}`,
      ),
    ];
  });

  buttons.push([Markup.button.callback('⬅️ Back', 'main_menu')]);

  return Markup.inlineKeyboard(buttons);
};

/**
 * Networks keyboard
 * @param balances Array of balances
 * @param actionPrefix Prefix for callback action
 * @returns Inline keyboard markup
 */
export const networksKeyboard = (balances: Balance[], actionPrefix: string) => {
  // Get unique networks
  const networks = [...new Set(balances.map((balance) => balance.network))];

  const buttons = networks.map((network) => {
    return [
      Markup.button.callback(
        network.toUpperCase(),
        `${actionPrefix}_${network}`,
      ),
    ];
  });

  buttons.push([Markup.button.callback('⬅️ Back', 'main_menu')]);

  return Markup.inlineKeyboard(buttons);
};

/**
 * Confirmation keyboard
 * @param confirmAction Callback action for confirm
 * @param cancelAction Callback action for cancel
 * @returns Inline keyboard markup
 */
export const confirmationKeyboard = (
  confirmAction: string,
  cancelAction = 'main_menu',
) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm', confirmAction),
      Markup.button.callback('❌ Cancel', cancelAction),
    ],
  ]);
};

/**
 * Back button keyboard
 * @param backAction Callback action for back button
 * @returns Inline keyboard markup
 */
export const backButtonKeyboard = (backAction = 'main_menu') => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Back', backAction)],
  ]);
};

/**
 * Enhanced balance menu keyboard
 * @returns Inline keyboard markup with balance management options
 */
export const balanceMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💼 All Balances', 'balance_all'),
      Markup.button.callback('🔍 By Network', 'balance_networks'),
    ],
    [
      Markup.button.callback('🌐 Wallet Details', 'wallet_details'),
      Markup.button.callback('🔄 Refresh', 'balance_refresh'),
    ],
    [
      Markup.button.callback('⚙️ Wallet Settings', 'wallet_settings'),
      Markup.button.callback('⬅️ Main Menu', 'main_menu'),
    ],
  ]);
};

/**
 * Wallet settings keyboard
 * @returns Inline keyboard markup with wallet settings options
 */
export const walletSettingsKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔄 Set Default Wallet', 'wallet_set_default'),
      Markup.button.callback('📋 View Wallet Address', 'wallet_view_address'),
    ],
    [
      Markup.button.callback('➕ Generate New Wallet', 'wallet_generate'),
      Markup.button.callback('📊 Token Details', 'wallet_token_details'),
    ],
    [Markup.button.callback('⬅️ Back to Balance', 'balance')],
  ]);
};

/**
 * Network selection keyboard with pagination
 * @param networks Array of unique networks
 * @param page Current page number (0-based)
 * @returns Inline keyboard markup with network options and pagination
 */
export const paginatedNetworksKeyboard = (networks: string[], page = 0) => {
  const pageSize = 4; // Show 4 networks per page
  const totalPages = Math.ceil(networks.length / pageSize);
  const startIdx = page * pageSize;
  const endIdx = Math.min(startIdx + pageSize, networks.length);
  const currentPageNetworks = networks.slice(startIdx, endIdx);

  const buttons = currentPageNetworks.map((network) => [
    Markup.button.callback(network.toUpperCase(), `balance_network_${network}`),
  ]);

  // Add pagination controls if needed
  const paginationRow = [];
  if (totalPages > 1) {
    if (page > 0) {
      paginationRow.push(
        Markup.button.callback('⬅️ Prev', `network_page_${page - 1}`),
      );
    }

    paginationRow.push(
      Markup.button.callback(`${page + 1}/${totalPages}`, 'noop'),
    );

    if (page < totalPages - 1) {
      paginationRow.push(
        Markup.button.callback('Next ➡️', `network_page_${page + 1}`),
      );
    }

    buttons.push(paginationRow);
  }

  buttons.push([Markup.button.callback('⬅️ Back to Balance', 'balance')]);

  return Markup.inlineKeyboard(buttons);
};

/**
 * Token selection keyboard for a specific network
 * @param balances Array of balances for the selected network
 * @param network The selected network
 * @returns Inline keyboard markup with token options
 */
export const networkTokensKeyboard = (balances: Balance[], network: string) => {
  const networkBalances = balances.filter((b) => b.network === network);

  const buttons = networkBalances.map((balance) => [
    Markup.button.callback(
      `${balance.token}: ${balance.formattedBalance || balance.balance}`,
      `token_details_${network}_${balance.token}`,
    ),
  ]);

  buttons.push([
    Markup.button.callback('⬅️ Back to Networks', 'balance_networks'),
  ]);

  return Markup.inlineKeyboard(buttons);
};
