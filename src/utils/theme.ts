// Theme configuration for the Copperx bot
// Defines color-related styling and emoji patterns for consistency

// Color palette (These are for reference - actual styling is done with emojis and formatting)
export const COLORS = {
  primary: '#5F76F9',     
  secondary: '#CAD2FC',   
  background: '#F7F9FC',  
  white: '#FFFFFF',       
  dark: '#13171F',        
  gray: '#8891A3'         
}; 

// Section decorators for message formatting
export const SECTION = {
  header: '🔹 ',           // Uses primary color tone
  subheader: '  ◽️ ',      // Uses secondary color tone
  item: '   • ',          // List item
  success: '✅ ',          // Success indicator
  error: '❌ ',            // Error indicator
  warning: '⚠️ ',          // Warning indicator
  info: '📝 ',             // Info indicator
  loading: '🔄 '           // Loading indicator
};

// Feature icons - use emoji that match our color scheme where possible
export const ICON = {
  // Main features
  balance: '💰',
  send: '💸',
  receive: '📥',
  history: '📊',
  withdraw: '🏦',
  profile: '👤',
  help: '❓',
  
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
  address: '📍'
};

// Message styling helpers
export const formatHeader = (text: string): string => {
  return `*${SECTION.header}${text}*`;
};

export const formatSubheader = (text: string): string => {
  return `*${SECTION.subheader}${text}*`;
};

export const formatSuccess = (text: string): string => {
  return `${SECTION.success}*${text}*`;
};

export const formatError = (text: string): string => {
  return `${SECTION.error}*${text}*`;
};

export const formatWarning = (text: string): string => {
  return `${SECTION.warning}*${text}*`;
};

export const formatInfo = (text: string): string => {
  return `${SECTION.info}${text}`;
};

export const formatLoading = (text: string): string => {
  return `${SECTION.loading}${text}`;
};

export const formatAmount = (amount: string | number, symbol: string = ''): string => {
  return `*${amount}* ${symbol}`.trim();
};

export const formatNetworkIcon = (network: string): string => {
  network = network.toLowerCase();
  if (network.includes('ethereum')) return ICON.ethereum;
  if (network.includes('polygon')) return ICON.polygon;
  if (network.includes('arbitrum')) return ICON.arbitrum;
  if (network.includes('optimism')) return ICON.optimism;
  if (network.includes('base')) return ICON.base;
  if (network.includes('bnb')) return ICON.bnb;
  return ICON.network;
};

// Dividers for visual separation
export const DIVIDERS = {
  small: '\n',
  medium: '\n\n',
  large: '\n\n\n',
  section: '\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n',
  dots: '\n• • • • • • • • • • • •\n'
}; 