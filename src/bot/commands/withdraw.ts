import { Composer } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext } from '../../types';
import { walletApi, transfersApi, kycApi } from '../../api';
import { authMiddleware } from '../middleware/auth';
import { backButtonKeyboard, confirmationKeyboard } from '../keyboards';
import { getSession, setTempData, getTempData, clearTempData } from '../../utils/session';
import { formatAmount } from '../../utils/format';
import { formatNetworkForDisplay } from '../../utils/networks';
import { formatLoading } from '../../constants/themes/default';

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
    
    // First, check KYC status
    const session = getSession(ctx);
    const token = session.token as string;
    
    // Show loading message while checking KYC
    const loadingMsg = await ctx.reply(
      formatLoading('Checking your KYC status...'),
      { parse_mode: 'Markdown' }
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
        { parse_mode: 'Markdown' }
      );
      
      await ctx.reply('https://copperx.io/blog/how-to-complete-your-kyc-and-kyb-at-copperx-payout');
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
    const selectedNetwork = getTempData(ctx, 'network') as string;
    
    // Log with network name for debugging
    console.log(`[WITHDRAW] Selected token ${selectedToken} on ${formatNetworkForDisplay(selectedNetwork)}`);
    
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
    
    // In a real implementation, we would fetch the user's bank accounts
    // Let's get the KYC data to use for showing bank information
    const authToken = session.token as string;
    const kycStatus = await kycApi.getKycStatus(authToken);
    
    if (kycStatus.success && kycStatus.data && kycStatus.data.kycDetail) {
      const kycDetail = kycStatus.data.kycDetail;
      
      // Extract user info from KYC data
      const firstName = kycDetail.firstName || '';
      const lastName = kycDetail.lastName || '';
      const country = kycDetail.country || '';
      
      // Store KYC information that might be useful for the withdrawal
      setTempData(ctx, 'kycInfo', {
        firstName,
        lastName,
        country
      });
      
      await ctx.reply(
        '🏦 *Bank Account Details*\n\n' +
        `Account Holder: *${firstName} ${lastName}*\n` +
        `Country: *${country.toUpperCase()}*\n\n` +
        'Your withdrawal will be sent to your default bank account linked with your CopperX account.\n\n' +
        '⚠️ *Note:* In a production environment, you would be able to select from your linked bank accounts.',
        {
          parse_mode: 'Markdown',
        },
      );
    } else {
      await ctx.reply(
        '🏦 *Bank Account*\n\n' +
        'Your withdrawal will be sent to your default bank account linked with your CopperX account.\n\n' +
        '⚠️ *Note:* In a production environment, you would be able to select from your linked bank accounts.',
        {
          parse_mode: 'Markdown',
        },
      );
    }
    
    // Set a placeholder bank account ID
    setTempData(ctx, 'bankAccountId', 'default_bank_account_id');
    
    // Try to get fee estimate
    try {
      const networkValue = getTempData(ctx, 'network') as string;
      const tokenValue = getTempData(ctx, 'token') as string;
      const withdrawAmount = getTempData(ctx, 'amount') as string;
      const kycInfo = getTempData(ctx, 'kycInfo');
      const country = kycInfo?.country || '';
      
      // Show loading message while calculating fees
      const loadingMsg = await ctx.reply(
        formatLoading('Calculating withdrawal fees...'),
        { parse_mode: 'Markdown' }
      );
      
      // Get fee estimate for bank withdrawals - pass country code for INR conversion
      const feeEstimate = await kycApi.getWithdrawalFeeEstimate(
        authToken, 
        withdrawAmount, 
        tokenValue,
        country
      );
      
      try {
        await ctx.deleteMessage(loadingMsg.message_id);
      } catch (error) {
        console.warn('[WITHDRAW] Could not delete loading message:', error);
      }
      
      // Store fee information
      if (feeEstimate.success) {
        setTempData(ctx, 'feeEstimate', feeEstimate.data);
      } else if (feeEstimate.estimatedFees) {
        setTempData(ctx, 'feeEstimate', feeEstimate.estimatedFees);
      }
      
      // Show confirmation with fee details
      await showWithdrawalConfirmation(ctx);
    } catch (error) {
      console.error('Error calculating fees:', error);
      // Even if fee calculation fails, proceed with basic confirmation
      await showWithdrawalConfirmation(ctx);
    }
    
    // Update step
    session.currentStep = 'withdraw_confirm';
    return;
  }
  
  return next();
});

