import axios from 'axios';
import config from '../config';
import { ApiResponse, EmailTransferPayload, Transfer } from '../types';

// Create axios instance with base URL
const api = axios.create({
  baseURL: config.api.baseURL,
});

/**
 * Get transfer history for the authenticated user
 * @param token Authentication token
 * @param page Page number (default: 1)
 * @param limit Results per page (default: 10)
 * @returns Promise with transfer history data
 */
export const getTransferHistory = async (
  token: string,
  page = 1,
  limit = 10,
): Promise<
  ApiResponse<{
    page: number;
    limit: number;
    count: number;
    hasMore: boolean;
    data: Transfer[];
  }>
> => {
  try {
    // Create URL with parameters
    let url = `/transactions?page=${page}&limit=${limit}`;

    console.log(`[API] Making request to ${url}`);

    // Log token (first 10 chars only for security)
    const tokenPreview = token ? `${token.substring(0, 10)}...` : 'undefined';
    console.log(`[API] Using auth token: ${tokenPreview}`);

    // Make the API request
    const response = await api.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`[API] Response status: ${response.status}`);
    console.log(`[API] Response headers:`, response.headers);

    // Log a summary of the response data for easier debugging
    if (response.data && response.data.data) {
      console.log(
        `[API] Got ${response.data.data.length} transactions of ${response.data.count} total`,
      );

      // Log status counts to check if filtering is working
      if (response.data.data.length > 0) {
        const statusCounts = {};
        response.data.data.forEach((item) => {
          const itemStatus = item.status || 'unknown';
          statusCounts[itemStatus] = (statusCounts[itemStatus] || 0) + 1;
        });
        console.log(`[API] Status distribution in response:`, statusCounts);
      }

      // Log full response data in debug mode
      console.log(
        `[API] Response data:`,
        JSON.stringify(response.data, null, 2),
      );
    } else {
      console.log(`[API] Unexpected response data:`, response.data);
    }

    // Check if response data has the expected structure
    if (!response.data || !response.data.data) {
      console.error('[API] Unexpected response structure:', response.data);
      throw new Error('API returned invalid response format');
    }

    return response.data;
  } catch (error) {
    console.error('[API] Error in getTransferHistory:', error);

    if (axios.isAxiosError(error)) {
      console.error('[API] Axios error details:');
      console.error(`[API] Status: ${error.response?.status}`);
      console.error(`[API] Status text: ${error.response?.statusText}`);
      console.error(`[API] Response data:`, error.response?.data);
      console.error(`[API] Request URL: ${error.config?.url}`);
      console.error(
        `[API] Request method: ${error.config?.method?.toUpperCase()}`,
      );

      if (error.response) {
        throw new Error(
          error.response.data.message ||
            `Failed to get transfer history: ${error.response.status} ${error.response.statusText}`,
        );
      }
    }

    throw new Error(
      `Network error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

// Helper function to ensure amounts are properly formatted
function formatCryptoAmount(amount: string | number): string {
  try {
    // First ensure we have a number to work with
    let numericAmount: number;
    if (typeof amount === 'string') {
      // Parse the string amount
      numericAmount = parseFloat(amount);
    } else {
      numericAmount = amount;
    }

    // Check if this amount might already be in the smallest unit
    // (large numbers are likely already multiplied)
    const LARGE_THRESHOLD = 1000000; // Arbitrary threshold to detect already-multiplied values
    if (numericAmount > LARGE_THRESHOLD) {
      console.log(
        '[API] Amount appears to be already in smallest unit:',
        numericAmount,
      );
      return numericAmount.toString();
    }

    // Multiply by 10^8 to convert to smallest unit
    const multiplier = Math.pow(10, 8);
    const scaledAmount = numericAmount * multiplier;

    // Format as string without scientific notation for large numbers
    return scaledAmount.toLocaleString('fullwide', { useGrouping: false });
  } catch (error) {
    console.error('[API] Error formatting crypto amount:', error);
    // Return the original amount as string if conversion fails
    return amount.toString();
  }
}

/**
 * Send funds to an email address
 * @param token Authentication token
 * @param payload Email transfer payload
 * @returns Promise with transfer response
 */
export const sendEmailTransfer = async (
  token: string,
  data: {
    amount: string | number;
    token: string;
    receiverEmail: string;
    network: string;
    note?: string;
  },
) => {
  try {
    // Always format the amount by multiplying by 10^8
    const formattedAmount = formatCryptoAmount(data.amount);
    console.log(
      `[API] Original amount: ${data.amount}, formatted: ${formattedAmount}`,
    );

    console.log('[API] Sending email transfer with data:', {
      ...data,
      amount: formattedAmount,
    });

    // Format request body according to API requirements
    const requestBody = {
      email: data.receiverEmail,
      amount: formattedAmount, // Using the formatted amount
      currency: data.token,
      purposeCode: 'self',
      note: data.note || undefined,
    };

    console.log('[API] Formatted request body:', JSON.stringify(requestBody));

    const response = await axios.post(
      `${config.api.baseURL}/transfers/send`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log('[API] Send email transfer response status:', response.status);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[API] Send email transfer error:', error);

    // Better error handling
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};

/**
 * Send funds to an external wallet address
 * @param token Authentication token
 * @param payload Wallet transfer payload
 * @returns Promise with transfer response
 */
export const sendWalletTransfer = async (
  token: string,
  data: {
    amount: string | number;
    token: string;
    receiverAddress: string;
    network: string;
    note?: string;
  },
) => {
  try {
    // Always format the amount by multiplying by 10^8
    const formattedAmount = formatCryptoAmount(data.amount);
    console.log(
      `[API] Original amount: ${data.amount}, formatted: ${formattedAmount}`,
    );

    console.log('[API] Sending wallet transfer with data:', {
      ...data,
      amount: formattedAmount,
    });

    // Format request body according to API requirements
    const requestBody = {
      walletAddress: data.receiverAddress,
      amount: formattedAmount, // Using the formatted amount
      currency: data.token,
      purposeCode: 'self',
      note: data.note || undefined,
    };

    console.log('[API] Formatted request body:', JSON.stringify(requestBody));

    // Use the wallet-withdraw endpoint
    const response = await axios.post(
      `${config.api.baseURL}/transfers/wallet-withdraw`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log('[API] Send wallet transfer response status:', response.status);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[API] Send wallet transfer error:', error);

    // Better error handling
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};

/**
 * Get offramp quote for bank withdrawal
 * @param token Authentication token
 * @param quoteData Quote request data
 * @returns Promise with quote response
 */
export const getOfframpQuote = async (
  token: string,
  quoteData: {
    amount: string;
    currency: string;
    destinationCountry: string;
    onlyRemittance: boolean;
    preferredBankAccountId: string;
    sourceCountry: string;
  },
): Promise<any> => {
  try {
    // Ensure amount is properly formatted (as smallest unit)
    if (quoteData.amount && !quoteData.amount.includes('e+')) {
      quoteData.amount = formatCryptoAmount(quoteData.amount);
    }

    console.log('[API] Getting offramp quote with data:', {
      ...quoteData,
      preferredBankAccountId:
        quoteData.preferredBankAccountId.slice(0, 8) + '...',
    });

    const response = await api.post('/quotes/offramp', quoteData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('[API] Offramp quote response status:', response.status);
    console.log(
      '[API] Quote payload signature:',
      response.data.quoteSignature?.slice(0, 20) + '...',
    );

    // Parse and validate quote payload for additional checks
    try {
      const quotePayload = JSON.parse(response.data.quotePayload);
      console.log('[API] Quote details:', {
        fromAmount: parseInt(quotePayload.amount) / 1e8,
        toAmount: parseInt(quotePayload.toAmount) / 1e8,
        fee: parseInt(quotePayload.totalFee) / 1e8,
        rate: quotePayload.rate,
      });
    } catch (e) {
      console.warn('[API] Could not parse quote payload:', e);
    }

    return response.data;
  } catch (error) {
    console.error('[API] Offramp quote error:', error);

    // Better error handling
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};

/**
 * Create offramp transfer to withdraw funds to bank
 * @param token Authentication token
 * @param transferData Transfer request data
 * @returns Promise with transfer response
 */
export const createOfframpTransfer = async (
  token: string,
  transferData: {
    purposeCode: string;
    quotePayload: string;
    quoteSignature: string;
  },
): Promise<any> => {
  try {
    console.log(
      '[API] Creating offramp transfer with signature:',
      transferData.quoteSignature?.slice(0, 15) + '...',
    );

    const response = await api.post('/transfers/offramp', transferData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('[API] Offramp transfer response status:', response.status);
    console.log('[API] Transfer ID:', response.data.id);
    console.log('[API] Transfer status:', response.data.status);

    return response.data;
  } catch (error) {
    console.error('[API] Offramp transfer error:', error);

    // Better error handling with specific messages for common errors
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};

/**
 * Get user's bank accounts and payment methods
 * @param token Authentication token
 * @returns Promise with accounts data
 */
export const getAccounts = async (
  token: string,
): Promise<{
  success: boolean;
  data: any[];
}> => {
  try {
    console.log('[API] Fetching user accounts...');

    const response = await api.get('/accounts', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`[API] Accounts response status: ${response.status}`);
    console.log(`[API] Found ${response.data.data?.length || 0} accounts`);

    if (response.data.data) {
      // Count bank accounts vs. other account types for debugging
      const accountTypes = {};
      response.data.data.forEach((acc) => {
        const type = acc.type || 'unknown';
        accountTypes[type] = (accountTypes[type] || 0) + 1;
      });
      console.log('[API] Account types:', accountTypes);

      // Check verification status of bank accounts
      const bankAccounts = response.data.data.filter(
        (acc) => acc.type === 'bank_account',
      );
      if (bankAccounts.length > 0) {
        const statusCounts = {};
        bankAccounts.forEach((acc) => {
          const status = acc.status || 'unknown';
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log('[API] Bank account verification status:', statusCounts);
      }
    }

    return {
      success: true,
      data: response.data.data || [],
    };
  } catch (error) {
    console.error('[API] Error fetching accounts:', error);

    // Better error handling
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};

/**
 * Interface for bank withdrawal payload
 */
export interface BankWithdrawalPayload {
  amount: string;
  currency: string;
  network?: string;
  bankAccountId?: string;
  note?: string;
  // New fields required by the API
  invoiceNumber?: string;
  invoiceUrl?: string;
  purposeCode?:
    | 'self'
    | 'family_support'
    | 'education'
    | 'medical'
    | 'travel'
    | 'business'
    | 'other';
  sourceOfFunds?:
    | 'salary'
    | 'business_income'
    | 'investments'
    | 'inheritance'
    | 'savings'
    | 'gift'
    | 'other';
  recipientRelationship?: 'self' | 'family' | 'friend' | 'business' | 'other';
  quotePayload?: string;
  quoteSignature?: string;
  preferredWalletId?: string;
  customerData?: {
    name?: string;
    businessName?: string;
    email?: string;
    country?: string;
  };
  sourceOfFundsFile?: string;
}

/**
 * Withdraw funds to a bank account
 * @param token Authentication token
 * @param payload Bank withdrawal payload
 * @returns Promise with transfer response
 */
export const withdrawToBank = async (
  token: string,
  payload: BankWithdrawalPayload,
): Promise<ApiResponse<Transfer>> => {
  try {
    console.log(
      `[API] Initiating bank withdrawal for ${payload.amount} ${payload.currency}`,
    );

    // Set default values for required fields if not provided
    const enhancedPayload = {
      ...payload,
      purposeCode: payload.purposeCode || 'self',
      sourceOfFunds: payload.sourceOfFunds || 'salary',
      recipientRelationship: payload.recipientRelationship || 'self',
      // If customerData not provided, include an empty object
      customerData: payload.customerData || {},
    };

    console.log(
      `[API] Bank withdrawal payload:`,
      JSON.stringify(enhancedPayload, null, 2),
    );

    const response = await api.post('/transfers/offramp', enhancedPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(
      `[API] Bank withdrawal response:`,
      JSON.stringify(response.data, null, 2),
    );

    return response.data;
  } catch (error) {
    console.error('[API] Bank withdrawal error:', error);

    if (axios.isAxiosError(error) && error.response) {
      console.error(
        '[API] Bank withdrawal response error:',
        error.response.data,
      );
      throw new Error(
        error.response.data.message || 'Failed to withdraw to bank',
      );
    }
    throw new Error('Network error occurred during bank withdrawal');
  }
};

/**
 * Send batch transfers
 * @param token Authentication token
 * @param payloads Array of email transfer payloads
 * @returns Promise with transfer response
 */
export const sendBatchTransfers = async (
  token: string,
  payloads: EmailTransferPayload[],
): Promise<ApiResponse<Transfer[]>> => {
  try {
    const response = await api.post(
      '/transfers/send-batch',
      { transfers: payloads },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.message || 'Failed to send batch transfers',
      );
    }
    throw new Error('Network error occurred');
  }
};

/**
 * Send batch payments to multiple recipients
 * @param token Authentication token
 * @param batchPayments Array of payment objects
 * @returns Promise with batch transfer response
 */
export const sendBatchPayments = async (
  token: string,
  batchPayments: Array<{
    email: string;
    amount: string;
    currency: string;
    purposeCode: string;
    note?: string;
  }>,
) => {
  try {
    console.log(
      `[API] Sending batch payment with ${batchPayments.length} recipients`,
    );

    // Format all amounts in the batch
    const formattedBatch = batchPayments.map((payment) => ({
      ...payment,
      amount: formatCryptoAmount(payment.amount),
    }));

    console.log(
      '[API] Formatted batch payment requests:',
      JSON.stringify(formattedBatch, null, 2),
    );

    const response = await api.post(
      '/transfers/send-batch',
      { transfers: formattedBatch },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log(`[API] Batch payment response status: ${response.status}`);
    console.log(
      `[API] Batch payment response data:`,
      JSON.stringify(response.data, null, 2),
    );

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('[API] Batch payment error:', error);

    // Better error handling
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};

/**
 * Get bank withdrawal quote for fiat conversion
 * @param token Authentication token
 * @param quoteRequest Quote request data
 * @returns Promise with quote response
 */
export const getBankWithdrawalQuote = async (
  token: string,
  quoteRequest: {
    amount: string;
    currency: string;
    destinationCountry: string;
    onlyRemittance: boolean;
    preferredBankAccountId: string;
    sourceCountry: string;
  },
): Promise<any> => {
  try {
    // Ensure amount is properly formatted (as smallest unit)
    if (quoteRequest.amount && !quoteRequest.amount.includes('e+')) {
      quoteRequest.amount = formatCryptoAmount(quoteRequest.amount);
    }

    console.log('[API] Getting bank withdrawal quote with data:', {
      ...quoteRequest,
      preferredBankAccountId:
        quoteRequest.preferredBankAccountId.slice(0, 8) + '...',
    });

    const response = await api.post('/quotes/offramp', quoteRequest, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('[API] Bank quote response status:', response.status);
    console.log(
      '[API] Quote payload signature:',
      response.data.quoteSignature?.slice(0, 20) + '...',
    );

    // Parse and validate quote payload for additional checks
    try {
      const quotePayload = JSON.parse(response.data.quotePayload);
      console.log('[API] Quote details:', {
        fromAmount: parseInt(quotePayload.amount) / 1e8,
        toAmount: parseInt(quotePayload.toAmount) / 1e8,
        fee: parseInt(quotePayload.totalFee) / 1e8,
        rate: quotePayload.rate,
      });
    } catch (e) {
      console.warn('[API] Could not parse quote payload:', e);
    }

    return response.data;
  } catch (error) {
    console.error('[API] Bank quote error:', error);

    // Better error handling
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};

/**
 * Process bank withdrawal transfer
 * @param token Authentication token
 * @param withdrawalData Withdrawal request data
 * @returns Promise with transfer response
 */
export const processBankWithdrawal = async (
  token: string,
  withdrawalData: {
    purposeCode: string;
    quotePayload: string;
    quoteSignature: string;
  },
): Promise<any> => {
  try {
    console.log(
      '[API] Processing bank withdrawal with signature:',
      withdrawalData.quoteSignature?.slice(0, 15) + '...',
    );

    const response = await api.post('/transfers/offramp', withdrawalData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('[API] Bank withdrawal response status:', response.status);
    console.log('[API] Withdrawal ID:', response.data.id);
    console.log('[API] Withdrawal status:', response.data.status);

    return response.data;
  } catch (error) {
    console.error('[API] Bank withdrawal error:', error);

    // Better error handling with specific messages for common errors
    let errorMessage = 'Unknown API error';

    throw new Error(errorMessage);
  }
};
