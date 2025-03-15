// Network-related utilities for the CopperX bot
// Centralized location for network naming conventions and IDs

// Map of network IDs to human-readable names
export const NETWORK_NAMES = {
  '1': 'Ethereum',
  '137': 'Polygon',
  '42161': 'Arbitrum',
  '10': 'Optimism',
  '8453': 'Base',
  'ethereum': 'Ethereum',
  'polygon': 'Polygon',
  'arbitrum': 'Arbitrum',
  'optimism': 'Optimism',
  'base': 'Base',
  'mainnet': 'Ethereum Mainnet',
  // Add more networks as needed
};

// Network ID mapping
export const NETWORK_IDS = {
  ethereum: '1',
  polygon: '137',
  arbitrum: '42161',
  optimism: '10',
  base: '8453',
  // Add more networks as needed
};

/**
 * Format network name for display to users
 * @param network The network identifier (can be ID or name)
 * @returns Formatted network name for display
 */
export const formatNetworkForDisplay = (network: string): string => {
  // Convert to lowercase for consistent matching
  const networkKey = String(network).toLowerCase();
  
  // Check if we have a direct mapping
  if (NETWORK_NAMES[network]) {
    return NETWORK_NAMES[network];
  }
  
  // Try to match partial names
  if (networkKey.includes('ethereum') || networkKey.includes('eth')) {
    return 'Ethereum';
  }
  if (networkKey.includes('polygon') || networkKey.includes('matic')) {
    return 'Polygon';
  }
  if (networkKey.includes('arbitrum') || networkKey.includes('arb')) {
    return 'Arbitrum';
  }
  if (networkKey.includes('optimism') || networkKey.includes('opt')) {
    return 'Optimism';
  }
  if (networkKey.includes('base')) {
    return 'Base';
  }
  
  // If no match found, return the capitalized input
  return network.charAt(0).toUpperCase() + network.slice(1);
};

/**
 * Get network ID for a given network name
 * @param networkName The network name
 * @returns The network ID
 */
export const getNetworkId = (networkName: string): string => {
  const key = networkName.toLowerCase();
  return NETWORK_IDS[key] || networkName; // Return original if not found
};

/**
 * Get supported networks with their IDs
 * @returns Array of supported networks with names and IDs
 */
export const getSupportedNetworks = () => {
  return [
    { name: 'Ethereum', id: NETWORK_IDS.ethereum },
    { name: 'Polygon', id: NETWORK_IDS.polygon },
    { name: 'Arbitrum', id: NETWORK_IDS.arbitrum },
    { name: 'Optimism', id: NETWORK_IDS.optimism },
    { name: 'Base', id: NETWORK_IDS.base }
  ];
}; 