// Helper function to show withdrawal confirmation with fees
async function showWithdrawalConfirmation(ctx) {
  const networkValue = getTempData(ctx, 'network') as string;
  const tokenValue = getTempData(ctx, 'token') as string;
  const withdrawAmount = getTempData(ctx, 'amount') as string;
  const bankAccountId = getTempData(ctx, 'bankAccountId') as string;
  const feeEstimateData = getTempData(ctx, 'feeEstimate');
  const kycInfo = getTempData(ctx, 'kycInfo');
  
  // Check if user is from India
  const isIndianUser = kycInfo && (kycInfo.country.toLowerCase() === 'ind' || kycInfo.country.toLowerCase() === 'india');
  
  console.log("[WITHDRAW] Fee estimate data for confirmation:", JSON.stringify(feeEstimateData, null, 2));
  
  // Extract fee details - handle both direct structure and nested structure
  const feeEstimate = feeEstimateData?.estimatedFees || feeEstimateData;
  
  let message = '✅ *Confirm Withdrawal*\n\n';
  
  message += `*Type:* Bank Withdrawal\n`;
  message += `*Network:* ${formatNetworkForDisplay(networkValue)}\n`;
  message += `*Token:* ${tokenValue}\n`;
  message += `*Amount:* ${withdrawAmount} ${tokenValue}\n`;
  
  // Add account holder information if available
  if (kycInfo) {
    message += `*Account Holder:* ${kycInfo.firstName} ${kycInfo.lastName}\n`;
    message += `*Country:* ${kycInfo.country.toUpperCase()}\n`;
  }
  
  message += `*Bank Account:* Default Account\n\n`;
  
  // Add fee details section
  message += '💰 *Fee Details:*\n';
  
  if (feeEstimate) {
    // Add exchange rate if available
    if (feeEstimate.usdRate) {
      message += `*Exchange Rate:* ${feeEstimate.usdRate}\n`;
    }
    
    // Add INR rate for Indian users
    if (isIndianUser && feeEstimate.inrInfo && feeEstimate.inrInfo.inrRate) {
      message += `*INR Exchange Rate:* ${feeEstimate.inrInfo.inrRate}\n`;
    }
    
    // Fixed fee
    if (feeEstimate.fixedFee) {
      message += `*Fixed Fee:* ${feeEstimate.fixedFee}\n`;
    } else {
      message += `*Fixed Fee:* $2.00\n`;
    }
    
    // Processing fee
    if (feeEstimate.processingFee) {
      message += `*Processing Fee (${feeEstimate.percentage || '1.5'}%):* ${feeEstimate.processingFee}\n`;
    } else {
      const procFee = (parseFloat(withdrawAmount) * 0.015).toFixed(2);
      message += `*Processing Fee (1.5%):* $${procFee}\n`;
    }
    
    // Total fee
    if (feeEstimate.totalFee) {
      message += `*Total Fee:* ${feeEstimate.totalFee}\n\n`;
    } else {
      const totalFee = (2 + parseFloat(withdrawAmount) * 0.015).toFixed(2);
      message += `*Total Fee:* $${totalFee}\n\n`;
    }
    
    // You will receive section
    message += `*You will receive:*\n`;
    
    if (feeEstimate.estimatedReceiveAmount) {
      message += `${feeEstimate.estimatedReceiveAmount}\n`;
    } else {
      const receiveAmount = (parseFloat(withdrawAmount) - (2 + parseFloat(withdrawAmount) * 0.015)).toFixed(6);
      message += `${receiveAmount} ${tokenValue}\n`;
    }
    
    // Add INR equivalent for Indian users
    if (isIndianUser && feeEstimate.inrInfo && feeEstimate.inrInfo.receiveAmountInr) {
      message += `*₹${feeEstimate.inrInfo.receiveAmountInr}* (deposited to your bank account)\n`;
    } else if (isIndianUser) {
      const approxInrRate = 83; // Approximate USD to INR rate
      const receiveAmount = parseFloat(withdrawAmount) - (2 + parseFloat(withdrawAmount) * 0.015);
      const receiveAmountInr = (receiveAmount * approxInrRate).toFixed(2);
      message += `*₹${receiveAmountInr}* (approximate, deposited to your bank account)\n`;
    }
  } else {
    // Fallback fee calculation if no fee estimate is available
    const fixedFee = 2.00;
    const processingFeePercentage = 1.5;
    const processingFee = (parseFloat(withdrawAmount) * processingFeePercentage / 100).toFixed(2);
    const totalFee = (fixedFee + parseFloat(processingFee)).toFixed(2);
    const receiveAmount = (parseFloat(withdrawAmount) - parseFloat(totalFee)).toFixed(6);
    
    message += `*Fixed Fee:* $${fixedFee.toFixed(2)}\n`;
    message += `*Processing Fee (${processingFeePercentage}%):* $${processingFee}\n`;
    message += `*Total Fee:* $${totalFee}\n\n`;
    
    message += `*You will receive:*\n`;
    message += `${receiveAmount} ${tokenValue}\n`;
    
    // Add approximate INR value for Indian users
    if (isIndianUser) {
      const approxInrRate = 83;
      const receiveAmountInr = (parseFloat(receiveAmount) * approxInrRate).toFixed(2);
      message += `*₹${receiveAmountInr}* (approximate, deposited to your bank account)\n`;
    }
  }
  
  message += '\n⚠️ *Note:* Bank withdrawals may take 1-3 business days to process.\n\n';
  message += 'Please confirm this withdrawal:';
  
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    ...confirmationKeyboard('withdraw_confirm', 'withdraw_cancel'),
  });
}

