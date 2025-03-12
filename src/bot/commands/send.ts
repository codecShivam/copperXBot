import { Composer } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext } from '../../types';
import { walletApi, transfersApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { sendMenuKeyboard, backButtonKeyboard, confirmationKeyboard } from '../keyboards';
import { getSession, clearTempData, setTempData, getTempData } from '../../utils/session';
import { formatAmount } from '../../utils/format';

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
      const balancesResponse = await walletApi.getBalances(session.token as string);
      const balances = balancesResponse.data;
      
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
        message += `${index + 1}. ${network.toUpperCase()}\n`;
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
      const balancesResponse = await walletApi.getBalances(session.token as string);
      const balances = balancesResponse.data;
      
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
        message += `${index + 1}. ${network.toUpperCase()}\n`;
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
      const balancesResponse = await walletApi.getBalances(session.token as string);
      const balances = balancesResponse.data.filter(
        (balance) => balance.network === selectedNetwork,
      );
      
      // Store tokens in session
      setTempData(ctx, 'tokens', balances.map((balance) => balance.token));
      
      // Ask for token
      let message = '💰 *Select Token*\n\nPlease enter the number of the token you want to send:\n\n';
      
      balances.forEach((balance, index) => {
        const formattedBalance = formatAmount(balance.balance);
        message += `${index + 1}. ${balance.token} (Balance: ${formattedBalance})\n`;
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
    
    // Store selected token
    setTempData(ctx, 'token', selectedToken);
    
    // Ask for amount
    await ctx.reply(
      '💲 *Enter Amount*\n\nPlease enter the amount you want to send:',
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
    
    // Store amount
    setTempData(ctx, 'amount', text);
    
    // Ask for note (optional)
    await ctx.reply(
      '📝 *Add Note (Optional)*\n\nPlease enter a note for this transaction, or type "skip" to continue without a note:',
      {
        parse_mode: 'Markdown',
      },
    );
    
    // Update step
    session.currentStep = 'send_note';
    return;
  }
  
  // Handle note input
  if (session.currentStep === 'send_note') {
    // Store note if not "skip"
    if (text.toLowerCase() !== 'skip') {
      setTempData(ctx, 'note', text);
    }
    
    // Show confirmation
    const transferType = getTempData(ctx, 'transferType') as string;
    const recipient = getTempData(ctx, 'recipient') as string;
    const network = getTempData(ctx, 'network') as string;
    const token = getTempData(ctx, 'token') as string;
    const amount = getTempData(ctx, 'amount') as string;
    const note = getTempData(ctx, 'note') as string;
    
    let message = '✅ *Confirm Transaction*\n\n';
    
    if (transferType === 'email') {
      message += `*Type:* Send to Email\n`;
      message += `*Recipient:* ${recipient}\n`;
    } else {
      message += `*Type:* Send to Wallet\n`;
      message += `*Recipient:* ${recipient}\n`;
    }
    
    message += `*Network:* ${network.toUpperCase()}\n`;
    message += `*Token:* ${token}\n`;
    message += `*Amount:* ${amount}\n`;
    
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
  const amount = getTempData(ctx as any, 'amount') as string;
  const note = getTempData(ctx as any, 'note') as string;
  
  try {
    // Get auth token
    const authToken = getSession(ctx).token as string;
    
    await ctx.reply('🔄 Processing your transaction...');
    
    let response;
    
    if (transferType === 'email') {
      // Send to email
      response = await transfersApi.sendEmailTransfer(authToken, {
        amount,
        token,
        receiverEmail: recipient,
        network,
        note,
      });
    } else {
      // Send to wallet
      response = await transfersApi.sendWalletTransfer(authToken, {
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
      `✅ *Transaction Successful*\n\nYour transaction has been processed successfully.\n\nTransaction ID: ${response.data.id}`,
      {
        parse_mode: 'Markdown',
      },
    );
    
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  } catch (error) {
    console.error('Error processing transaction:', error);
    await ctx.reply(
      `❌ Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
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