import { Composer, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import { v4 as uuidv4 } from 'uuid';
import { BotContext } from '../../types';
import { walletApi, transfersApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { sendMenuKeyboard, backButtonKeyboard, confirmationKeyboard } from '../keyboards';
import { getSession, clearTempData, setTempData, getTempData } from '../../utils/session';
import { formatAmount } from '../../utils/format';
import { formatNetworkForDisplay } from '../../utils/networks';
import { validateWalletAddress, validateEmailFormat, checkEmailTypos } from '../../utils/validation';
import { formatLoading, formatHeader, ICON } from '../../constants';

// Simple fee estimation function for withdrawals
async function estimateFees(authToken: string, amount: string, currency: string, transferType: string): Promise<{
  success: boolean;
  data: {
    estimatedFees: {
      fixedFee: string;
      percentage: string;
      processingFee: string;
      totalFee: string;
      estimatedReceiveAmount: string;
    }
  }
}> {
  try {
    // We only calculate fees for bank withdrawals (offramp)
    if (transferType !== 'bank') {
      console.log(`[SEND] No fee estimation needed for ${transferType} transfers`);
      
      // For non-bank transfers, return zero fees
      return {
        success: true,
        data: {
          estimatedFees: {
            fixedFee: "0.00",
            percentage: "0",
            processingFee: "0.00",
            totalFee: "0.00",
            estimatedReceiveAmount: amount,
          }
        }
      };
    }
    
    // Bank withdrawal fee calculation
    console.log(`[SEND] Estimating bank withdrawal fees for ${amount} ${currency}`);
    
    const amountNum = parseFloat(amount);
    
    // Updated fee structure for bank withdrawals
    const fixedFee = "2.00"; // $2 USD fixed fee
    const percentageFee = "1.5"; // 1.5% processing fee
    
    // Calculate processing fee (1.5%)
    const processingFeeValue = amountNum * 0.015; // 1.5%
    const processingFee = processingFeeValue.toFixed(2);
    
    // Calculate total fee
    const totalFeeValue = parseFloat(fixedFee) + processingFeeValue;
    const totalFee = totalFeeValue.toFixed(2);
    
    // Calculate estimated receive amount
    const estimatedReceiveValue = amountNum - totalFeeValue;
    const estimatedReceiveAmount = estimatedReceiveValue > 0 ? estimatedReceiveValue.toFixed(2) : "0.00";
    
    console.log(`[SEND] Bank withdrawal fee calculation:
      Amount: ${amountNum}
      Fixed fee: ${fixedFee}
      Percentage: ${percentageFee}%
      Processing fee: ${processingFee}
      Total fee: ${totalFee}
      Estimated receive: ${estimatedReceiveAmount}`);
    
    return {
      success: true,
      data: {
        estimatedFees: {
          fixedFee,
          percentage: percentageFee,
          processingFee,
          totalFee,
          estimatedReceiveAmount,
        }
      }
    };
  } catch (error) {
    console.error(`[SEND] Error estimating fees:`, error);
    
    // Return default values on error
    return {
      success: false,
      data: {
        estimatedFees: {
          fixedFee: transferType === 'bank' ? "2.00" : "0.00",
          percentage: transferType === 'bank' ? "1.5" : "0",
          processingFee: "0.00",
          totalFee: transferType === 'bank' ? "2.00" : "0.00",
          estimatedReceiveAmount: amount,
        }
      }
    };
  }
}

// Send command handler
const sendCommand = Composer.command('send', authMiddleware(), async (ctx) => {
  await showSendMenu(ctx);
});

// Send action handler
const sendAction = Composer.action('send', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await showSendMenu(ctx);
});

// Helper function to show send menu
async function showSendMenu(ctx) {
  await ctx.reply(
    '💸 *Send Funds*\n\nPlease select how you would like to send funds:',
    {
      parse_mode: 'Markdown',
      ...sendMenuKeyboard(),
    },
  );
}

// Handle send to email action
const sendEmailAction = Composer.action('send_email', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  // Clear any previous data
  clearTempData(ctx as any);
  
  // Set transfer type
  setTempData(ctx as any, 'transferType', 'email');
  
  // Show email input prompt
  await ctx.reply(
    '📧 *Send to Email*\n\nPlease enter the recipient\'s email address:',
    {
      parse_mode: 'Markdown',
    },
  );
  
  // Set current step
  getSession(ctx).currentStep = 'send_email_recipient';
});

// Handle send to wallet action
const sendWalletAction = Composer.action('send_wallet', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  // Clear any previous data
  clearTempData(ctx as any);
  
  // Set transfer type
  setTempData(ctx as any, 'transferType', 'wallet');
  
  // Show wallet input prompt
  await ctx.reply(
    '💼 *Send to Wallet*\n\nPlease enter the recipient\'s wallet address:',
    {
      parse_mode: 'Markdown',
    },
  );
  
  // Set current step
  getSession(ctx).currentStep = 'send_wallet_recipient';
});

