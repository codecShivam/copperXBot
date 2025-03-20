import { Context } from 'telegraf';

// User session data
export interface SessionData {
  userId?: number;
  token?: string;
  refreshToken?: string;
  email?: string;
  organizationId?: string;
  authenticated: boolean;
  currentStep?: string;
  tempData?: Record<string, any>;
}

// Custom context with session
export interface BotContext extends Context {
  session: SessionData;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message: string;
  status: number;
}

// Authentication types
export interface OtpRequestPayload {
  email: string;
}

export interface OtpRequestResponse {
  sid?: string; // Session ID returned from the OTP request
}

export interface OtpAuthenticatePayload {
  email: string;
  otp: string;
  sid: string; // Required session ID
}

export interface AuthResponse {
  scheme: string;
  accessToken: string;
  accessTokenId: string;
  expireAt: string;
  refreshToken?: string; // May not be present in all responses
  user: User;
}

// User types
export interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId: string;
  kycStatus?: string;
  kybStatus?: string;
}

// Wallet types
export interface Wallet {
  id: string;
  address?: string;
  walletAddress: string;
  network: string;
  isDefault: boolean;
  tokens?: Token[];
  walletType?: string;
  organizationId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Token {
  symbol: string;
  balance: string;
  decimals: number;
}

export interface Balance {
  token: string;
  network: string;
  balance: string;
  formattedBalance?: string;
  walletId?: string;
  isDefaultWallet?: boolean;
  address?: string;
  decimals?: number;
}

// API response for wallet balances
export interface WalletWithBalances {
  walletId: string;
  isDefault: boolean;
  network: string;
  balances: {
    decimals: number;
    balance: string;
    symbol: string;
    address: string;
  }[];
}

// Transfer types
export interface EmailTransferPayload {
  amount: string;
  token: string;
  receiverEmail: string;
  network: string;
  note?: string;
}

export interface WalletTransferPayload {
  amount: string;
  token: string;
  receiverAddress: string;
  network: string;
  note?: string;
}

export interface BankWithdrawalPayload {
  amount: string;
  token: string;
  network: string;
  bankAccountId: string;
}

export interface Transfer {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  type: string;
  providerCode?: string;
  kycId?: string;
  transferId: string;
  status: string;
  externalStatus?: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  totalFee?: string;
  feeCurrency?: string;
  transactionHash?: string;
  externalCustomerId?: string;
  externalTransactionId?: string;
  depositUrl?: string;
  depositAccount?: {
    id: string;
    walletAddress?: string;
    type?: string;
    network?: string;
    country?: string;
  };
  fromAccount?: {
    id: string;
    type?: string;
    network?: string;
    walletAddress?: string;
    accountId?: string;
    country?: string;
  };
  toAccount?: {
    id: string;
    type?: string;
    network?: string;
    walletAddress?: string;
    accountId?: string;
    bankName?: string;
    bankAddress?: string;
    bankRoutingNumber?: string;
    bankAccountNumber?: string;
    country?: string;
  };
  // Maintain backward compatibility with existing code
  sender?: {
    email: string;
  };
  receiver?: {
    email: string;
    address?: string;
  };
  bankAccount?: {
    id: string;
    name: string;
  };
  // Helper properties for formatting in UI
  amount?: string;
  token?: string;
  network?: string;
}

// Bank account types
export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  routingNumber: string;
  bankName: string;
} 