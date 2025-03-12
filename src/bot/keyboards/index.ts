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