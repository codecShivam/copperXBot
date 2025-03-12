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
): Promise<ApiResponse<{ items: Transfer[]; total: number }>> => {
  try {
    const response = await api.get(`/transfers?page=${page}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.message || 'Failed to get transfer history',
      );
    }
    throw new Error('Network error occurred');
  }
};

/**
 * Send funds to an email address
 * @param token Authentication token
 * @param payload Email transfer payload
 * @returns Promise with transfer response
 */
export const sendEmailTransfer = async (
  token: string,
  payload: EmailTransferPayload,
): Promise<ApiResponse<Transfer>> => {
  try {
    const response = await api.post('/transfers/send', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.message || 'Failed to send email transfer',
      );
    }
    throw new Error('Network error occurred');
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
  payload: WalletTransferPayload,
): Promise<ApiResponse<Transfer>> => {
  try {
    const response = await api.post('/transfers/wallet-withdraw', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.message || 'Failed to send wallet transfer',
      );
    }
    throw new Error('Network error occurred');
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