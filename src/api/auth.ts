import axios from 'axios';
import config from '../config';
import {
  ApiResponse,
  OtpRequestPayload,
  OtpRequestResponse,
  OtpAuthenticatePayload,
  AuthResponse,
  User,
} from '../types';

// Create axios instance with base URL
const api = axios.create({
  baseURL: config.api.baseURL,
});

/**
 * Request email OTP
 * @param payload Email payload
 * @returns Promise with response including session ID
 */
export const requestEmailOtp = async (
  payload: OtpRequestPayload,
): Promise<OtpRequestResponse> => {
  try {
    console.log('[AUTH API] Requesting OTP for email:', payload.email);
    const response = await api.post('/auth/email-otp/request', payload);
    console.log('[AUTH API] OTP request successful, response:', response.data);

    // Return the data directly since it contains the sid at the top level
    return response.data;
  } catch (error) {
    console.error('OTP request error details:', error);

    if (axios.isAxiosError(error)) {
      // For Axios errors with response
      if (error.response) {
        const errorData = error.response.data;
        let errorMessage: string;

        // Handle validation errors (422) which may have array messages
        if (Array.isArray(errorData.message)) {
          // Join array messages into a single string
          errorMessage = errorData.message.join(', ');
        } else if (
          typeof errorData.message === 'object' &&
          errorData.message !== null
        ) {
          // Handle case where message is an object but not an array
          errorMessage = JSON.stringify(errorData.message);
        } else {
          // Use message, fallback to error, or stringify the entire response
          errorMessage =
            errorData.message || errorData.error || JSON.stringify(errorData);
        }

        throw new Error(`OTP request failed: ${errorMessage}`);
      }
      // For network errors
      else if (error.request) {
        throw new Error(`Network error: No response received from server`);
      }
      // For other Axios errors
      else {
        throw new Error(`Request error: ${error.message}`);
      }
    }

    // For non-Axios errors
    throw new Error(
      `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
  }
};

/**
 * Authenticate with email OTP
 * @param payload OTP payload with email and OTP code
 * @returns Promise with auth response
 */
export const authenticateWithOtp = async (
  payload: OtpAuthenticatePayload,
): Promise<AuthResponse> => {
  try {
    console.log('[AUTH API] Sending OTP authentication request with payload:', {
      email: payload.email,
      otpProvided: !!payload.otp,
      otpLength: payload.otp?.length,
    });

    const response = await api.post('/auth/email-otp/authenticate', payload);
    console.log(
      '[AUTH API] Authentication successful, response status:',
      response.status,
    );
    console.log('[AUTH API] Authentication response:', response.data);

    // Return the data directly from the response
    return response.data;
  } catch (error) {
    console.error('[AUTH API] Authentication error details:', error);

    if (axios.isAxiosError(error)) {
      // For Axios errors with response
      if (error.response) {
        console.error('[AUTH API] Response status:', error.response.status);
        console.error('[AUTH API] Response headers:', error.response.headers);

        const errorData = error.response.data;

        // Log the exact structure of the error data for debugging
        console.error(
          '[AUTH API] Error data structure:',
          JSON.stringify(errorData, null, 2),
        );
        console.error(
          '[AUTH API] Error message type:',
          typeof errorData.message,
          Array.isArray(errorData.message),
        );

        if (errorData && typeof errorData === 'object') {
          // Log each property of the error data object
          console.error('[AUTH API] Error data properties:');
          Object.keys(errorData).forEach((key) => {
            console.error(
              `[AUTH API] - ${key}:`,
              errorData[key],
              typeof errorData[key],
            );
          });
        }

        let errorMessage: string;

        // Handle validation errors (422) which may have array messages
        if (Array.isArray(errorData.message)) {
          console.error(
            '[AUTH API] Message is array with items:',
            errorData.message.length,
          );
          // Directly log array contents to see what's inside
          console.error(
            '[AUTH API] Message array contents:',
            JSON.stringify(errorData.message, null, 2),
          );
          // Join array messages into a single string
          errorMessage = errorData.message.join(', ');
        } else if (
          typeof errorData.message === 'object' &&
          errorData.message !== null
        ) {
          // Handle case where message is an object but not an array
          console.error('[AUTH API] Message is object:', errorData.message);
          errorMessage = JSON.stringify(errorData.message);
        } else {
          // Use message, fallback to error, or stringify the entire response
          errorMessage =
            errorData.message || errorData.error || JSON.stringify(errorData);
        }

        console.error('[AUTH API] Final error message:', errorMessage);
        throw new Error(`Authentication failed: ${errorMessage}`);
      }
      // For network errors
      else if (error.request) {
        throw new Error(`Network error: No response received from server`);
      }
      // For other Axios errors
      else {
        throw new Error(`Request error: ${error.message}`);
      }
    }

    // For non-Axios errors
    throw new Error(
      `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
  }
};

/**
 * Get current user profile
 * @param token Authentication token
 * @returns Promise with user data
 */
export const getUserProfile = async (
  token: string,
): Promise<ApiResponse<User>> => {
  try {
    const response = await api.get('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Profile fetch error details:', error);

    if (axios.isAxiosError(error)) {
      // For Axios errors with response
      if (error.response) {
        const errorData = error.response.data;
        let errorMessage: string;

        // Handle validation errors (422) which may have array messages
        if (Array.isArray(errorData.message)) {
          // Join array messages into a single string
          errorMessage = errorData.message.join(', ');
        } else if (
          typeof errorData.message === 'object' &&
          errorData.message !== null
        ) {
          // Handle case where message is an object but not an array
          errorMessage = JSON.stringify(errorData.message);
        } else {
          // Use message, fallback to error, or stringify the entire response
          errorMessage =
            errorData.message || errorData.error || JSON.stringify(errorData);
        }

        throw new Error(`Failed to get profile: ${errorMessage}`);
      }
      // For network errors
      else if (error.request) {
        throw new Error(`Network error: No response received from server`);
      }
      // For other Axios errors
      else {
        throw new Error(`Request error: ${error.message}`);
      }
    }

    // For non-Axios errors
    throw new Error(
      `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
  }
};

/**
 * Get KYC status
 * @param token Authentication token
 * @returns Promise with KYC data
 */
export const getKycStatus = async (
  token: string,
): Promise<ApiResponse<any>> => {
  try {
    const response = await api.get('/kycs', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('KYC status fetch error details:', error);

    if (axios.isAxiosError(error)) {
      // For Axios errors with response
      if (error.response) {
        const errorData = error.response.data;
        let errorMessage: string;

        // Handle validation errors (422) which may have array messages
        if (Array.isArray(errorData.message)) {
          // Join array messages into a single string
          errorMessage = errorData.message.join(', ');
        } else if (
          typeof errorData.message === 'object' &&
          errorData.message !== null
        ) {
          // Handle case where message is an object but not an array
          errorMessage = JSON.stringify(errorData.message);
        } else {
          // Use message, fallback to error, or stringify the entire response
          errorMessage =
            errorData.message || errorData.error || JSON.stringify(errorData);
        }

        throw new Error(`Failed to get KYC status: ${errorMessage}`);
      }
      // For network errors
      else if (error.request) {
        throw new Error(`Network error: No response received from server`);
      }
      // For other Axios errors
      else {
        throw new Error(`Request error: ${error.message}`);
      }
    }

    // For non-Axios errors
    throw new Error(
      `Unexpected error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
    );
  }
};