// Handle send flow
const sendFlow = Composer.on(message('text'), async (ctx, next) => {
  // Skip if not in send flow
  const session = getSession(ctx);
  if (!session?.currentStep?.startsWith('send_')) {
    return next();
  }
  
  const text = ctx.message.text.trim();
  
  // Handle email recipient input
  if (session.currentStep === 'send_email_recipient') {
    // Validate email format using our validation utility
    if (!validateEmailFormat(text)) {
      await ctx.reply('❌ Invalid email format. Please enter a valid email address:');
      return;
    }
    
    // Check for potential typos in email domain
    const typoCheck = checkEmailTypos(text);
    if (typoCheck.hasTypo && typoCheck.suggestion) {
      await ctx.reply(
        `⚠️ Did you mean *${typoCheck.suggestion}*? If yes, please enter the corrected email. If no, just continue.`,
        { parse_mode: 'Markdown' }
      );
      // Don't return here - we still allow the user to proceed with the potentially misspelled email
    }
    
    // Store recipient email
    setTempData(ctx, 'recipient', text);
    setTempData(ctx, 'transferType', 'email');
    
    // Fetch networks for the next step
    try {
      // walletApi.getBalances now returns the array directly
      const balances = await walletApi.getBalances(session.token as string);
      console.log(`[SEND] Fetched ${balances.length} wallets with balances`);
      
      if (!balances || balances.length === 0) {
        await ctx.reply(
          '❌ You don\'t have any tokens in your wallets. Please deposit funds first.',
        );
        session.currentStep = undefined;
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
        message += `${index + 1}. ${formatNetworkForDisplay(network)}\n`;
      });
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
      });
      
      // Update step
      session.currentStep = 'send_network';
    } catch (error) {
      console.error('Error fetching networks:', error);
      await ctx.reply(
        `❌ Failed to fetch networks: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      );
      session.currentStep = undefined;
      await ctx.reply('Return to main menu:', backButtonKeyboard());
    }
    return;
  }
  
  // Handle wallet recipient input
  if (session.currentStep === 'send_wallet_recipient') {
    // Fetch networks to validate the address against the correct blockchain format
    try {
      // walletApi.getBalances now returns the array directly
      const balances = await walletApi.getBalances(session.token as string);
      console.log(`[SEND] Fetched ${balances.length} wallets with balances for address validation`);
      
      if (!balances || balances.length === 0) {
        await ctx.reply(
          '❌ You don\'t have any tokens in your wallets. Please deposit funds first.',
        );
        session.currentStep = undefined;
        await ctx.reply('Return to main menu:', backButtonKeyboard());
        return;
      }
      
      // Get unique networks 
      const networks = [...new Set(balances.map((balance) => balance.network))];
      
      // Check if the address is valid for any of the user's networks
      let isValidForAnyNetwork = false;
      let validNetworks = [];
      
      for (const network of networks) {
        const isValid = validateWalletAddress(text, network);
        if (isValid) {
          isValidForAnyNetwork = true;
          validNetworks.push(network);
          console.log(`[SEND] Address ${text.substring(0, 10)}... is valid for ${network}`);
        }
      }
      
      if (!isValidForAnyNetwork) {
        console.log(`[SEND] Address ${text.substring(0, 10)}... is not valid for any network: ${networks.join(', ')}`);
        await ctx.reply('❌ Invalid wallet address. The address format doesn\'t match any of your available networks. Please enter a valid address:');
        return;
      }
      
      // If valid for multiple networks, we can either:
      // 1. Let the user proceed and select the network later (current approach)
      // 2. Or restrict to only valid networks (possible enhancement)
      
      if (validNetworks.length > 0) {
        console.log(`[SEND] Address ${text.substring(0, 10)}... is valid for networks: ${validNetworks.join(', ')}`);
      }
      
      // Store recipient address
      setTempData(ctx, 'recipient', text);
      
      // Store networks in session
      setTempData(ctx, 'networks', networks);
      
      // Ask for network
      let message = '🌐 *Select Network*\n\nPlease enter the number of the network you want to use:\n\n';
      
      networks.forEach((network, index) => {
        const isValidForNetwork = validNetworks.includes(network);
        // Add an indicator if the address is valid for this network
        const validityIndicator = isValidForNetwork ? '✅' : '⚠️';
        message += `${index + 1}. ${validityIndicator} ${formatNetworkForDisplay(network)}\n`;
      });
      
      message += '\n⚠️ Warning: Sending to an invalid address may result in permanent loss of funds. Double-check the address and network before proceeding.';
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
      });
      
      // Update step
      session.currentStep = 'send_network';
    } catch (error) {
      console.error('Error validating wallet address:', error);
      await ctx.reply(
        `❌ Failed to validate wallet address: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      );
      session.currentStep = undefined;
      await ctx.reply('Return to main menu:', backButtonKeyboard());
    }
    return;
  }
  
  // Handle network selection
  if (session.currentStep === 'send_network') {
    const networks = getTempData(ctx, 'networks') as string[];
    
    // Validate network selection
    const networkIndex = parseInt(text, 10) - 1;
    if (isNaN(networkIndex) || networkIndex < 0 || networkIndex >= networks.length) {
      await ctx.reply(`❌ Invalid selection. Please enter a number between 1 and ${networks.length}:`);
      return;
    }
    
    const selectedNetwork = networks[networkIndex];
    const recipientAddress = getTempData(ctx, 'recipient') as string;
    const transferType = getTempData(ctx, 'transferType') as string;
    
    // For wallet transfers, validate the address against the selected network
    if (transferType === 'wallet') {
      const isValidAddress = validateWalletAddress(recipientAddress, selectedNetwork);
      if (!isValidAddress) {
        await ctx.reply(
          `⚠️ *Warning: Address may be invalid for ${formatNetworkForDisplay(selectedNetwork)}*\n\nSending to an incorrect address may result in permanent loss of funds. Do you want to:\n\n1. Continue anyway\n2. Enter a new address\n3. Cancel`,
          { parse_mode: 'Markdown' }
        );
        setTempData(ctx, 'pendingNetwork', selectedNetwork);
        session.currentStep = 'send_address_warning_response';
        return;
      }
    }
    
    // Store selected network
    setTempData(ctx, 'network', selectedNetwork);
    
    // Proceed with fetching tokens for the selected network
    try {
      // walletApi.getBalances now returns the array directly
      const walletData = await walletApi.getBalances(session.token as string);
      console.log(`[SEND] Fetched ${walletData.length} wallets with balances for token selection`);
      
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
      let message = '💰 *Select Token*\n\nPlease enter the number of the token you want to send:\n\n';
      
      tokenList.forEach((token, index) => {
        const formattedBalance = formatAmount(token.balance);
        message += `${index + 1}. ${token.symbol} (Balance: ${formattedBalance})\n`;
      });
      
      await ctx.reply(message, {
        parse_mode: 'Markdown',
      });
      
      // Update step
      session.currentStep = 'send_token';
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
  
  // Handle address warning response (new step)
  if (session.currentStep === 'send_address_warning_response') {
    const response = text.trim().toLowerCase();
    
    if (response === '1' || response === 'continue' || response === 'continue anyway') {
      // User wants to continue despite the warning
      const selectedNetwork = getTempData(ctx, 'pendingNetwork') as string;
      setTempData(ctx, 'network', selectedNetwork);
      
      // Continue with fetching tokens for the selected network
      try {
        // walletApi.getBalances now returns the array directly
        const walletData = await walletApi.getBalances(session.token as string);
        console.log(`[SEND] Fetched ${walletData.length} wallets with balances for token selection`);
        
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
        let message = '💰 *Select Token*\n\nPlease enter the number of the token you want to send:\n\n';
        
        tokenList.forEach((token, index) => {
          const formattedBalance = formatAmount(token.balance);
          message += `${index + 1}. ${token.symbol} (Balance: ${formattedBalance})\n`;
        });
        
        await ctx.reply(message, {
          parse_mode: 'Markdown',
        });
        
        // Update step
        session.currentStep = 'send_token';
      } catch (error) {
        console.error('Error fetching tokens:', error);
        await ctx.reply(
          `❌ Failed to fetch tokens: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
        );
        session.currentStep = undefined;
        await ctx.reply('Return to main menu:', backButtonKeyboard());
      }
    } else if (response === '2' || response === 'enter' || response === 'new' || response === 'enter new address') {
      // User wants to enter a new address
      await ctx.reply(
        '💼 *Send to Wallet*\n\nPlease enter the recipient\'s wallet address:',
        {
          parse_mode: 'Markdown',
        },
      );
      session.currentStep = 'send_wallet_recipient';
    } else if (response === '3' || response === 'cancel') {
      // User wants to cancel
      clearTempData(ctx as any);
      session.currentStep = undefined;
      await ctx.reply('❌ Transaction cancelled.');
      await ctx.reply('Return to main menu:', backButtonKeyboard());
    } else {
      // Invalid response
      await ctx.reply('Please enter 1, 2, or 3 to select an option:');
    }
    return;
  }
  
  // Handle token selection
  if (session.currentStep === 'send_token') {
    const tokens = getTempData(ctx, 'tokens') as string[];
    
    // Validate token selection
    const tokenIndex = parseInt(text, 10) - 1;
    if (isNaN(tokenIndex) || tokenIndex < 0 || tokenIndex >= tokens.length) {
      await ctx.reply(`❌ Invalid selection. Please enter a number between 1 and ${tokens.length}:`);
      return;
    }
    
    const selectedToken = tokens[tokenIndex];
    const selectedNetwork = getTempData(ctx, 'network') as string;
    
    // Log with network name for debugging
    console.log(`[SEND] Selected token ${selectedToken} on ${formatNetworkForDisplay(selectedNetwork)}`);
    
    // Store selected token
    setTempData(ctx, 'token', selectedToken);
    
    // Ask for amount
    await ctx.reply(
      `💲 *Enter Amount*\n\nPlease enter the amount of ${selectedToken} you want to send from ${formatNetworkForDisplay(selectedNetwork)}:`,
      {
        parse_mode: 'Markdown',
      },
    );
    
    // Update step
    session.currentStep = 'send_amount';
    return;
  }
  
  // Handle amount input
  if (session.currentStep === 'send_amount') {
    // Validate amount format
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('❌ Invalid amount. Please enter a positive number:');
      return;
    }
    
    try {
      // Store the original amount as entered by the user
      // The API layer will handle the multiplication by 10^8
      setTempData(ctx, 'amount', amount.toString());
      setTempData(ctx, 'displayAmount', text); // Original user input for display
      
      console.log(`[SEND] User entered amount: ${amount} - will be multiplied by 10^8 in API layer`);
      
      // Ask for note (optional)
      await ctx.reply(
        '📝 *Add Note (Optional)*\n\nPlease enter a note for this transaction, or type "skip" to continue without a note:',
        {
          parse_mode: 'Markdown',
        },
      );
      
      // Update step
      session.currentStep = 'send_note';
    } catch (error) {
      console.error('[SEND] Error handling amount:', error);
      await ctx.reply('❌ Invalid amount format. Please try a different amount:');
    }
    return;
  }
  
  // Handle note input
  if (session.currentStep === 'send_note') {
    // Store note if not "skip"
    if (text.toLowerCase() !== 'skip') {
      setTempData(ctx, 'note', text);
    }
    
    // Show confirmation with fee estimation
    const transferType = getTempData(ctx, 'transferType') as string;
    const recipient = getTempData(ctx, 'recipient') as string;
    const network = getTempData(ctx, 'network') as string;
    const token = getTempData(ctx, 'token') as string;
    const amount = getTempData(ctx, 'amount') as string;
    const displayAmount = getTempData(ctx, 'displayAmount') as string;
    const note = getTempData(ctx, 'note') as string;
    
    // Additional security check - confirm again if amount is large
    const numericAmount = parseFloat(displayAmount);
    const isLargeAmount = numericAmount > 100; // Threshold for "large" amounts
    
    if (isLargeAmount) {
      // Add a confirmation step for large amounts
      await ctx.reply(
        `⚠️ *Large Transaction Alert*\n\n` +
        `You're about to send ${displayAmount} ${token}.\n\n` +
        `Please verify this amount is correct before proceeding.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                Markup.button.callback('Yes, the amount is correct', 'confirm_amount'),
                Markup.button.callback('No, cancel transaction', 'send_cancel')
              ]
            ]
          }
        }
      );
      
      // Set step to wait for large amount confirmation
      session.currentStep = 'send_confirm_large_amount';
      return;
    }
    
    // For regular amounts, show fee estimation and confirmation
    await displayTransactionConfirmation(ctx);
  }
  
  return next();
});

// Add a helper function to display transaction confirmation with fees
async function displayTransactionConfirmation(ctx) {
  const transferType = getTempData(ctx, 'transferType') as string;
  const recipient = getTempData(ctx, 'recipient') as string;
  const network = getTempData(ctx, 'network') as string;
  const token = getTempData(ctx, 'token') as string;
  const amount = getTempData(ctx, 'amount') as string;
  const displayAmount = getTempData(ctx, 'displayAmount') as string;
  const note = getTempData(ctx, 'note') as string;
  
  try {
    // Get auth token
    const authToken = getSession(ctx).token as string;
    
    // Build basic confirmation message
    let message = '✅ *Confirm Transaction*\n\n';
    
    if (transferType === 'email') {
      message += `*Type:* Send to Email\n`;
      message += `*Recipient:* ${recipient}\n`;
    } else if (transferType === 'wallet') {
      message += `*Type:* Send to Wallet\n`;
      message += `*Recipient:* ${recipient}\n`;
    } else if (transferType === 'bank') {
      message += `*Type:* Withdraw to Bank\n`;
      message += `*Recipient:* ${recipient}\n`;
      
      // Only show loading for bank withdrawals that need fee calculation
      const loadingMsg = await ctx.reply(
        formatLoading('Calculating withdrawal fees...'),
        { parse_mode: 'Markdown' }
      );
      
      // Get fee estimate for bank withdrawals
      const feeEstimate = await estimateFees(authToken, amount, token, transferType);
      
      // Try to delete the loading message
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (error) {
        console.warn('[SEND] Could not delete loading message:', error);
      }
      
      // Add fee details for bank withdrawals
      if (feeEstimate.success && feeEstimate.data) {
        message += `\n*Fee Details (Bank Withdrawal):*\n`;
        message += `*Fixed Fee:* $${feeEstimate.data.estimatedFees.fixedFee}\n`;
        message += `*Processing Fee (1.5%):* $${feeEstimate.data.estimatedFees.processingFee}\n`;
        message += `*Total Fee:* $${feeEstimate.data.estimatedFees.totalFee}\n`;
        message += `*You will receive:* $${feeEstimate.data.estimatedFees.estimatedReceiveAmount}\n`;
      }
    }
    
    // Common transaction details for all types
    message += `*Network:* ${formatNetworkForDisplay(network)}\n`;
    message += `*Token:* ${token}\n`;
    message += `*Amount:* ${displayAmount}\n`;
    
    // For wallet and email transfers, we don't show fee details
    if (transferType !== 'bank') {
      message += `\n*Note:* No fees are charged for ${transferType === 'email' ? 'email' : 'wallet'} transfers.\n`;
    }
    
    if (note) {
      message += `\n*Transaction Note:* ${note}\n`;
    }
    
    message += '\nPlease confirm this transaction:';
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...confirmationKeyboard('send_confirm', 'send_cancel'),
    });
    
    // Update step
    getSession(ctx).currentStep = 'send_confirm';
  } catch (error) {
    console.error('[SEND] Error in transaction confirmation:', error);
    
    // Proceed with confirmation even if fee estimate fails
    let message = '✅ *Confirm Transaction*\n\n';
    
    if (transferType === 'email') {
      message += `*Type:* Send to Email\n`;
      message += `*Recipient:* ${recipient}\n`;
    } else if (transferType === 'wallet') {
      message += `*Type:* Send to Wallet\n`;
      message += `*Recipient:* ${recipient}\n`;
    } else if (transferType === 'bank') {
      message += `*Type:* Withdraw to Bank\n`;
      message += `*Recipient:* ${recipient}\n`;
      
      // Add note about fees for bank transfers
      message += `\n*Bank Withdrawal Fees:*\n`;
      message += `- Fixed Fee: $2.00\n`;
      message += `- Processing Fee: 1.5% of amount\n`;
    }
    
    message += `*Network:* ${formatNetworkForDisplay(network)}\n`;
    message += `*Token:* ${token}\n`;
    message += `*Amount:* ${displayAmount}\n`;
    
    if (note) {
      message += `\n*Transaction Note:* ${note}\n`;
    }
    
    message += '\nPlease confirm this transaction:';
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...confirmationKeyboard('send_confirm', 'send_cancel'),
    });
    
    // Update step
    getSession(ctx).currentStep = 'send_confirm';
  }
}

// Add handler for large amount confirmation
const confirmAmountAction = Composer.action('confirm_amount', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await displayTransactionConfirmation(ctx);
});

// Handle send confirmation
const sendConfirmAction = Composer.action('send_confirm', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  // Get transfer details from session
  const transferType = getTempData(ctx as any, 'transferType') as string;
  const recipient = getTempData(ctx as any, 'recipient') as string;
  const network = getTempData(ctx as any, 'network') as string;
  const token = getTempData(ctx as any, 'token') as string;
  const amount = getTempData(ctx as any, 'amount') as string;
  const note = getTempData(ctx as any, 'note') as string;
  
  try {
    // KYC check function (simplified version that always returns approved)
    async function checkKycStatus(authToken: string): Promise<{
      isApproved: boolean;
      status?: string;
      message?: string;
    }> {
      try {
        // In a real implementation, this would make an API call to check KYC status
        console.log(`[SEND] Checking KYC status`);
        
        // Simulate a KYC check (always approved in this example)
        return {
          isApproved: true,
          status: 'approved',
          message: 'KYC verification is complete.'
        };
      } catch (error) {
        console.error(`[SEND] Error checking KYC status:`, error);
        
        // Return default values on error
        return {
          isApproved: false,
          status: 'error',
          message: 'Unable to verify KYC status. Please try again later.'
        };
      }
    }

    const kycStatus = await checkKycStatus(getSession(ctx).token as string);
    
    if (!kycStatus.isApproved) {
      await ctx.reply(
        `❌ *KYC Required*\n\n` +
        `You need to complete KYC verification before making bank withdrawals.\n\n` +
        `Your current KYC status: ${kycStatus.status || 'Not submitted'}\n\n` +
        `Please complete your KYC at the CopperX platform:`,
        { parse_mode: 'Markdown' }
      );
      
      // Send KYC link
      await ctx.reply(
        'https://copperx.io/blog/how-to-complete-your-kyc-and-kyb-at-copperx-payout'
      );
      
      // Reset step
      getSession(ctx).currentStep = undefined;
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }
    
    const loadingMsg = await ctx.reply('🔄 Processing your transaction...');
    
    console.log(`[SEND] Initiating ${transferType} transfer of ${amount} ${token} (raw amount) to ${recipient}`);
    
    let response;
    
    if (transferType === 'email') {
      // Send to email
      response = await transfersApi.sendEmailTransfer(getSession(ctx).token as string, {
        amount,
        token,
        receiverEmail: recipient,
        network,
        note,
      });
    } else {
      // Send to wallet
      response = await transfersApi.sendWalletTransfer(getSession(ctx).token as string, {
        amount,
        token,
        receiverAddress: recipient,
        network,
        note,
      });
    }
    
    // Clear temp data
    clearTempData(ctx as any);
    
    // Reset step
    getSession(ctx).currentStep = undefined;
    
    // Send success message
    await ctx.reply(
      `✅ *Transaction Successful*\n\n` +
      `Your transaction has been processed successfully.\n\n` +
      `Transaction ID: ${response.data.id}\n\n` +
      `You can view this transaction in your transaction history by using the /history command.`,
      {
        parse_mode: 'Markdown',
      },
    );
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  } catch (error) {
    console.error('[SEND] Error processing transaction:', error);
    
    let errorMessage = 'Unknown error';
    
    // Try to extract a meaningful error message
    if (error.response && error.response.data) {
      console.error('[SEND] API error response:', JSON.stringify(error.response.data));
      
      if (error.response.data.message) {
        if (Array.isArray(error.response.data.message)) {
          // Handle validation error array format
          errorMessage = error.response.data.message
            .map(err => `${err.property}: ${Object.values(err.constraints || {}).join(', ')}`)
            .join('; ');
        } else {
          errorMessage = error.response.data.message;
        }
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Show user-friendly error message based on error type
    let userFriendlyMessage = `❌ Transaction failed: ${errorMessage}`;
    
    if (errorMessage.includes('minimum amount')) {
      userFriendlyMessage = 
        `❌ *Minimum Amount Required*\n\n` +
        `This transaction doesn't meet the minimum amount requirement.\n\n` +
        `Please try again with a larger amount.`;
    } else if (errorMessage.includes('balance') || errorMessage.includes('insufficient')) {
      userFriendlyMessage = 
        `❌ *Insufficient Balance*\n\n` +
        `You don't have enough balance to complete this transaction.\n\n` +
        `Please check your balance and try again with a smaller amount.`;
    } else if (errorMessage.includes('limit')) {
      userFriendlyMessage = 
        `❌ *Transaction Limit Exceeded*\n\n` +
        `This transaction exceeds your current limit.\n\n` +
        `Please try a smaller amount or contact support to increase your limits.`;
    }
    
    await ctx.reply(
      userFriendlyMessage + '\n\n*Need help?* Contact support: https://t.me/copperxcommunity/2183',
      { parse_mode: 'Markdown' }
    );
    
    // Reset step
    getSession(ctx).currentStep = undefined;
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  }
});

// Handle send cancellation
const sendCancelAction = Composer.action('send_cancel', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  // Clear temp data
  clearTempData(ctx as any);
  
  // Reset step
  getSession(ctx).currentStep = undefined;
  
  await ctx.reply('❌ Transaction cancelled.');
  await ctx.reply('Return to main menu:', backButtonKeyboard());
});

// Add batch payment interfaces
interface BatchPayee {
  email: string;
  amount: string;
}

interface BatchState {
  payees: BatchPayee[];
  step: string;
  network: string;
  currency: string;
}

// Handle send to batch action
const sendBatchAction = Composer.action('send_batch', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  await initiateBatchPayment(ctx);
});

