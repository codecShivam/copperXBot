import { Composer } from 'telegraf';
import { message } from 'telegraf/filters';
import { walletApi, kycApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { backButtonKeyboard, confirmationKeyboard } from '../keyboards';
import {
  getSession,
  setTempData,
  getTempData,
  clearTempData,
} from '../../utils/session';
import { formatAmount } from '../../utils/format';
import { formatNetworkForDisplay } from '../../utils/networks';
import { formatLoading } from '../../constants/themes/default';
import { transfersApi } from '../../api';

// Withdraw command handler
const withdrawCommand = Composer.command(
  'withdraw',
  authMiddleware(),
  async (ctx) => {
    await startWithdrawal(ctx);
  },
);

// Withdraw action handler
const withdrawAction = Composer.action(
  'withdraw',
  authMiddleware(),
  async (ctx) => {
    await ctx.answerCbQuery();
    await startWithdrawal(ctx);
  },
);

// Helper function to start withdrawal process
async function startWithdrawal(ctx) {
  try {
    // Clear any previous temp data
    clearTempData(ctx);

    // First, check KYC status
    const session = getSession(ctx);
    const token = session.token as string;

    // Show loading message while checking KYC
    const loadingMsg = await ctx.reply(
      formatLoading('Checking your KYC status...'),
      { parse_mode: 'Markdown' },
    );

    // Check KYC status
    const kycStatus = await kycApi.getKycStatus(token);

    try {
      await ctx.deleteMessage(loadingMsg.message_id);
    } catch (error) {
      console.warn('[WITHDRAW] Could not delete loading message:', error);
    }

    // If KYC is not approved, show a message and provide a link to complete KYC
    if (!kycStatus.isApproved) {
      await ctx.reply(
        '🏦 *Withdraw to Bank Account*\n\n' +
          '⚠️ *KYC Verification Required*\n\n' +
          `Your current KYC status: *${kycStatus.status || 'not submitted'}*\n\n` +
          'Bank withdrawals require KYC approval. Please complete your KYC verification at the Copperx web app:',
        { parse_mode: 'Markdown' },
      );

      await ctx.reply(
        'https://copperx.io/blog/how-to-complete-your-kyc-and-kyb-at-copperx-payout',
      );
      await ctx.reply(
        '*Need help with KYC?* Contact support: https://t.me/copperxcommunity/2183',
        { parse_mode: 'Markdown' },
      );
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }

    // KYC is approved, continue with withdrawal process
    await ctx.reply(
      '🏦 *Withdraw to Bank Account*\n\n' +
        'This feature allows you to withdraw funds to your bank account.\n\n' +
        '✅ *KYC Status: Approved*\n' +
        'You can proceed with the withdrawal process.',
      {
        parse_mode: 'Markdown',
      },
    );

    // Fetch balances - walletApi.getBalances now returns the array directly
    const balances = await walletApi.getBalances(token);
    console.log(`[WITHDRAW] Fetched ${balances.length} wallets with balances`);

    if (!balances || balances.length === 0) {
      await ctx.reply(
        "❌ You don't have any tokens in your wallets. Please deposit funds first.",
      );
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }

    // Get unique networks
    const networks = [...new Set(balances.map((balance) => balance.network))];

    // Store networks in session
    setTempData(ctx, 'networks', networks);

    // Ask for network
    let message =
      '🌐 *Select Network*\n\nPlease enter the number of the network you want to use:\n\n';

    networks.forEach((network, index) => {
      message += `${index + 1}. ${formatNetworkForDisplay(network)}\n`;
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
    if (
      isNaN(networkIndex) ||
      networkIndex < 0 ||
      networkIndex >= networks.length
    ) {
      await ctx.reply(
        `❌ Invalid selection. Please enter a number between 1 and ${networks.length}:`,
      );
      return;
    }

    const selectedNetwork = networks[networkIndex];

    // Store selected network
    setTempData(ctx, 'network', selectedNetwork);

    // Fetch tokens for the selected network
    try {
      // walletApi.getBalances now returns the array directly
      const walletData = await walletApi.getBalances(session.token as string);
      console.log(
        `[WITHDRAW] Fetched ${walletData.length} wallets with balances for token selection`,
      );

      // Filter wallets by network and extract tokens
      const networkWallets = walletData.filter(
        (wallet) => wallet.network === selectedNetwork,
      );

      // Extract all tokens from these wallets
      const tokenList: {
        symbol: string;
        balance: string;
        decimals: number;
        address: string;
      }[] = [];

      networkWallets.forEach((wallet) => {
        if (wallet.balances && Array.isArray(wallet.balances)) {
          wallet.balances.forEach((tokenBalance) => {
            // Check if token already exists in our list (from another wallet)
            const existingToken = tokenList.find(
              (t) => t.symbol === tokenBalance.symbol,
            );

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
      setTempData(
        ctx,
        'tokens',
        tokenList.map((token) => token.symbol),
      );

      // Ask for token
      let message =
        '💰 *Select Token*\n\nPlease enter the number of the token you want to withdraw:\n\n';

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
      await ctx.reply(
        `❌ Invalid selection. Please enter a number between 1 and ${tokens.length}:`,
      );
      return;
    }

    const selectedToken = tokens[tokenIndex];
    const selectedNetwork = getTempData(ctx, 'network') as string;

    // Log with network name for debugging
    console.log(
      `[WITHDRAW] Selected token ${selectedToken} on ${formatNetworkForDisplay(selectedNetwork)}`,
    );

    // Store selected token
    setTempData(ctx, 'token', selectedToken);

    // Ask for amount
    await ctx.reply(
      `💲 *Enter Amount*\n\nPlease enter the amount of ${selectedToken} you want to withdraw from ${formatNetworkForDisplay(selectedNetwork)}:`,
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
      await ctx.reply(
        '❌ Invalid amount format. Please enter a numeric amount:',
      );
      return;
    }

    const inputAmount = parseFloat(text);

    // Validate amount is positive
    if (inputAmount <= 0) {
      await ctx.reply(
        '❌ Amount must be greater than zero. Please enter a valid amount:',
      );
      return;
    }

    // Store amount
    setTempData(ctx, 'amount', text);

    // Fetch bank accounts
    try {
      // Show loading message
      const loadingMsg = await ctx.reply(
        formatLoading('Fetching your bank accounts...'),
        { parse_mode: 'Markdown' },
      );

      // Get user's bank accounts
      const token = session.token as string;
      const accounts = await transfersApi.getAccounts(token);

      // Try to delete loading message
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (error) {
        console.warn('[WITHDRAW] Could not delete loading message:', error);
      }

      // Filter for verified bank accounts
      const bankAccounts = accounts.data.filter(
        (acc) => acc.type === 'bank_account' && acc.status === 'verified',
      );

      if (bankAccounts.length === 0) {
        await ctx.reply(
          '❌ No verified bank accounts found. Please add and verify a bank account in the CopperX web app first.',
          { parse_mode: 'Markdown' },
        );
        await ctx.reply('Return to main menu:', backButtonKeyboard());

        // Reset step
        session.currentStep = undefined;
        return;
      }

      // Store bank accounts
      setTempData(ctx, 'accounts', bankAccounts);

      // Display bank account options
      let message =
        '🏦 *Select Bank Account*\n\nPlease enter the number of the bank account you want to use:\n\n';

      bankAccounts.forEach((account, index) => {
        const bankName = account.bankAccount?.bankName || 'Bank';
        const lastFour =
          account.bankAccount?.bankAccountNumber?.slice(-4) || 'xxxx';
        message += `${index + 1}. ${bankName} (****${lastFour})\n`;
      });

      await ctx.reply(message, {
        parse_mode: 'Markdown',
      });

      // Update step
      session.currentStep = 'withdraw_bank_account';
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      await ctx.reply(
        `❌ Failed to fetch bank accounts: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      );
      session.currentStep = undefined;
      await ctx.reply('Return to main menu:', backButtonKeyboard());
    }

    return;
  }

  // Handle bank account selection
  if (session.currentStep === 'withdraw_bank_account') {
    const accounts = getTempData(ctx, 'accounts') as any[];

    // Validate bank account selection
    const accountIndex = parseInt(text, 10) - 1;
    if (
      isNaN(accountIndex) ||
      accountIndex < 0 ||
      accountIndex >= accounts.length
    ) {
      await ctx.reply(
        `❌ Invalid selection. Please enter a number between 1 and ${accounts.length}:`,
      );
      return;
    }

    const selectedAccount = accounts[accountIndex];

    // Store selected account
    setTempData(ctx, 'bankAccount', selectedAccount);

    // Get other withdrawal details
    const amount = getTempData(ctx, 'amount') as string;
    const token = getTempData(ctx, 'token') as string;

    try {
      // Show loading message
      const loadingMsg = await ctx.reply(
        formatLoading('Fetching withdrawal quote...'),
        { parse_mode: 'Markdown' },
      );

      // Prepare the quote request
      const quoteData = {
        amount: amount, // Will be formatted inside the API function
        currency: token,
        destinationCountry: selectedAccount.country || 'IN', // Default to India if missing
        onlyRemittance: true,
        preferredBankAccountId: selectedAccount.id,
        sourceCountry: 'none',
      };

      console.log(`[WITHDRAW] Requesting offramp quote with data:`, {
        ...quoteData,
        amount: Number(amount).toFixed(2), // Log readable amount
        accountId: selectedAccount.id.slice(0, 8) + '...', // Truncate for logging
      });

      // Get the quote
      const quote = await transfersApi.getBankWithdrawalQuote(
        session.token as string,
        quoteData,
      );

      // Delete loading message
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (error) {
        console.warn('[WITHDRAW] Could not delete loading message:', error);
      }

      // Parse quote payload to display details
      const quotePayload = JSON.parse(quote.quotePayload);
      const cryptoAmount = parseInt(quotePayload.amount) / 1e8;
      const localAmount = parseInt(quotePayload.toAmount) / 1e8;
      const fee = parseInt(quotePayload.totalFee) / 1e8;
      const exchangeRate = parseFloat(quotePayload.rate);
      const currency = quotePayload.toCurrency || 'INR';

      // Store the quote in session for confirmation
      setTempData(ctx, 'withdrawQuote', {
        signature: quote.quoteSignature,
        payload: quote.quotePayload,
        amount: cryptoAmount,
        localAmount: localAmount,
        fee: fee,
        rate: exchangeRate,
        currency: currency,
      });

      // Calculate fee breakdown based on fixed and percentage components
      const fixedFee = 2.0; // Fixed cost per transaction in USD
      const percentageFee = (cryptoAmount * 0.015).toFixed(2); // 1.5% of withdrawal amount

      // Display quote details with better formatting
      const bankDetails = selectedAccount.bankAccount;
      const message =
        `🏦 *Bank Withdrawal Details*\n\n` +
        `Withdraw: *${cryptoAmount.toFixed(2)} ${token}*\n` +
        `You'll receive: *${localAmount.toFixed(2)} ${currency}*\n` +
        `Exchange rate: 1 ${token} ≈ ${exchangeRate.toFixed(2)} ${currency}\n\n` +
        `*Fee Breakdown:*\n` +
        `Fixed cost per transaction: USD ${fixedFee.toFixed(2)}\n` +
        `Payout Fee (1.5%): USD ${percentageFee}\n` +
        `[Learn more about fees](https://support.copperx.io/en/)\n\n` +
        `Arrival: ${quote.arrivalTimeMessage || '1-3 business days'}\n\n` +
        `Bank account: ${bankDetails.bankName} (****${bankDetails.bankAccountNumber.slice(-4)})\n\n` +
        `Do you want to proceed with this withdrawal?`;

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        link_preview_options: {
          is_disabled: true,
        },
        ...confirmationKeyboard('withdraw_confirm', 'withdraw_cancel'),
      });

      // Update step
      session.currentStep = 'withdraw_confirm';
    } catch (error) {
      console.error('Error getting withdrawal quote:', error);
      await ctx.reply(
        `❌ Failed to get withdrawal quote: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      );
      session.currentStep = undefined;
      clearTempData(ctx); // Clear temp data on error
      await ctx.reply('Return to main menu:', backButtonKeyboard());
    }
    return;
  }

  return next();
});

// Handle withdraw confirmation
const withdrawConfirmAction = Composer.action(
  'withdraw_confirm',
  authMiddleware(),
  async (ctx) => {
    await ctx.answerCbQuery();

    const withdrawQuote = getTempData(ctx as any, 'withdrawQuote');
    if (!withdrawQuote) {
      await ctx.reply(
        '❌ Withdrawal quote expired or not found. Please start the withdrawal process again.',
      );
      getSession(ctx).currentStep = undefined;
      clearTempData(ctx as any);
      await ctx.reply('Return to main menu:', backButtonKeyboard());
      return;
    }

    try {
      const loadingMsg = await ctx.reply(
        '🔄 Processing your bank withdrawal...',
      );

      // Get token from session
      const authToken = getSession(ctx).token as string;

      // Prepare withdrawal data with quote info
      const withdrawalData = {
        purposeCode: 'self',
        quotePayload: withdrawQuote.payload,
        quoteSignature: withdrawQuote.signature,
      };

      console.log(
        '[WITHDRAW] Executing bank transfer with signature:',
        withdrawQuote.signature.slice(0, 15) + '...',
      );

      // Execute the transfer using the offramp API
      const result = await transfersApi.processBankWithdrawal(
        authToken,
        withdrawalData,
      );

      // Delete loading message
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (error) {
        console.warn('[WITHDRAW] Could not delete loading message:', error);
      }

      // Clear temp data and reset step
      getSession(ctx).currentStep = undefined;
      clearTempData(ctx as any);

      // Get values for the success message
      const token =
        getTempData(ctx as any, 'token') || withdrawQuote.currency || 'USDC';
      const networkValue =
        getTempData(ctx as any, 'network') || result.network || 'ethereum';

      // Calculate fee breakdown again for receipt
      const fixedFee = 2.0;
      const percentageFee = (withdrawQuote.amount * 0.015).toFixed(2);

      // Create success message
      await ctx.reply(
        '✅ *Withdrawal Request Submitted*\n\n' +
          'Your bank withdrawal request has been submitted successfully.\n\n' +
          `*Transaction Details:*\n` +
          `*Transaction ID:* ${result.id}\n` +
          `*Amount:* ${withdrawQuote.amount.toFixed(2)} ${token}\n` +
          `*You'll receive:* ${withdrawQuote.localAmount.toFixed(2)} ${withdrawQuote.currency}\n` +
          `*Network:* ${formatNetworkForDisplay(networkValue)}\n` +
          `*Status:* ${result.status || 'Processing'}\n` +
          `*Fees:* Fixed USD ${fixedFee.toFixed(2)} + ${percentageFee} USD (1.5%)\n\n` +
          'Bank withdrawals typically take 1-3 business days to process.\n\n' +
          '*Questions about your withdrawal?* Contact support: https://t.me/copperxcommunity/2183',
        {
          parse_mode: 'Markdown',
        },
      );

      await ctx.reply('Return to main menu:', backButtonKeyboard());
    } catch (error) {
      console.error('Error processing withdrawal:', error);

      // Format a user-friendly error message
      let errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Make the error message more user-friendly based on common errors
      if (errorMessage.toLowerCase().includes('insufficient')) {
        errorMessage =
          'Insufficient funds for this withdrawal. Please try a smaller amount.';
      } else if (errorMessage.toLowerCase().includes('limit')) {
        errorMessage =
          'This withdrawal exceeds your limits. Please try a smaller amount or contact support.';
      } else if (
        errorMessage.toLowerCase().includes('kyc') ||
        errorMessage.toLowerCase().includes('verification')
      ) {
        errorMessage =
          'KYC verification issue. Please ensure your verification is complete and up to date.';
      }

      await ctx.reply(
        `❌ *Withdrawal Failed*\n\n${errorMessage}\n\nPlease try again later or contact support if the issue persists.\n\n*Need help?* Contact support: https://t.me/copperxcommunity/2183`,
        { parse_mode: 'Markdown' },
      );

      // Reset step and clear data
      getSession(ctx).currentStep = undefined;
      clearTempData(ctx as any);

      await ctx.reply('Return to main menu:', backButtonKeyboard());
    }
  },
);

// Handle withdraw cancellation
const withdrawCancelAction = Composer.action(
  'withdraw_cancel',
  authMiddleware(),
  async (ctx) => {
    await ctx.answerCbQuery();

    // Clear temp data
    clearTempData(ctx as any);

    // Reset step
    getSession(ctx).currentStep = undefined;

    await ctx.reply('❌ Withdrawal cancelled.');
    await ctx.reply('Return to main menu:', backButtonKeyboard());
  },
);

export default Composer.compose([
  withdrawCommand,
  withdrawAction,
  withdrawFlow,
  withdrawConfirmAction,
  withdrawCancelAction,
]);
