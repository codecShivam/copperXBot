import { Markup } from 'telegraf';
import { Wallet } from '../types';
import { formatNetworkForDisplay } from '../utils/networks';
import { ICON } from '../constants';
import { formatNetworkIcon as getNetworkIcon } from '../constants';

// Main menu keyboard
export const mainMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${ICON.balance} Balance`, 'balance'),
      Markup.button.callback(`${ICON.send} Send`, 'send')
    ],
    [
      Markup.button.callback(`${ICON.history} History`, 'history'),
      Markup.button.callback(`${ICON.withdraw} Withdraw`, 'withdraw')
    ],
    [
      Markup.button.callback(`${ICON.profile} Profile`, 'profile'),
      Markup.button.callback(`${ICON.help} Help`, 'help')
    ],
  ]);
};

// Simple back button
export const backButtonKeyboard = (backAction = 'main_menu') => {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`${ICON.back} Back`, backAction)],
  ]);
};

// Simple confirmation keyboard
export const confirmationKeyboard = (
  confirmAction: string,
  cancelAction: string,
) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${ICON.confirm} Confirm`, confirmAction),
      Markup.button.callback(`${ICON.cancel} Cancel`, cancelAction),
    ],
  ]);
};

// Balance menu keyboard
export const balanceMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${ICON.balance} View All Balances`, 'balance_all'),
      Markup.button.callback(`${ICON.refresh} Refresh Balances`, 'balance_refresh')
    ],
    [
      Markup.button.callback(`${ICON.network} View by Network`, 'balance_networks'),
      Markup.button.callback(`${ICON.wallet} Wallet Details`, 'wallet_details')
    ],
    [
      Markup.button.callback(`${ICON.settings} Wallet Settings`, 'wallet_settings'),
      Markup.button.callback(`${ICON.back} Main Menu`, 'main_menu')
    ],
  ]);
};

// Wallet settings keyboard
export const walletSettingsKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${ICON.refresh} Set Default Wallet`, 'wallet_set_default'),
      Markup.button.callback(`${ICON.view} View Wallet Addresses`, 'wallet_view_address')
    ],
    [
      Markup.button.callback(`${ICON.add} Generate New Wallet`, 'wallet_generate'),
      Markup.button.callback(`${ICON.back} Back to Balance`, 'balance')
    ],
  ]);
};

// Send menu keyboard
export const sendMenuKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${ICON.email} Send to Email`, 'send_email'),
      Markup.button.callback(`${ICON.wallet} Send to Wallet Address`, 'send_wallet')
    ],
    [
      Markup.button.callback(`${ICON.send} Batch Payment to Emails`, 'send_batch'),
      Markup.button.callback(`${ICON.back} Main Menu`, 'main_menu')
    ],
  ]);
};

// Paginated networks keyboard
export const paginatedNetworksKeyboard = (networks: string[], page = 0) => {
  const NETWORKS_PER_PAGE = 6; // Increased to show more networks in grid layout
  const startIndex = page * NETWORKS_PER_PAGE;
  const endIndex = startIndex + NETWORKS_PER_PAGE;
  const paginatedNetworks = networks.slice(startIndex, endIndex);

  const buttons = [];
  let currentRow = [];
  
  // Create grid layout with 2 buttons per row
  paginatedNetworks.forEach((network, index) => {
    const networkName = formatNetworkForDisplay(network);
    const networkIcon = getNetworkIcon(networkName);
    
    currentRow.push(
      Markup.button.callback(
        `${networkIcon} ${networkName}`,
        `balance_network_${network}`
      )
    );
    
    // Create a new row after every 2 buttons or at the end
    if (currentRow.length === 2 || index === paginatedNetworks.length - 1) {
      buttons.push([...currentRow]);
      currentRow = [];
    }
  });

  // Add pagination controls if needed
  if (networks.length > NETWORKS_PER_PAGE) {
    const paginationButtons = [];

    if (page > 0) {
      paginationButtons.push(
        Markup.button.callback(
          `${ICON.back} Previous`,
          `network_page_${page - 1}`
        )
      );
    }

    if (endIndex < networks.length) {
      paginationButtons.push(
        Markup.button.callback(`Next ${ICON.next}`, `network_page_${page + 1}`)
      );
    }

    if (paginationButtons.length > 0) {
      buttons.push(paginationButtons);
    }
  }

  // Add back button
  buttons.push([
    Markup.button.callback(`${ICON.back} Back to Balance`, 'balance')
  ]);

  return Markup.inlineKeyboard(buttons);
};

// Network tokens keyboard
export const networkTokensKeyboard = (networkBalances, network: string) => {
  const buttons = [];
  let currentRow = [];
  
  // Create grid layout with 2 buttons per row
  networkBalances.forEach((balance, index) => {
    currentRow.push(
      Markup.button.callback(
        `${ICON.token} ${balance.token} (${balance.formattedBalance})`,
        `token_details_${network}_${balance.token}`
      )
    );
    
    // Create a new row after every 2 buttons or at the end
    if (currentRow.length === 2 || index === networkBalances.length - 1) {
      buttons.push([...currentRow]);
      currentRow = [];
    }
  });

  // Add back button
  buttons.push([
    Markup.button.callback(`${ICON.back} Back to Networks`, 'balance_networks')
  ]);

  return Markup.inlineKeyboard(buttons);
};

// Wallets keyboard for operations like setting default
export const walletsKeyboard = (wallets: Wallet[], action: string) => {
  const buttons = [];
  let currentRow = [];
  
  // Create grid layout with 2 buttons per row
  wallets.forEach((wallet, index) => {
    const networkName = formatNetworkForDisplay(wallet.network);
    const networkIcon = getNetworkIcon(networkName);
    const defaultMark = wallet.isDefault ? ' ★' : '';
    
    currentRow.push(
      Markup.button.callback(
        `${networkIcon} ${networkName}${defaultMark}`,
        `${action}_${wallet.id}`
      )
    );
    
    // Create a new row after every 2 buttons or at the end
    if (currentRow.length === 2 || index === wallets.length - 1) {
      buttons.push([...currentRow]);
      currentRow = [];
    }
  });

  // Add back button
  buttons.push([
    Markup.button.callback(
      `${ICON.back} Back to Wallet Settings`,
      'wallet_settings'
    ),
  ]);

  return Markup.inlineKeyboard(buttons);
};

// Helper function to get network-specific icons
// function getNetworkIcon(network: string): string {
//   const networkLower = network.toLowerCase();

//   if (networkLower.includes('ethereum')) return ICON.ethereum;
//   if (networkLower.includes('polygon')) return ICON.polygon;
//   if (networkLower.includes('arbitrum')) return ICON.arbitrum;
//   if (networkLower.includes('optimism')) return ICON.optimism;
//   if (networkLower.includes('base')) return ICON.base;
//   if (networkLower.includes('bnb')) return ICON.bnb;

//   return ICON.network; // Default network icon
// }
