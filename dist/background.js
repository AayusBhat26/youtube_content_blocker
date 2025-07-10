// Set default values when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['blockedKeywords', 'blockedCreators', 'interestKeywords', 'filterMode', 'enabled'], (result) => {
    // Set default blocked keywords if not already set
    if (!result.blockedKeywords) {
      chrome.storage.sync.set({ blockedKeywords: [] });
    }
    
    // Set default blocked creators if not already set
    if (!result.blockedCreators) {
      chrome.storage.sync.set({ blockedCreators: [] });
    }
    
    // Set default interest keywords if not already set
    if (!result.interestKeywords) {
      chrome.storage.sync.set({ interestKeywords: [] });
    }
    
    // Set default filter mode (block or show)
    if (!result.filterMode) {
      chrome.storage.sync.set({ filterMode: 'block' }); // 'block' or 'show'
    }
    
    // Set default enabled state if not already set
    if (result.enabled === undefined) {
      chrome.storage.sync.set({ enabled: true });
    }
  });
});

// Listen for tab updates to inject content script when YouTube is loaded
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
    // Check if extension is enabled before sending message
    chrome.storage.sync.get(['enabled'], (result) => {
      const enabled = result.enabled !== undefined ? result.enabled : true;
      
      if (enabled) {
        // Send message to content script to process videos
        chrome.tabs.sendMessage(tabId, { action: 'settingsUpdated' }).catch(() => {
          // If there's an error sending the message, it might be because the content script
          // hasn't been loaded yet. This is normal and can be ignored.
        });
      }
    });
  }
});
