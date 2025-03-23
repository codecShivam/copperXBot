// Central export file for all constants
// This makes imports cleaner in other files

// Export everything from themes
export * from './themes/default';

// Export everything from icons
export * from './icons';

// Export everything from networks
export * from './networks';

// Export the network icon formatter for convenience
export const formatNetworkIcon = (network: string): string => {
  const networkLower = String(network).toLowerCase();
  
  if (networkLower.includes('ethereum')) return '🔹'; // Ethereum
  if (networkLower.includes('polygon')) return '💜'; // Polygon
  if (networkLower.includes('arbitrum')) return '🔵'; // Arbitrum
  if (networkLower.includes('optimism')) return '❤️'; // Optimism
  if (networkLower.includes('base')) return '🔷'; // Base
  if (networkLower.includes('bnb')) return '🟡'; // BNB
  
  return '🌐'; // Default network icon
};

// Any additional standalone constants can be added here
export const APP_VERSION = '1.0.0';
export const APP_NAME = 'CopperX Bot';

// Optional: Add any other constants that don't belong in a specific category
export const DEFAULT_TIMEOUT = 30000; // 30 seconds
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes 