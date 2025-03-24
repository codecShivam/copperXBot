/**
 * Utilities for validating cryptocurrency addresses and other inputs
 */
import WAValidator from 'wallet-address-validator';

/**
 * Validate wallet address based on the network/blockchain
 * @param address Wallet address to validate
 * @param network Network/blockchain name
 * @returns boolean indicating if the address is valid
 */
export function validateWalletAddress(
  address: string,
  network: string,
): boolean {
  if (!address || !network) return false;

  // Normalize the network name for comparison
  const normalizedNetwork = network.toLowerCase().trim();

  // Log attempt for debugging
  console.log(
    `[VALIDATION] Validating ${normalizedNetwork} address: ${address.substring(0, 10)}...`,
  );

  try {
    // Map network names to wallet-address-validator currency codes
    const networkToCurrency: Record<string, string> = {
      // Ethereum and EVM compatible chains
      ethereum: 'ETH',
      eth: 'ETH',
      polygon: 'ETH', // Using ETH validation for Polygon (EVM compatible)
      matic: 'ETH',
      bsc: 'ETH', // Using ETH validation for BSC (EVM compatible)
      'binance smart chain': 'ETH',
      arbitrum: 'ETH', // Using ETH validation for Arbitrum (EVM compatible)
      optimism: 'ETH', // Using ETH validation for Optimism (EVM compatible)
      avalanche: 'ETH', // Using ETH validation for Avalanche (EVM compatible)
      avax: 'ETH',

      // Bitcoin and forks
      bitcoin: 'BTC',
      btc: 'BTC',
      litecoin: 'LTC',
      ltc: 'LTC',
      'bitcoin cash': 'BCH',
      bch: 'BCH',

      // Other major cryptocurrencies
      tron: 'TRX',
      trx: 'TRX',
      ripple: 'XRP',
      xrp: 'XRP',
      dogecoin: 'DOGE',
      doge: 'DOGE',
      dash: 'DASH',
      zcash: 'ZEC',
      zec: 'ZEC',

      // Binance Chain (not EVM)
      'binance chain': 'BNB',
      bnb: 'BNB',
    };

    // Get the currency code for the network
    const currencyCode = networkToCurrency[normalizedNetwork];

    if (currencyCode) {
      // Use the wallet-address-validator library
      const isValid = WAValidator.validate(address, currencyCode);
      console.log(
        `[VALIDATION] ${normalizedNetwork} (${currencyCode}) address validation result: ${isValid}`,
      );
      return isValid;
    }

    // For networks not directly supported by the validator, use fallback validation
    console.log(
      `[VALIDATION] No direct validation for ${normalizedNetwork}, using fallback validation`,
    );
    return fallbackValidation(address, normalizedNetwork);
  } catch (error) {
    console.error(`[VALIDATION] Error validating address:`, error);
    // On error, fall back to basic validation
    return fallbackValidation(address, normalizedNetwork);
  }
}

/**
 * Fallback validation for unsupported networks
 */
function fallbackValidation(address: string, network: string): boolean {
  // Basic characteristics of valid addresses across most blockchains
  const isReasonableLength = address.length >= 25 && address.length <= 100;

  // Check for allowed character patterns based on common address formats
  let hasOnlyValidChars = false;

  // Ethereum-style addresses
  if (address.startsWith('0x')) {
    hasOnlyValidChars = /^0x[a-fA-F0-9]{40}$/i.test(address);
  }
  // Base58 encoded addresses (Bitcoin, etc.)
  else if (/^[123][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    hasOnlyValidChars = true;
  }
  // Bech32 addresses (e.g., bc1...)
  else if (/^(bc|tb|ltc|tltc|bch)[a-z0-9]{6,100}$/.test(address)) {
    hasOnlyValidChars = true;
  }
  // Tron addresses
  else if (/^T[a-zA-Z0-9]{33}$/.test(address)) {
    hasOnlyValidChars = true;
  }
  // Generic alphanumeric addresses
  else {
    hasOnlyValidChars = /^[a-zA-Z0-9\-_]+$/.test(address);
  }

  console.log(
    `[VALIDATION] Fallback validation for ${network}: length check=${isReasonableLength}, char check=${hasOnlyValidChars}`,
  );

  return isReasonableLength && hasOnlyValidChars;
}

/**
 * Validate email address format
 * @param email Email address to validate
 * @returns boolean indicating if the email format is valid
 */
export function validateEmailFormat(email: string): boolean {
  if (!email) return false;

  // Basic email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Check for potential typos in common email domains
 * @param email Email address to check
 * @returns Object with corrected domain if found, or null if no suggestion
 */
export function checkEmailTypos(email: string): {
  hasTypo: boolean;
  original: string;
  suggestion: string | null;
} {
  if (!validateEmailFormat(email)) {
    return { hasTypo: false, original: email, suggestion: null };
  }

  const commonDomains = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'aol.com',
    'icloud.com',
    'protonmail.com',
    'zoho.com',
    'yandex.com',
    'mail.com',
  ];

  const parts = email.split('@');
  if (parts.length !== 2) {
    return { hasTypo: false, original: email, suggestion: null };
  }

  const [username, domain] = parts;

  // Check for close matches (typos) in domain
  for (const commonDomain of commonDomains) {
    // Skip if it's already this domain
    if (domain.toLowerCase() === commonDomain.toLowerCase()) {
      return { hasTypo: false, original: email, suggestion: null };
    }

    // Check if similar (could be a typo)
    // 1. Simple case: one character different
    const levenshteinDistance = getEditDistance(
      domain.toLowerCase(),
      commonDomain.toLowerCase(),
    );
    if (levenshteinDistance <= 2) {
      return {
        hasTypo: true,
        original: email,
        suggestion: `${username}@${commonDomain}`,
      };
    }

    // 2. Check for transposed characters (e.g., gamil instead of gmail)
    if (
      domain
        .toLowerCase()
        .includes(commonDomain.substring(0, 3).toLowerCase()) ||
      commonDomain.toLowerCase().includes(domain.substring(0, 3).toLowerCase())
    ) {
      return {
        hasTypo: true,
        original: email,
        suggestion: `${username}@${commonDomain}`,
      };
    }
  }

  return { hasTypo: false, original: email, suggestion: null };
}

// Helper function to calculate edit distance between two strings
function getEditDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
