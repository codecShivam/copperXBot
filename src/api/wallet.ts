import axios from 'axios';
import config from '../config';
import { ApiResponse, Wallet, Balance } from '../types';

// Create axios instance with base URL
const api = axios.create({
  baseURL: config.api.baseURL,
});

/**
 * Get all wallets for the authenticated user
 * @param token Authentication token
 * @returns Promise with wallet data
 */
export const getWallets = async (
  token: string,
): Promise<ApiResponse<Wallet[]>> => {
  try {
    const response = await api.get('/wallets', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
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
 * @returns Promise with balance data
 */
export const getBalances = async (
  token: string,
): Promise<ApiResponse<Balance[]>> => {
  try {
    const response = await api.get('/wallets/balances', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
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
 * @returns Promise with response
 */
export const setDefaultWallet = async (
  token: string,
  walletId: string,
): Promise<ApiResponse<any>> => {
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
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
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
export const getDefaultWallet = async (
  token: string,
): Promise<ApiResponse<Wallet>> => {
  try {
    const response = await api.get('/wallets/default', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.message || 'Failed to get default wallet',
      );
    }
    throw new Error('Network error occurred');
  }
}; 