import { Composer } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext } from '../../types';
import { walletApi, transfersApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { backButtonKeyboard, confirmationKeyboard } from '../keyboards';
import { getSession, setTempData, getTempData, clearTempData } from '../../utils/session';
import { formatAmount } from '../../utils/format';

// Withdraw command handler
const withdrawCommand = Composer.command('withdraw', authMiddleware(), async (ctx) => {
  await startWithdrawal(ctx);
});

// Withdraw action handler
const withdrawAction = Composer.action('withdraw', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await startWithdrawal(ctx);
});

// Helper function to start withdrawal process
async function startWithdrawal(ctx) {
  try {
    // Clear any previous temp data
    clearTempData(ctx);
    
    await ctx.reply(
      '🏦 *Withdraw to Bank Account*\n\n' +
      'This feature allows you to withdraw funds to your bank account.\n\n' +
      '⚠️ *Note:* Bank withdrawals require KYC approval and a linked bank account. ' +
      'If you haven\'t completed these steps, please visit the Copperx web app first.',
      {
        parse_mode: 'Markdown',
      },
    );
    
    // Get token from session
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Fetch balances - walletApi.getBalances now returns the array directly
    const balances = await walletApi.getBalances(token);
    console.log(`[WITHDRAW] Fetched ${balances.length} wallets with balances`);
    
    if (!balances || balances.length === 0) {
      await ctx.reply(
        '❌ You don\'t have any tokens in your wallets. Please deposit funds first.',
      );
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }
    
    // Get unique networks
    const networks = [...new Set(balances.map((balance) => balance.network))];
    
    // Store networks in session
    setTempData(ctx, 'networks', networks);
    
    // Ask for network
    let message = '🌐 *Select Network*\n\nPlease enter the number of the network you want to use:\n\n';
    
    networks.forEach((network, index) => {
      message += `${index + 1}. ${String(network).toUpperCase()}\n`;
    });
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
    });
    
    // Set current step
    session.currentStep = 'withdraw_network';
  } catch (error) {
    console.error('Error starting withdrawal:', error);
    await ctx.reply(
      `❌ Failed to start withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  }
}

// Handle withdrawal flow 
const withdrawFlow = Composer.on(message('text'), async (ctx, next) => {
  // Skip if not in withdraw flow
  const session = getSession(ctx);
  if (!session?.currentStep?.startsWith('withdraw_')) {
    return next();
  }
  
  const text = ctx.message.text.trim();
  
  // Handle network selection
  if (session.currentStep === 'withdraw_network') {
    const networks = getTempData(ctx, 'networks') as string[];
    
    // Validate network selection
    const networkIndex = parseInt(text, 10) - 1;
    if (isNaN(networkIndex) || networkIndex < 0 || networkIndex >= networks.length) {
      await ctx.reply(`❌ Invalid selection. Please enter a number between 1 and ${networks.length}:`);
      return;
    }
    
    const selectedNetwork = networks[networkIndex];
    
    // Store selected network
    setTempData(ctx, 'network', selectedNetwork);
    
    // Fetch tokens for the selected network
    try {
      // walletApi.getBalances now returns the array directly
      const walletData = await walletApi.getBalances(session.token as string);
      console.log(`[WITHDRAW] Fetched ${walletData.length} wallets with balances for token selection`);
      
      // Filter wallets by network and extract tokens
      const networkWallets = walletData.filter(wallet => wallet.network === selectedNetwork);
      
      // Extract all tokens from these wallets
      const tokenList: { symbol: string, balance: string, decimals: number, address: string }[] = [];
      
      networkWallets.forEach(wallet => {
        if (wallet.balances && Array.isArray(wallet.balances)) {
          wallet.balances.forEach(tokenBalance => {
            // Check if token already exists in our list (from another wallet)
            const existingToken = tokenList.find(t => t.symbol === tokenBalance.symbol);
            
            if (existingToken) {
              // Add balances for existing token
              const existingBalance = parseFloat(existingToken.balance) || 0;
              const newBalance = parseFloat(tokenBalance.balance) || 0;
              existingToken.balance = (existingBalance + newBalance).toString();
            } else {
              // Add new token to the list
              tokenList.push(tokenBalance);
            }
          });
        }
      });
      
      // Store tokens in session
      setTempData(ctx, 'tokens', tokenList.map(token => token.symbol));
      
      // Ask for token
      let message = '💰 *Select Token*\n\nPlease enter the number of the token you want to withdraw:\n\n';
      
      tokenList.forEach((token, index) => {
        const formattedBalance = formatAmount(token.balance);
        message += `${index + 1}. ${token.symbol} (Balance: ${formattedBalance})\n`;
      });
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
      });
      
      // Update step
      session.currentStep = 'withdraw_token';
    } catch (error) {
      console.error('Error fetching tokens:', error);
      await ctx.reply(
        `❌ Failed to fetch tokens: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      );
      session.currentStep = undefined;
      await ctx.reply('Return to main menu:', backButtonKeyboard());
    }
    return;
  }
  
  // Handle token selection
  if (session.currentStep === 'withdraw_token') {
    const tokens = getTempData(ctx, 'tokens') as string[];
    
    // Validate token selection
    const tokenIndex = parseInt(text, 10) - 1;
    if (isNaN(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokens.length) {
      await ctx.reply(`❌ Invalid selection. Please enter a number between 1 and ${tokens.length}:`);
      return;
    }
    
    const selectedToken = tokens[tokenIndex];
    
    // Store selected token
    setTempData(ctx, 'token', selectedToken);
    
    // Ask for amount
    await ctx.reply(
      '💲 *Enter Amount*\n\nPlease enter the amount you want to withdraw:',
      {
        parse_mode: 'Markdown',
      },
    );
    
    // Update step
    session.currentStep = 'withdraw_amount';
    return;
  }
  
  // Handle amount input
  if (session.currentStep === 'withdraw_amount') {
    // Validate amount format (numeric)
    if (!/^\d+(\.\d+)?$/.test(text)) {
      await ctx.reply('❌ Invalid amount format. Please enter a numeric amount:');
      return;
    }
    
    const inputAmount = parseFloat(text);
    
    // Validate amount is positive
    if (inputAmount <= 0) {
      await ctx.reply('❌ Amount must be greater than zero. Please enter a valid amount:');
      return;
    }
    
    // Store amount
    setTempData(ctx, 'amount', text);
    
    // For simplicity, we'll use a placeholder bank account ID
    // In a real implementation, you would fetch the user's bank accounts and let them choose
    
    await ctx.reply(
      '🏦 *Bank Account*\n\n' +
      'For this demo, we\'ll use your default bank account.\n\n' +
      '⚠️ *Note:* In a production environment, you would be able to select from your linked bank accounts.',
      {
        parse_mode: 'Markdown',
      },
    );
    
    // Set a placeholder bank account ID
    setTempData(ctx, 'bankAccountId', 'default_bank_account_id');
    
    // Show confirmation
    const networkValue = getTempData(ctx, 'network') as string;
    const tokenValue = getTempData(ctx, 'token') as string;
    const withdrawAmount = getTempData(ctx, 'amount') as string;
    const bankAccountId = getTempData(ctx, 'bankAccountId') as string;
    
    let message = '✅ *Confirm Withdrawal*\n\n';
    
    message += `*Type:* Bank Withdrawal\n`;
    message += `*Network:* ${String(networkValue).toUpperCase()}\n`;
    message += `*Token:* ${tokenValue}\n`;
    message += `*Amount:* ${withdrawAmount}\n`;
    message += `*Bank Account:* Default Account\n\n`;
    
    message += '⚠️ *Note:* Bank withdrawals may take 1-3 business days to process.\n\n';
    message += 'Please confirm this withdrawal:';
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...confirmationKeyboard('withdraw_confirm', 'withdraw_cancel'),
    });
    
    // Update step
    session.currentStep = 'withdraw_confirm';
    return;
  }
  
  return next();
});

