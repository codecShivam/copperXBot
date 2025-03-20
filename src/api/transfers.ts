import axios from 'axios';
import config from '../config';
import {
  ApiResponse,
  EmailTransferPayload,
  WalletTransferPayload,
  BankWithdrawalPayload,
  Transfer,
} from '../types';

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
): Promise<ApiResponse<{
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: Transfer[];
}>> => {
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
      console.log(`[API] Got ${response.data.data.length} transactions of ${response.data.count} total`);
      
      // Log status counts to check if filtering is working
      if (response.data.data.length > 0) {
        const statusCounts = {};
        response.data.data.forEach(item => {
          const itemStatus = item.status || 'unknown';
          statusCounts[itemStatus] = (statusCounts[itemStatus] || 0) + 1;
        });
        console.log(`[API] Status distribution in response:`, statusCounts);
      }
      
      // Log full response data in debug mode
      console.log(`[API] Response data:`, JSON.stringify(response.data, null, 2));
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
      console.error(`[API] Request method: ${error.config?.method?.toUpperCase()}`);
      
      if (error.response) {
        throw new Error(
          error.response.data.message || `Failed to get transfer history: ${error.response.status} ${error.response.statusText}`
        );
      }
    }
    
    throw new Error(`Network error occurred: ${error.message}`);
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
      console.log('[API] Amount appears to be already in smallest unit:', numericAmount);
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
export const sendEmailTransfer = async (token: string, data: {
  amount: string | number;
  token: string;
  receiverEmail: string;
  network: string;
  note?: string;
}) => {
  try {
    // Always format the amount by multiplying by 10^8
    const formattedAmount = formatCryptoAmount(data.amount);
    console.log(`[API] Original amount: ${data.amount}, formatted: ${formattedAmount}`);

    console.log('[API] Sending email transfer with data:', {
      ...data,
      amount: formattedAmount
    });
    
    // Format request body according to API requirements
    const requestBody = {
      email: data.receiverEmail,
      amount: formattedAmount, // Using the formatted amount
      currency: data.token,
      purposeCode: "self",
      note: data.note || undefined
    };
    
    console.log('[API] Formatted request body:', JSON.stringify(requestBody));
    
    const response = await axios.post(
      `${config.api.baseURL}/transfers/send`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('[API] Send email transfer response status:', response.status);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[API] Send email transfer error:', error);
    
    // Better error handling
    let errorMessage = 'Unknown API error';
    
    if (error.response && error.response.data) {
      console.error('[API] Error response data:', JSON.stringify(error.response.data));
      if (typeof error.response.data.message === 'string') {
        errorMessage = error.response.data.message;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else {
        errorMessage = `API Error: ${error.response.status} - ${error.response.statusText}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Send funds to an external wallet address
 * @param token Authentication token
 * @param payload Wallet transfer payload
 * @returns Promise with transfer response
 */
export const sendWalletTransfer = async (token: string, data: {
  amount: string | number;
  token: string;
  receiverAddress: string;
  network: string;
  note?: string;
}) => {
  try {
    // Always format the amount by multiplying by 10^8
    const formattedAmount = formatCryptoAmount(data.amount);
    console.log(`[API] Original amount: ${data.amount}, formatted: ${formattedAmount}`);

    console.log('[API] Sending wallet transfer with data:', {
      ...data,
      amount: formattedAmount
    });
    
    // Format request body according to API requirements
    const requestBody = {
      walletAddress: data.receiverAddress,
      amount: formattedAmount, // Using the formatted amount
      currency: data.token,
      purposeCode: "self",
      note: data.note || undefined
    };
    
    console.log('[API] Formatted request body:', JSON.stringify(requestBody));
    
    // Use the wallet-withdraw endpoint
    const response = await axios.post(
      `${config.api.baseURL}/transfers/wallet-withdraw`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('[API] Send wallet transfer response status:', response.status);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[API] Send wallet transfer error:', error);
    
    // Better error handling
    let errorMessage = 'Unknown API error';
    
    if (error.response && error.response.data) {
      console.error('[API] Error response data:', JSON.stringify(error.response.data));
      if (typeof error.response.data.message === 'string') {
        errorMessage = error.response.data.message;
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else {
        errorMessage = `API Error: ${error.response.status} - ${error.response.statusText}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
};

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
    const response = await api.post('/transfers/offramp', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.message || 'Failed to withdraw to bank',
      );
    }
    throw new Error('Network error occurred');
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
    const response = await api.post('/transfers/send-batch', { transfers: payloads }, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
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