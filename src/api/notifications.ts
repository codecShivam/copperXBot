import axios from 'axios';
import config from '../config';
import { ApiResponse } from '../types';

// Create axios instance with base URL
const api = axios.create({
  baseURL: config.api.baseURL,
});

/**
 * Authenticate with Pusher
 * @param token Authentication token
 * @param socketId Socket ID from Pusher
 * @param channelName Channel name to authenticate
 * @returns Promise with authentication data
 */
export const authenticatePusher = async (
  token: string,
  socketId: string,
  channelName: string,
): Promise<{ auth: string; channel_data?: string }> => {
  try {
    console.log('[NOTIFICATIONS API] Authenticating Pusher with socket ID:', socketId, 'channel:', channelName);
    
    const response = await api.post(
      '/notifications/auth',
      {
        socket_id: socketId,
        channel_name: channelName,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    
    console.log('[NOTIFICATIONS API] Pusher authentication response:', response.data);
    
    // Check if the response has the expected structure
    if (!response.data || !response.data.auth) {
      console.error('[NOTIFICATIONS API] Invalid Pusher auth response:', response.data);
      throw new Error('Invalid Pusher authentication response');
    }
    
    // Return the auth data directly
    return {
      auth: response.data.auth,
      channel_data: response.data.channel_data,
    };
  } catch (error) {
    console.error('[NOTIFICATIONS API] Pusher authentication error:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      const errorMessage = error.response.data?.message || 'Failed to authenticate with Pusher';
      console.error('[NOTIFICATIONS API] Pusher auth error response:', error.response.data);
      throw new Error(errorMessage);
    }
    
    throw new Error('Network error occurred during Pusher authentication');
  }
}; 