/**
 * YouTube Content Blocker - Utility Functions
 * This file contains utility functions shared across the extension
 */

// Default options for the extension
const defaultOptions = {
  blockMode: 'hide',       // 'hide', 'blur', or 'replace'
  partialMatch: 'partial', // 'partial', 'exact', or 'word'
  caseSensitive: false,    // Whether to match case-sensitively
  scanInterval: 1000       // Milliseconds between content scans
};

// Default statistics structure
const defaultStatistics = {
  blockedCount: 0,         // Total videos blocked
  lastBlocked: 'None',     // Last blocked video title
  keywordCounts: {},       // Count of blocks per keyword
  creatorCounts: {}        // Count of blocks per creator
};

/**
 * Get extension version from manifest
 * @returns {string} Extension version
 */
function getExtensionVersion() {
  return chrome.runtime.getManifest().version;
}

/**
 * Check if a string should be blocked based on the current settings
 * @param {string} text - The text to check (video title or channel name)
 * @param {string} keyword - The keyword to check against
 * @param {object} options - The matching options
 * @returns {boolean} Whether the text should be blocked
 */
function isMatch(text, keyword, options) {
  // Handle case sensitivity
  let textToCheck = options.caseSensitive ? text : text.toLowerCase();
  let keywordToCheck = options.caseSensitive ? keyword : keyword.toLowerCase();
  
  // Apply matching method
  switch (options.partialMatch) {
    case 'exact':
      return textToCheck === keywordToCheck;
      
    case 'word':
      const regex = new RegExp(`\\b${escapeRegExp(keywordToCheck)}\\b`, options.caseSensitive ? '' : 'i');
      return regex.test(textToCheck);
      
    case 'partial':
    default:
      return textToCheck.includes(keywordToCheck);
  }
}

/**
 * Escape special characters for regex
 * @param {string} string - The string to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a date for display
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date || date === 'None') return 'None';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
  } catch (e) {
    return 'Unknown';
  }
}

/**
 * Notify all YouTube tabs about settings changes
 */
function notifyAllTabs() {
  chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {
        // Ignore errors from tabs where content script isn't loaded
      });
    });
  });
}

/**
 * Download data as a JSON file
 * @param {object} data - Data to download
 * @param {string} filename - Name of the file
 */
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Export the functions if in a module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    defaultOptions,
    defaultStatistics,
    getExtensionVersion,
    isMatch,
    escapeRegExp,
    formatDate,
    notifyAllTabs,
    downloadJSON
  };
}