// Initiate batch payment process
async function initiateBatchPayment(ctx) {
  // Clear any previous session data
  clearTempData(ctx);
  
  // Initialize batch state
  setTempData(ctx, 'batchState', {
    payees: [],
    step: 'network',
    currency: 'USDC', // Default to USDC
    network: ''
  });
  
  try {
    // Fetch user's available networks
    const balances = await walletApi.getBalances(getSession(ctx).token);
    console.log(`[BATCH] Fetched ${balances.length} wallets with balances`);
    
    if (!balances || balances.length === 0) {
      await ctx.reply(
        `${ICON.error} You don't have any tokens in your wallets. Please deposit funds first.`
      );
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }
    
    // Get unique networks
    const networks = [...new Set(balances.map(balance => balance.network))];
    
    // Store networks in session
    setTempData(ctx, 'networks', networks);
    
    // Show batch payment introduction
    await ctx.reply(
      `${formatHeader('Batch Payment')} ${ICON.send}\n\n` +
      'Send USDC to multiple recipients in a single batch transaction.\n\n' +
      'First, please select the network you want to use:',
      { parse_mode: 'Markdown' }
    );
    
    // Show network options
    let message = `${ICON.network} *Select Network*\n\nPlease enter the number of the network you want to use:\n\n`;
    
    networks.forEach((network, index) => {
      message += `${index + 1}. ${formatNetworkForDisplay(network)}\n`;
    });
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
    // Set current step
    getSession(ctx).currentStep = 'batch_network';
  } catch (error) {
    console.error('[BATCH] Error initializing batch payment:', error);
    await ctx.reply(
      `${ICON.error} Failed to initialize batch payment: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`
    );
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  }
}

