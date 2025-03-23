// Network utilities for the CopperX bot
// This file acts as a compatibility layer for existing code

import {
  formatNetworkForDisplay as formatNetwork,
  getNetworkId as getNetworkIdFromConstants,
  getSupportedNetworks as getSupportedNetworksFromConstants,
  NETWORK_NAMES as NETWORK_NAMES_CONSTANTS,
  NETWORK_IDS as NETWORK_IDS_CONSTANTS
} from '../constants';

// Re-export for backward compatibility
export const formatNetworkForDisplay = formatNetwork;
export const getNetworkId = getNetworkIdFromConstants;
export const getSupportedNetworks = getSupportedNetworksFromConstants;
export const NETWORK_NAMES = NETWORK_NAMES_CONSTANTS;
export const NETWORK_IDS = NETWORK_IDS_CONSTANTS;

// Legacy function if needed
export const getNetworkName = (networkId: string): string => {
  return NETWORK_NAMES[networkId] || networkId;
}; 