import axios from 'axios';
import config from '../config';

/**
 * Check KYC status for the current user
 * @param token Authentication token
 * @returns Promise with KYC status
 */
export const getKycStatus = async (token: string) => {
  try {
    console.log('[API] Checking KYC status');
    
    const response = await axios.get(
      `${config.api.baseURL}/kycs?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('[API] KYC status response:', response.status);
    
    // Check if we have any KYC data
    if (response.data && response.data.data && response.data.data.length > 0) {
      const kycData = response.data.data[0];
      console.log(`[API] Found KYC with status: ${kycData.status}`);
      
      return {
        success: true,
        status: kycData.status,
        type: kycData.type,
        isApproved: kycData.status === 'approved',
        data: kycData
      };
    }
    
    return {
      success: true,
      status: 'not_submitted',
      isApproved: false,
      data: null
    };
  } catch (error) {
    console.error('[API] Error checking KYC status:', error);
    
    let errorMessage = 'Failed to verify KYC status';
    if (error.response && error.response.data) {
      errorMessage = error.response.data.message || error.response.data.error || errorMessage;
    }
    
    return {
      success: false,
      status: 'error',
      isApproved: false,
      error: errorMessage
    };
  }
};

/**
 * Get fee estimate for bank withdrawal
 * @param token Authentication token
 * @param amount Amount to withdraw
 * @param currency Currency code
 * @param country Optional country code for currency conversion
 * @returns Promise with fee estimation
 */
export const getWithdrawalFeeEstimate = async (token: string, amount: string, currency: string, country?: string) => {
  try {
    console.log(`[API] Getting fee estimate for ${amount} ${currency}, country: ${country || 'not specified'}`);
    
    // Convert currency symbols to CoinGecko IDs
    const currencyMapping = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'SOL': 'solana',
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'MATIC': 'matic-network',
      'DOT': 'polkadot',
      'AVAX': 'avalanche-2',
      'LINK': 'chainlink',
      'LTC': 'litecoin',
      'SHIB': 'shiba-inu',
      // Add more mappings as needed
    };
    
    // Default to the currency as ID if no mapping found
    const coinId = currencyMapping[currency.toUpperCase()] || currency.toLowerCase();
    
    // Get current price from CoinGecko
    const priceResponse = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,inr`
    );
    
    console.log('[API] CoinGecko price response:', priceResponse.data);
    
    // Extract price from response
    let usdPrice = 1; // Default to 1 for stablecoins if price not found
    let inrPrice = 83; // Default INR to USD rate if not found (approximate)
    
    if (priceResponse.data && priceResponse.data[coinId]) {
      if (priceResponse.data[coinId].usd) {
        usdPrice = priceResponse.data[coinId].usd;
        console.log(`[API] Current ${currency} price: $${usdPrice}`);
      }
      
      if (priceResponse.data[coinId].inr) {
        inrPrice = priceResponse.data[coinId].inr;
        console.log(`[API] Current ${currency} price in INR: ₹${inrPrice}`);
      }
    } else {
      console.log(`[API] Could not get price for ${currency}, using 1 USD as fallback`);
      
      // If we couldn't get the price directly, try to get USD to INR conversion rate
      try {
        const usdInrResponse = await axios.get(
          `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=inr`
        );
        
        if (usdInrResponse.data && usdInrResponse.data.tether && usdInrResponse.data.tether.inr) {
          inrPrice = usdInrResponse.data.tether.inr;
          console.log(`[API] USD to INR rate (via USDT): ₹${inrPrice}`);
        }
      } catch (error) {
        console.log(`[API] Could not get USD to INR rate, using default value: ₹83`);
      }
    }
    
    // Calculate USD value of the withdrawal
    const numericAmount = parseFloat(amount);
    const usdValue = numericAmount * usdPrice;
    console.log(`[API] USD value of withdrawal: $${usdValue.toFixed(2)}`);
    
    // Calculate INR value
    const inrValue = numericAmount * inrPrice;
    console.log(`[API] INR value of withdrawal: ₹${inrValue.toFixed(2)}`);
    
    // Calculate withdrawal fees
    // Fixed fee of $2 + 1.5% processing fee
    const fixedFee = 2; // $2 USD
    const processingFeePercentage = 1.5; // 1.5%
    const processingFee = usdValue * (processingFeePercentage / 100);
    const totalFeeUsd = fixedFee + processingFee;
    
    // Calculate fees in original currency
    const fixedFeeInCurrency = fixedFee / usdPrice;
    const processingFeeInCurrency = processingFee / usdPrice;
    const totalFeeInCurrency = totalFeeUsd / usdPrice;
    
    // Calculate amount user will receive after fees (in both USD and original currency)
    const receiveAmountUsd = usdValue - totalFeeUsd;
    const receiveAmountInCurrency = numericAmount - totalFeeInCurrency;
    
    // Calculate INR amount that will be received
    const receiveAmountInr = receiveAmountUsd * (inrPrice / usdPrice);
    
    console.log(`[API] Fee calculation:
      Amount: ${numericAmount} ${currency} (≈ $${usdValue.toFixed(2)} / ₹${inrValue.toFixed(2)})
      Fixed fee: $${fixedFee.toFixed(2)} (≈ ${fixedFeeInCurrency.toFixed(8)} ${currency})
      Processing fee (${processingFeePercentage}%): $${processingFee.toFixed(2)} (≈ ${processingFeeInCurrency.toFixed(8)} ${currency})
      Total fee: $${totalFeeUsd.toFixed(2)} (≈ ${totalFeeInCurrency.toFixed(8)} ${currency})
      Receive amount: $${receiveAmountUsd.toFixed(2)} (≈ ${receiveAmountInCurrency.toFixed(8)} ${currency})
      Receive amount in INR: ₹${receiveAmountInr.toFixed(2)}
    `);
    
    // Format fee information in a clear, readable format
    const formattedFixedFee = `$${fixedFee.toFixed(2)} (${fixedFeeInCurrency.toFixed(6)} ${currency})`;
    const formattedProcessingFee = `$${processingFee.toFixed(2)} (${processingFeeInCurrency.toFixed(6)} ${currency})`;
    const formattedTotalFee = `$${totalFeeUsd.toFixed(2)} (${totalFeeInCurrency.toFixed(6)} ${currency})`;
    
    // Format receive amount
    const formattedReceiveAmount = `${receiveAmountInCurrency.toFixed(6)} ${currency} (≈ $${receiveAmountUsd.toFixed(2)})`;
    
    // INR specific information
    const isIndianUser = country && (country.toLowerCase() === 'ind' || country.toLowerCase() === 'india');
    const inrSpecificInfo = isIndianUser ? {
      inrValue: inrValue.toFixed(2),
      receiveAmountInr: receiveAmountInr.toFixed(2),
      inrRate: `1 ${currency} = ₹${inrPrice.toFixed(2)}`
    } : null;
    
    // Create a flat response structure that's easier to access
    const estimatedFees = {
      fixedFee: formattedFixedFee,
      percentage: processingFeePercentage.toString(),
      processingFee: formattedProcessingFee,
      totalFee: formattedTotalFee,
      estimatedReceiveAmount: formattedReceiveAmount,
      usdRate: `1 ${currency} = $${usdPrice}`,
      inrInfo: inrSpecificInfo
    };
    
    return {
      success: true,
      estimatedFees: estimatedFees,
      data: {
        estimatedFees: estimatedFees,
        usdValue: usdValue.toFixed(2),
        inrValue: inrValue.toFixed(2),
        exchangeRate: usdPrice,
        inrRate: inrPrice
      }
    };
  } catch (error) {
    console.error(`[API] Error getting fee estimate:`, error);
    
    // Create fallback fees
    const numericAmount = parseFloat(amount);
    const fixedFee = 2; // $2 USD
    const processingFeePercentage = 1.5; // 1.5%
    const processingFee = (numericAmount * processingFeePercentage / 100).toFixed(2);
    const totalFee = (fixedFee + parseFloat(processingFee)).toFixed(2);
    const receiveAmount = Math.max(0, numericAmount - parseFloat(totalFee)).toFixed(6);
    
    // Approximate INR values (assuming 1 USD ≈ 83 INR)
    const inrApproxRate = 83;
    const inrValue = (numericAmount * inrApproxRate).toFixed(2);
    const receiveAmountInr = (parseFloat(receiveAmount) * inrApproxRate).toFixed(2);
    
    // INR specific information
    const isIndianUser = country && (country.toLowerCase() === 'ind' || country.toLowerCase() === 'india');
    const inrSpecificInfo = isIndianUser ? {
      inrValue: inrValue,
      receiveAmountInr: receiveAmountInr,
      inrRate: `1 ${currency} ≈ ₹${inrApproxRate} (approximate)`
    } : null;
    
    // Create fallback fee estimates in consistent format
    const estimatedFees = {
      fixedFee: `$${fixedFee.toFixed(2)}`,
      percentage: processingFeePercentage.toString(),
      processingFee: `$${processingFee} (${processingFeePercentage}%)`,
      totalFee: `$${totalFee}`,
      estimatedReceiveAmount: `${receiveAmount} ${currency} (estimated)`,
      usdRate: `1 ${currency} ≈ $1.00 (approximate)`,
      inrInfo: inrSpecificInfo
    };
    
    return {
      success: false,
      error: 'Could not fetch exact fees from CoinGecko',
      estimatedFees: estimatedFees
    };
  }
}; 