// Add to the existing message handler to process batch payment inputs
const batchFlowHandler = async (ctx, next) => {
  // Skip if not in batch flow
  const session = getSession(ctx);
  if (!session?.currentStep?.startsWith('batch_')) {
    return next();
  }
  
  const text = ctx.message.text.trim();
  
  // Network selection step
  if (session.currentStep === 'batch_network') {
    const networks = getTempData(ctx, 'networks') as string[];
    
    // Validate network selection
    const networkIndex = parseInt(text, 10) - 1;
    if (isNaN(networkIndex) || networkIndex < 0 || networkIndex >= networks.length) {
      await ctx.reply(`${ICON.error} Invalid selection. Please enter a number between 1 and ${networks.length}:`);
      return;
    }
    
    const selectedNetwork = networks[networkIndex];
    
    // Update batch state
    const batchState = getTempData(ctx, 'batchState') as BatchState;
    batchState.network = selectedNetwork;
    setTempData(ctx, 'batchState', batchState);
    
    // Explain batch payment instructions
    await ctx.reply(
      `${formatHeader('Batch Payment Setup')} ${ICON.send}\n\n` +
      `Network: ${formatNetworkForDisplay(selectedNetwork)}\n` +
      `Currency: USDC\n\n` +
      'Add recipients by entering them one per line in this format:\n\n' +
      '`email@example.com 10.5`\n\n' +
      '(Email address followed by amount in USDC)\n\n' +
      '*Commands:*\n' +
      '`DONE` - Finish adding recipients and proceed\n' +
      '`LIST` - Show current batch recipients\n' +
      '`CLEAR` - Remove all recipients\n' +
      '`CANCEL` - Cancel the batch payment',
      { parse_mode: 'Markdown' }
    );
    
    // Update step
    session.currentStep = 'batch_add_recipients';
    return;
  }
  
  // Add recipients step
  if (session.currentStep === 'batch_add_recipients') {
    const upperText = text.toUpperCase();
    const batchState = getTempData(ctx, 'batchState') as BatchState;
    
    // Handle commands
    if (upperText === 'DONE') {
      if (batchState.payees.length === 0) {
        await ctx.reply(`${ICON.warning} No recipients added. Please add at least one recipient or type CANCEL to abort.`);
        return;
      }
      
      // Show confirmation
      await showBatchConfirmation(ctx);
      return;
    } else if (upperText === 'LIST') {
      await listBatchRecipients(ctx);
      return;
    } else if (upperText === 'CLEAR') {
      batchState.payees = [];
      setTempData(ctx, 'batchState', batchState);
      await ctx.reply(`${ICON.success} All recipients cleared. You can now add new recipients.`);
      return;
    } else if (upperText === 'CANCEL') {
      clearTempData(ctx);
      session.currentStep = undefined;
      await ctx.reply(`${ICON.cancel} Batch payment cancelled.`);
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }
    
    // Parse recipient info (email and amount)
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) {
      await ctx.reply(`${ICON.error} Invalid format. Please use: email@example.com 10.5`);
      return;
    }
    
    // Extract email and amount
    const email = parts[0].trim();
    // Join all remaining parts and parse as amount (handles extra spaces)
    const amountText = parts.slice(1).join('').replace(',', '.').trim();
    const amount = parseFloat(amountText);
    
    // Validate email format
    if (!validateEmailFormat(email)) {
      await ctx.reply(`${ICON.error} Invalid email format. Please enter a valid email address.`);
      return;
    }
    
    // Check for typos in email
    const typoCheck = checkEmailTypos(email);
    if (typoCheck.hasTypo && typoCheck.suggestion) {
      await ctx.reply(
        `${ICON.warning} Did you mean *${typoCheck.suggestion}*? If so, please re-enter with the correct email.`,
        { parse_mode: 'Markdown' }
      );
      // We'll continue anyway as the user might have a valid non-standard email
    }
    
    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply(`${ICON.error} Invalid amount. Please enter a positive number.`);
      return;
    }
    
    // Check for duplicate email
    const existingIndex = batchState.payees.findIndex(p => p.email.toLowerCase() === email.toLowerCase());
    if (existingIndex >= 0) {
      await ctx.reply(
        `${ICON.warning} This email is already in your batch. Do you want to update the amount? Reply:\n` +
        `YES - Update the amount\n` +
        `NO - Keep the existing entry`,
        Markup.forceReply()
      );
      
      // Store the pending update details
      setTempData(ctx, 'pendingUpdate', {
        email,
        amount: amount.toString(),
        index: existingIndex
      });
      
      // Set new step for handling the update
      session.currentStep = 'batch_confirm_update';
      return;
    }
    
    // Add new recipient to batch
    batchState.payees.push({
      email,
      amount: amount.toString()
    });
    
    setTempData(ctx, 'batchState', batchState);
    
    await ctx.reply(
      `${ICON.success} Added: ${email} - ${amount.toFixed(2)} USDC\n\n` +
      `Total recipients: ${batchState.payees.length}\n\n` +
      'Continue adding recipients or type DONE when finished.'
    );
    
    return;
  }
  
  // Handle pending update response
  if (session.currentStep === 'batch_confirm_update') {
    const response = text.trim().toUpperCase();
    const pendingUpdate = getTempData(ctx, 'pendingUpdate') as any;
    const batchState = getTempData(ctx, 'batchState') as BatchState;
    
    if (response === 'YES') {
      // Update the existing entry
      batchState.payees[pendingUpdate.index].amount = pendingUpdate.amount;
      setTempData(ctx, 'batchState', batchState);
      
      await ctx.reply(
        `${ICON.success} Updated: ${pendingUpdate.email} - ${parseFloat(pendingUpdate.amount).toFixed(2)} USDC\n\n` +
        'Continue adding recipients or type DONE when finished.'
      );
    } else if (response === 'NO') {
      await ctx.reply(`${ICON.info} Kept existing entry unchanged.`);
    } else {
      await ctx.reply(`${ICON.error} Invalid response. The entry was not updated.`);
    }
    
    // Clear pending update and revert to add recipients step
    setTempData(ctx, 'pendingUpdate', null);
    session.currentStep = 'batch_add_recipients';
    return;
  }
  
  return next();
};

// Helper functions for batch payments
async function listBatchRecipients(ctx) {
  const batchState = getTempData(ctx, 'batchState') as BatchState;
  
  if (batchState.payees.length === 0) {
    await ctx.reply(`${ICON.warning} No recipients added yet.`);
    return;
  }
  
  let totalAmount = 0;
  let message = `${formatHeader('Batch Recipients')} ${ICON.info}\n\n`;
  
  batchState.payees.forEach((payee, index) => {
    const amount = parseFloat(payee.amount);
    totalAmount += amount;
    message += `${index + 1}. ${payee.email} - ${amount.toFixed(2)} USDC\n`;
  });
  
  message += `\n*Total Recipients:* ${batchState.payees.length}`;
  message += `\n*Total Amount:* ${totalAmount.toFixed(2)} USDC`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function showBatchConfirmation(ctx) {
  const batchState = getTempData(ctx, 'batchState') as BatchState;
  
  let totalAmount = 0;
  let message = `${formatHeader('Confirm Batch Payment')} ${ICON.confirm}\n\n`;
  
  message += `*Network:* ${formatNetworkForDisplay(batchState.network)}\n`;
  message += `*Currency:* USDC\n\n`;
  message += '*Recipients:*\n';
  
  batchState.payees.forEach((payee, index) => {
    const amount = parseFloat(payee.amount);
    totalAmount += amount;
    message += `${index + 1}. ${payee.email} - ${amount.toFixed(2)} USDC\n`;
  });
  
  message += `\n*Total Recipients:* ${batchState.payees.length}`;
  message += `\n*Total Amount:* ${totalAmount.toFixed(2)} USDC`;
  
  message += '\n\nPlease confirm this batch payment:';
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...confirmationKeyboard('batch_confirm', 'batch_cancel')
  });
  
  // Update step
  getSession(ctx).currentStep = 'batch_confirm';
}

