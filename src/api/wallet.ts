import axios from 'axios';
import config from '../config';
import { Wallet, Balance, WalletWithBalances } from '../types';

// Create axios instance with base URL
const api = axios.create({
  baseURL: config.api.baseURL,
});

/**
 * Get all wallets for the authenticated user
 * @param token Authentication token
 * @returns Promise with wallet data
 */
export const getWallets = async (token: string): Promise<Wallet[]> => {
  console.log('[WALLET API] Fetching all wallets');
  try {
    const response = await api.get('/wallets', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    // Log the raw response to understand its format
    console.log(`[WALLET API] Response:`, response.data);
    
    // Determine if the response is directly an array or has a .data property
    const wallets = Array.isArray(response.data) ? response.data : (response.data.data || []);
    console.log(`[WALLET API] Successfully fetched ${wallets.length} wallets`);
    
    return wallets;
  } catch (error) {
    console.error('[WALLET API] Error fetching wallets:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[WALLET API] API error response:', error.response.data);
      throw new Error(
        error.response.data.message || 'Failed to get wallets',
      );
    }
    throw new Error('Network error occurred');
  }
};

/**
 * Get balances for the authenticated user
 * @param token Authentication token
 * @returns Promise with wallet balance data
 */
export const getBalances = async (token: string): Promise<WalletWithBalances[]> => {
  console.log('[WALLET API] Fetching wallet balances');
  try {
    const response = await api.get('/wallets/balances', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    // Log the raw response to understand its format
    console.log(`[WALLET API] Response:`, response.data);
    
    // Determine if the response is directly an array or has a .data property
    const walletBalances = Array.isArray(response.data) ? response.data : (response.data.data || []);
    console.log(`[WALLET API] Successfully fetched balances for ${walletBalances.length} wallets`);
    
    return walletBalances;
  } catch (error) {
    console.error('[WALLET API] Error fetching balances:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[WALLET API] API error response:', error.response.data);
      throw new Error(
        error.response.data.message || 'Failed to get balances',
      );
    }
    throw new Error('Network error occurred');
  }
};

/**
 * Set default wallet
 * @param token Authentication token
 * @param walletId Wallet ID to set as default
 * @returns Promise with success status
 */
export const setDefaultWallet = async (token: string, walletId: string): Promise<boolean> => {
  console.log(`[WALLET API] Setting wallet ${walletId} as default`);
  try {
    const response = await api.post(
      '/wallets/default',
      { walletId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    
    // Log the raw response to understand its format
    console.log(`[WALLET API] Response:`, response.data);
    console.log('[WALLET API] Default wallet set successfully');
    
    return true;
  } catch (error) {
    console.error(`[WALLET API] Error setting default wallet ${walletId}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[WALLET API] API error response:', error.response.data);
      throw new Error(
        error.response.data.message || 'Failed to set default wallet',
      );
    }
    throw new Error('Network error occurred');
  }
};

/**
 * Get default wallet
 * @param token Authentication token
 * @returns Promise with default wallet data
 */
export const getDefaultWallet = async (token: string): Promise<Wallet> => {
  console.log('[WALLET API] Fetching default wallet');
  try {
    const response = await api.get('/wallets/default', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    // Log the raw response to understand its format
    console.log(`[WALLET API] Response:`, response.data);
    
    // Extract wallet - could be directly in response.data or in response.data.data
    const wallet = response.data.data || response.data;
    console.log('[WALLET API] Default wallet fetched successfully');
    
    return wallet;
  } catch (error) {
    console.error('[WALLET API] Error fetching default wallet:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[WALLET API] API error response:', error.response.data);
      throw new Error(
        error.response.data.message || 'Failed to get default wallet',
      );
    }
    throw new Error('Network error occurred');
  }
};

/**
 * Generate a new wallet for the specified network
 * @param token Authentication token
 * @param networkId Network ID for the new wallet (e.g., '137' for Polygon, '1' for Ethereum)
 * @returns Promise with the newly created wallet data
 */
export const generateWallet = async (token: string, networkId: string): Promise<Wallet> => {
  console.log(`[WALLET API] Generating new wallet for network ID: ${networkId}`);
  try {
    console.log(`[WALLET API] Sending POST request to /wallets with network: ${networkId}`);
    
    const response = await api.post('/wallets', 
      { network: networkId }, // Pass as "network" but use the ID
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    
    console.log(`[WALLET API] New wallet generated successfully for network ID: ${networkId}`);
    console.log(`[WALLET API] Raw API response:`, JSON.stringify(response.data));
    
    // Log the structure of the response to understand its format
    console.log(`[WALLET API] Response type:`, typeof response.data);
    
    // Check if response.data has a data property or is the wallet directly
    if (response.data && typeof response.data === 'object') {
      if (response.data.hasOwnProperty('data')) {
        console.log(`[WALLET API] Response contains a data property`);
        return response.data.data;
      } else if (response.data.hasOwnProperty('walletAddress') || response.data.hasOwnProperty('address')) {
        console.log(`[WALLET API] Response is the wallet object directly`);
        return response.data;
      }
    }
    
    console.log(`[WALLET API] Response format unexpected, returning as is`);
    return response.data;
  } catch (error) {
    console.error(`[WALLET API] Error generating wallet for network ID ${networkId}:`, error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[WALLET API] API error response:', error.response.data);
      throw new Error(
        error.response.data.message || `Failed to generate wallet for network ID ${networkId}`,
      );
    }
    throw new Error('Network error occurred while generating wallet');
  }
}; 