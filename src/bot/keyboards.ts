import { Markup } from 'telegraf';
import { Wallet } from '../types';
import { formatNetworkForDisplay } from '../utils/networks';

// Main menu keyboard
export const mainMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💰 Balance', 'balance')],
    [Markup.button.callback('💸 Send', 'send')],
    [Markup.button.callback('📥 Receive', 'receive')],
    [Markup.button.callback('📊 History', 'history')],
    [Markup.button.callback('🏦 Withdraw', 'withdraw')],
    [Markup.button.callback('👤 Profile', 'profile')],
    [Markup.button.callback('❓ Help', 'help')],
  ]);
};

// Simple back button
export const backButtonKeyboard = (backAction = 'main_menu') => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Back', backAction)],
  ]);
};

// Simple confirmation keyboard
export const confirmationKeyboard = (
  confirmAction: string,
  cancelAction: string
) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm', confirmAction),
      Markup.button.callback('❌ Cancel', cancelAction),
    ],
  ]);
};

// Balance menu keyboard
export const balanceMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💰 View All Balances', 'balance_all')],
    [Markup.button.callback('🔄 Refresh Balances', 'balance_refresh')],
    [Markup.button.callback('🌐 View by Network', 'balance_networks')],
    [Markup.button.callback('💼 Wallet Details', 'wallet_details')],
    [Markup.button.callback('⚙️ Wallet Settings', 'wallet_settings')],
    [Markup.button.callback('⬅️ Main Menu', 'main_menu')],
  ]);
};

// Wallet settings keyboard
export const walletSettingsKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Set Default Wallet', 'wallet_set_default')],
    [Markup.button.callback('👁️ View Wallet Addresses', 'wallet_view_address')],
    [Markup.button.callback('➕ Generate New Wallet', 'wallet_generate')],
    [Markup.button.callback('⬅️ Back to Balance', 'balance')],
  ]);
};

// Send menu keyboard
export const sendMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📧 Send to Email', 'send_email')],
    [Markup.button.callback('💼 Send to Wallet Address', 'send_wallet')],
    [Markup.button.callback('⬅️ Main Menu', 'main_menu')],
  ]);
};

// Paginated networks keyboard
export const paginatedNetworksKeyboard = (networks: string[], page = 0) => {
  const NETWORKS_PER_PAGE = 5;
  const startIndex = page * NETWORKS_PER_PAGE;
  const endIndex = startIndex + NETWORKS_PER_PAGE;
  const paginatedNetworks = networks.slice(startIndex, endIndex);
  
  const buttons = paginatedNetworks.map(network => [
    Markup.button.callback(
      formatNetworkForDisplay(network), // Use user-friendly network name for display
      `balance_network_${network}`      // Keep network ID/name in the callback data
    )
  ]);
  
  // Add pagination controls if needed
  if (networks.length > NETWORKS_PER_PAGE) {
    const paginationButtons = [];
    
    if (page > 0) {
      paginationButtons.push(
        Markup.button.callback('⬅️ Previous', `network_page_${page - 1}`)
      );
    }
    
    if (endIndex < networks.length) {
      paginationButtons.push(
        Markup.button.callback('➡️ Next', `network_page_${page + 1}`)
      );
    }
    
    if (paginationButtons.length > 0) {
      buttons.push(paginationButtons);
    }
  }
  
  // Add back button
  buttons.push([Markup.button.callback('⬅️ Back to Balance', 'balance')]);
  
  return Markup.inlineKeyboard(buttons);
};

// Network tokens keyboard
export const networkTokensKeyboard = (networkBalances, network: string) => {
  const buttons = networkBalances.map(balance => [
    Markup.button.callback(
      `${balance.token} (${balance.formattedBalance})`,
      `token_details_${network}_${balance.token}`
    )
  ]);
  
  // Add back button
  buttons.push([Markup.button.callback('⬅️ Back to Networks', 'balance_networks')]);
  
  return Markup.inlineKeyboard(buttons);
};

// Wallets keyboard for operations like setting default
export const walletsKeyboard = (wallets: Wallet[], action: string) => {
  const buttons = wallets.map(wallet => [
    Markup.button.callback(
      `${formatNetworkForDisplay(wallet.network)}${wallet.isDefault ? ' (Default)' : ''}`,
      `${action}_${wallet.id}`
    )
  ]);
  
  // Add back button
  buttons.push([Markup.button.callback('⬅️ Back to Wallet Settings', 'wallet_settings')]);
  
  return Markup.inlineKeyboard(buttons);
}; 