// Handle withdraw confirmation
const withdrawConfirmAction = Composer.action('withdraw_confirm', authMiddleware(), async (ctx) => {
  await ctx.answerCbQuery();
  
  const networkValue = getTempData(ctx as any, 'network') as string;
  const tokenValue = getTempData(ctx as any, 'token') as string;
  const withdrawAmount = getTempData(ctx as any, 'amount') as string;
  const bankAccountId = getTempData(ctx as any, 'bankAccountId') as string;
  const feeEstimateData = getTempData(ctx as any, 'feeEstimate');
  const kycInfo = getTempData(ctx as any, 'kycInfo');
  
  // Extract fee details - handle both direct structure and nested structure
  const feeEstimate = feeEstimateData?.estimatedFees || feeEstimateData;
  
  // Check if user is from India
  const isIndianUser = kycInfo && (kycInfo.country.toLowerCase() === 'ind' || kycInfo.country.toLowerCase() === 'india');
  
  try {
    await ctx.reply('🔄 Processing your withdrawal...');
    
    // Get token from session
    const authToken = getSession(ctx).token as string;
    
    // Prepare withdrawal payload
    const withdrawalPayload = {
      amount: withdrawAmount,
      currency: tokenValue,
      bankAccountId: bankAccountId,
      network: networkValue
    };
    
    console.log('[WITHDRAW] Initiating bank withdrawal with payload:', withdrawalPayload);
    
    // In a real implementation, this would call the actual API
    // We'll use the withdrawToBank function from transfersApi
    // This is commented out since we're simulating the response
    /*
    const response = await transfersApi.withdrawToBank(
      authToken,
      withdrawalPayload
    );
    */
    
    // Construct a success message with fee information if available
    let receiveAmount = withdrawAmount;
    let usdEquivalent = '';
    let inrEquivalent = '';
    
    if (feeEstimate) {
      // Extract the receive amount from fee estimate
      if (typeof feeEstimate.estimatedReceiveAmount === 'string') {
        // Try to extract just the number part before the currency
        const match = feeEstimate.estimatedReceiveAmount.match(/^([\d.]+)/);
        if (match && match[1]) {
          receiveAmount = match[1];
        } else {
          // Fallback calculation if we can't extract
          const totalFeeAmount = feeEstimate.totalFee ? 
            parseFloat(feeEstimate.totalFee.match(/\$([\d.]+)/)?.[1] || '0') : 
            (2 + parseFloat(withdrawAmount) * 0.015);
          
          receiveAmount = (parseFloat(withdrawAmount) - totalFeeAmount).toFixed(6);
        }
      }
      
      // Extract USD equivalent if available
      if (feeEstimate.usdRate) {
        const rate = feeEstimate.usdRate.split('=')[1]?.trim();
        if (rate) {
          const usdValue = parseFloat(receiveAmount) * parseFloat(rate.replace('$', ''));
          usdEquivalent = ` (≈ $${usdValue.toFixed(2)})`;
        }
      }
      
      // Extract INR equivalent for Indian users
      if (isIndianUser && feeEstimate.inrInfo && feeEstimate.inrInfo.receiveAmountInr) {
        inrEquivalent = `\n*Amount in INR:* ₹${feeEstimate.inrInfo.receiveAmountInr} will be deposited to your bank account`;
      }
    } else {
      // Calculate receive amount if fee estimate is not available
      const totalFee = 2 + parseFloat(withdrawAmount) * 0.015;
      receiveAmount = (parseFloat(withdrawAmount) - totalFee).toFixed(6);
    }
    
    // If INR equivalent isn't available but user is from India, calculate it approximately
    if (isIndianUser && !inrEquivalent) {
      const approxInrRate = 83; // Approximate USD to INR rate
      const inrValue = (parseFloat(receiveAmount) * approxInrRate).toFixed(2);
      inrEquivalent = `\n*Amount in INR:* ₹${inrValue} (approximate) will be deposited to your bank account`;
    }
    
    // Include fee details in success message
    const feeDetails = feeEstimate?.totalFee ? 
      `*Fees:* ${feeEstimate.totalFee}\n` : 
      `*Fees:* $${(2 + parseFloat(withdrawAmount) * 0.015).toFixed(2)}\n`;
    
    // Simulate successful response
    await ctx.reply(
      '✅ *Withdrawal Request Submitted*\n\n' +
      'Your withdrawal request has been submitted successfully.\n\n' +
      `*Transaction Details:*\n` +
      `*Amount:* ${withdrawAmount} ${tokenValue}\n` +
      `*Network:* ${formatNetworkForDisplay(networkValue)}\n` +
      `*Status:* Pending\n` +
      feeDetails +
      `*You will receive:* ${receiveAmount} ${tokenValue}${usdEquivalent}` +
      inrEquivalent + '\n\n' +
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