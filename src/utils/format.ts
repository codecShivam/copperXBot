/**
 * Format currency amount
 * @param amount Amount as string or number
 * @param decimals Number of decimal places
 * @returns Formatted amount
 */
export const formatAmount = (amount: string | number, decimals = 2): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return '0.00';
  }

  return numAmount.toFixed(decimals);
};

/**
 * Format date to readable string
 * @param dateString Date string
 * @returns Formatted date
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Truncate address for display
 * @param address Wallet address
 * @param startChars Characters to show at start
 * @param endChars Characters to show at end
 * @returns Truncated address
 */
export const truncateAddress = (
  address: string,
  startChars = 6,
  endChars = 4,
): string => {
  if (!address) {
    return '';
  }

  if (address.length <= startChars + endChars) {
    return address;
  }

  return `${address.substring(0, startChars)}...${address.substring(
    address.length - endChars,
  )}`;
};

/**
 * Escape special characters for Markdown V2 format in Telegram
 * @param text Text to escape
 * @returns Escaped text
 */
export const escapeMarkdown = (text: string): string => {
  return text
    .replace(/\_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\~/g, '\\~')
    .replace(/\`/g, '\\`')
    .replace(/\>/g, '\\>')
    .replace(/\#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/\-/g, '\\-')
    .replace(/\=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
};
