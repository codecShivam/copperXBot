// Icon configurations for the CopperX bot
// Centralized location for all emoji icons used in the application

// Feature icons - use emoji that match our color scheme where possible
export const ICON = {
  // Welcome
  welcome: '👋',
  
  // Main features
  balance: '💰',
  send: '💸',
  receive: '📥',
  history: '📊',
  withdraw: '🏦',
  profile: '👤',
  help: '❓',
  logout: '🔒',

  // Networks
  ethereum: '🔹',  // Blue
  polygon: '💜',  // Purple
  arbitrum: '🔵',  // Blue
  optimism: '❤️',  // Red
  base: '🔷',      // Blue
  bnb: '🟡',       // Yellow
  
  // Actions
  settings: '⚙️',
  wallet: '💼',
  token: '🪙',
  view: '👁️',
  add: '➕',
  refresh: '🔄',
  back: '⬅️',
  next: '➡️',
  confirm: '✅',
  cancel: '❌',
  copy: '📋',
  network: '🌐',
  key: '🔑',
  bank: '🏛️',
  note: '📝',
  email: '📧',
  address: '📍',
  
  // Status indicators
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: '📝',
  loading: '🔄',
  star: '⭐'
};

// Function to get network-specific icons
export const getNetworkIcon = (network: string): string => {
  const networkLower = network.toLowerCase();
  
  if (networkLower.includes('ethereum')) return ICON.ethereum;
  if (networkLower.includes('polygon')) return ICON.polygon;
  if (networkLower.includes('arbitrum')) return ICON.arbitrum;
  if (networkLower.includes('optimism')) return ICON.optimism;
  if (networkLower.includes('base')) return ICON.base;
  if (networkLower.includes('bnb')) return ICON.bnb;
  
  return ICON.network; // Default network icon
}; 