// Handle batch confirmation action
const batchConfirmAction = Composer.action('batch_confirm', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  const batchState = getTempData(ctx, 'batchState') as BatchState;
  const session = getSession(ctx);
  
  if (batchState.payees.length === 0) {
    await ctx.reply(
      `${ICON.warning} *No Recipients Added*\n\nNo recipients have been added. Please try again.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(`${ICON.send} Start Batch Payment`, 'send_batch')],
          [Markup.button.callback(`${ICON.back} Back to Menu`, 'main_menu')]
        ])
      }
    );
    return;
  }
  
  try {
    await ctx.reply(`${ICON.loading} Processing batch payment...`);
    
    // Prepare batch payment requests
    const batchRequests = batchState.payees.map(payee => ({
      email: payee.email,
      amount: payee.amount,
      currency: 'USDC',
      purposeCode: 'self',
      // Add a unique identifier to each transaction for tracing
      note: `Batch payment via Telegram (${uuidv4().substring(0, 8)})`
    }));
    
    // Send batch payment request to API
    const response = await transfersApi.sendBatchPayments(session.token, batchRequests);
    
    // Format success message
    let message = `${formatHeader('Batch Payment Successful')} ${ICON.success}\n\n`;
    
    // Check response format and adapt accordingly
    if (response.data && Array.isArray(response.data.transfers)) {
      // Process individual transfer statuses if available
      response.data.transfers.forEach((transfer, index) => {
        const payee = batchState.payees[index];
        const amount = parseFloat(payee.amount).toFixed(2);
        
        message += `${ICON.email} *${payee.email}*\n`;
        message += `   Amount: ${amount} USDC\n`;
        message += `   Status: ${transfer.status || 'Processed'}\n`;
        message += `   ID: \`${transfer.id || 'N/A'}\`\n\n`;
      });
    } else {
      // Fallback to simpler success message
      message += `Successfully sent payments to ${batchState.payees.length} recipients.\n\n`;
      message += `Total amount: ${batchState.payees.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)} USDC`;
    }
    
    // Clear batch state after successful processing
    clearTempData(ctx);
    session.currentStep = undefined;
    
    // Show success message with options
    await ctx.replyWithMarkdown(
      message,
      Markup.inlineKeyboard([
        [Markup.button.callback(`${ICON.history} View History`, 'history')],
        [Markup.button.callback(`${ICON.send} Send Another Batch`, 'send_batch')],
        [Markup.button.callback(`${ICON.back} Back to Menu`, 'main_menu')]
      ])
    );
  } catch (error) {
    console.error('[BATCH] Error processing batch payment:', error);
    
    let errorMessage = 'Unknown error';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    // Handle authentication errors
    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      session.authenticated = false;
      session.token = undefined;
      session.currentStep = undefined;
      
      await ctx.reply(
        `${ICON.error} Your session has expired. Please log in again.`,
        Markup.inlineKeyboard([
          [Markup.button.callback(`${ICON.key} Login`, 'login')]
        ])
      );
      return;
    }
    
    // Show error message with options to retry
    await ctx.replyWithMarkdown(
      `${ICON.error} *Batch Payment Failed*\n\n${errorMessage}\n\nPlease try again or contact support.`,
      Markup.inlineKeyboard([
        [Markup.button.callback(`${ICON.send} Try Again`, 'send_batch')],
        [Markup.button.callback(`${ICON.back} Back to Menu`, 'main_menu')]
      ])
    );
  }
});

// Handle batch cancellation action
const batchCancelAction = Composer.action('batch_cancel', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  // Clear batch data
  clearTempData(ctx);
  
  // Reset step
  getSession(ctx).currentStep = undefined;
  
  await ctx.reply(`${ICON.cancel} Batch payment cancelled.`);
  await ctx.reply('Return to main menu:', backButtonKeyboard());
});

// Add validation utilities
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export default Composer.compose([
  sendCommand,
  sendAction,
  sendEmailAction,
  sendWalletAction,
  sendFlow,
  confirmAmountAction,
  sendConfirmAction,
  sendCancelAction,
  // Add batch payment handlers
  sendBatchAction,
  // Modify send flow to check for batch-related steps
  Composer.on(message('text'), batchFlowHandler),
  batchConfirmAction, 
  batchCancelAction
]); 