// Handle withdraw confirmation
const withdrawConfirmAction = Composer.action('withdraw_confirm', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  const networkValue = getTempData(ctx as any, 'network') as string;
  const tokenValue = getTempData(ctx as any, 'token') as string;
  const withdrawAmount = getTempData(ctx as any, 'amount') as string;
  const bankAccountId = getTempData(ctx as any, 'bankAccountId') as string;
  
  try {
    await ctx.reply('🔄 Processing your withdrawal...');
    
    // Get token from session
    const authToken = getSession(ctx).token as string;
    
    // In a real implementation, this would call the actual API
    // For demo purposes, we'll simulate a successful response
    
    await ctx.reply(
      '✅ *Withdrawal Request Submitted*\n\n' +
      'Your withdrawal request has been submitted successfully.\n\n' +
      '⚠️ *Note:* This is a demo implementation. In a production environment, ' +
      'this would initiate a real bank withdrawal.\n\n' +
      'Bank withdrawals typically take 1-3 business days to process.',
      {
        parse_mode: 'Markdown',
      },
    );
    
    // Clear temp data
    clearTempData(ctx as any);
    
    // Reset step
    getSession(ctx).currentStep = undefined;
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    await ctx.reply(
      `❌ Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
    );
    
    // Reset step
    getSession(ctx).currentStep = undefined;
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  }
});

// Handle withdraw cancellation
const withdrawCancelAction = Composer.action('withdraw_cancel', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  // Clear temp data
  clearTempData(ctx as any);
  
  // Reset step
  getSession(ctx).currentStep = undefined;
  
  await ctx.reply('❌ Withdrawal cancelled.');
  await ctx.reply('Return to main menu:', backButtonKeyboard());
});

export default Composer.compose([
  withdrawCommand,
  withdrawAction,
  withdrawFlow,
  withdrawConfirmAction,
  withdrawCancelAction,
]); 