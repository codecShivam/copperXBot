import { Composer } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext } from '../../types';
import { walletApi, transfersApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { sendMenuKeyboard, backButtonKeyboard, confirmationKeyboard } from '../keyboards';
import { getSession, clearTempData, setTempData, getTempData } from '../../utils/session';
import { formatAmount } from '../../utils/format';
import { formatNetworkForDisplay } from '../../utils/networks';

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
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      await ctx.reply('❌ Invalid email format. Please enter a valid email address:');
      return;
    }
    
    // Store recipient email
    setTempData(ctx, 'recipient', text);
    
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
    // Basic validation for wallet address (should be non-empty)
    if (!text || text.length < 10) {
      await ctx.reply('❌ Invalid wallet address. Please enter a valid address:');
      return;
    }
    
    // Store recipient address
    setTempData(ctx, 'recipient', text);
    
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
    
    // Store selected network
    setTempData(ctx, 'network', selectedNetwork);
    
    // Fetch tokens for the selected network
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
    
    // Show confirmation with original amount but use converted amount in the API call
    const transferType = getTempData(ctx, 'transferType') as string;
    const recipient = getTempData(ctx, 'recipient') as string;
    const network = getTempData(ctx, 'network') as string;
    const token = getTempData(ctx, 'token') as string;
    const amount = getTempData(ctx, 'amount') as string; // This is now the scaled amount (10^8)
    const displayAmount = getTempData(ctx, 'displayAmount') as string; // Original amount for display
    const note = getTempData(ctx, 'note') as string;
    
    let message = '✅ *Confirm Transaction*\n\n';
    
    if (transferType === 'email') {
      message += `*Type:* Send to Email\n`;
      message += `*Recipient:* ${recipient}\n`;
    } else {
      message += `*Type:* Send to Wallet\n`;
      message += `*Recipient:* ${recipient}\n`;
    }
    
    message += `*Network:* ${formatNetworkForDisplay(network)}\n`;
    message += `*Token:* ${token}\n`;
    message += `*Amount:* ${displayAmount}\n`; // Use display amount here
    
    if (note) {
      message += `*Note:* ${note}\n`;
    }
    
    message += '\nPlease confirm this transaction:';
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...confirmationKeyboard('send_confirm', 'send_cancel'),
    });
    
    // Update step
    session.currentStep = 'send_confirm';
    return;
  }
  
  return next();
});

// Handle send confirmation
const sendConfirmAction = Composer.action('send_confirm', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  // Get transfer details from session
  const transferType = getTempData(ctx as any, 'transferType') as string;
  const recipient = getTempData(ctx as any, 'recipient') as string;
  const network = getTempData(ctx as any, 'network') as string;
  const token = getTempData(ctx as any, 'token') as string;
  const amount = getTempData(ctx as any, 'amount') as string; // Already scaled by 10^8
  const note = getTempData(ctx as any, 'note') as string;
  
  try {
    // Get auth token
    const authToken = getSession(ctx).token as string;
    
    const loadingMsg = await ctx.reply('🔄 Processing your transaction...');
    
    console.log(`[SEND] Initiating ${transferType} transfer of ${amount} ${token} (raw amount) to ${recipient}`);
    
    let response;
    
    if (transferType === 'email') {
      // Send to email
      response = await transfersApi.sendEmailTransfer(authToken, {
        amount, // Already scaled
        token,
        receiverEmail: recipient,
        network,
        note,
      });
    } else {
      // Send to wallet
      response = await transfersApi.sendWalletTransfer(authToken, {
        amount, // Already scaled
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
      `✅ *Transaction Successful*\n\nYour transaction has been processed successfully.\n\nTransaction ID: ${response.data.id}`,
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
    
    await ctx.reply(
      `❌ Transaction failed: ${errorMessage}\n\nPlease try again with a different amount or recipient.`,
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

export default Composer.compose([
  sendCommand,
  sendAction,
  sendEmailAction,
  sendWalletAction,
  sendFlow,
  sendConfirmAction,
  sendCancelAction,
]); 