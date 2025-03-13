// Network mapping utility functions

// Map of network IDs to user-friendly names
export const NETWORKS = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '56': 'BNB Chain',
  '137': 'Polygon',
  '8453': 'Base',
  '42161': 'Arbitrum'
};

// Map of network names to their IDs
export const NETWORK_IDS = {
  'ethereum': '1',
  'optimism': '10',
  'bnb': '56',
  'polygon': '137',
  'base': '8453',
  'arbitrum': '42161'
};

/**
 * Get a user-friendly network name from its ID
 * @param networkId The network ID
 * @returns User-friendly network name or the ID if not found
 */
export const getNetworkName = (networkId: string): string => {
  return NETWORKS[networkId] || networkId.toUpperCase();
};

/**
 * Get a network ID from its name
 * @param networkName The network name
 * @returns Network ID or the name if not found
 */
export const getNetworkId = (networkName: string): string => {
  const normalizedName = networkName.toLowerCase();
  return NETWORK_IDS[normalizedName] || networkName;
};

/**
 * Format a network value for display (ensure it's a user-friendly name)
 * @param network Network ID or name
 * @returns User-friendly network name
 */
export const formatNetworkForDisplay = (network: string): string => {
  // If it's a network ID, convert to name
  if (NETWORKS[network]) {
    return NETWORKS[network];
  }
  
  // If it's already a name, ensure proper capitalization
  const networkName = String(network).toLowerCase();
  if (NETWORK_IDS[networkName]) {
    return capitalizeFirstLetter(networkName);
  }
  
  // Otherwise, just return the network with first letter capitalized
  return capitalizeFirstLetter(String(network));
};

/**
 * Helper function to capitalize the first letter of a string
 */
const capitalizeFirstLetter = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}; 