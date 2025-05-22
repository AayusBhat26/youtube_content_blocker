// Options page JavaScript
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const blockModeSelect = document.getElementById('block-mode');
  const partialMatchSelect = document.getElementById('partial-match');
  const caseSensitiveCheckbox = document.getElementById('case-sensitive');
  const scanIntervalInput = document.getElementById('scan-interval');
  const exportSettingsBtn = document.getElementById('export-settings');
  const importSettingsInput = document.getElementById('import-settings');
  const resetStatsBtn = document.getElementById('reset-stats');
  const saveOptionsBtn = document.getElementById('save-options');
  const resetOptionsBtn = document.getElementById('reset-options');
  
  // Statistics elements
  const blockedCountElement = document.getElementById('blocked-count');
  const lastBlockedElement = document.getElementById('last-blocked');
  const topKeywordElement = document.getElementById('top-keyword');
  const topCreatorElement = document.getElementById('top-creator');

  // Default values
  const defaultOptions = {
    blockMode: 'hide',
    partialMatch: 'partial',
    caseSensitive: false,
    scanInterval: 1000
  };

  // Load saved options
  loadOptions();
  loadStatistics();

  // Event listeners
  saveOptionsBtn.addEventListener('click', saveOptions);
  resetOptionsBtn.addEventListener('click', resetOptions);
  exportSettingsBtn.addEventListener('click', exportSettings);
  importSettingsInput.addEventListener('change', importSettings);
  resetStatsBtn.addEventListener('click', resetStatistics);

  // Functions
  function loadOptions() {
    chrome.storage.sync.get(['options'], (result) => {
      const options = result.options || defaultOptions;
      
      // Set form values
      blockModeSelect.value = options.blockMode || defaultOptions.blockMode;
      partialMatchSelect.value = options.partialMatch || defaultOptions.partialMatch;
      caseSensitiveCheckbox.checked = options.caseSensitive || defaultOptions.caseSensitive;
      scanIntervalInput.value = options.scanInterval || defaultOptions.scanInterval;
    });
  }

  function saveOptions() {
    const options = {
      blockMode: blockModeSelect.value,
      partialMatch: partialMatchSelect.value,
      caseSensitive: caseSensitiveCheckbox.checked,
      scanInterval: parseInt(scanIntervalInput.value, 10)
    };

    chrome.storage.sync.set({ options }, () => {
      // Show save confirmation
      const saveMsg = document.createElement('div');
      saveMsg.textContent = 'Options saved successfully!';
      saveMsg.className = 'save-message';
      saveMsg.style.color = '#4CAF50';
      saveMsg.style.fontWeight = 'bold';
      saveMsg.style.padding = '10px';
      saveMsg.style.textAlign = 'center';
      
      // Insert after the Save button
      saveOptionsBtn.parentNode.insertBefore(saveMsg, saveOptionsBtn.nextSibling);
      
      // Remove the message after 3 seconds
      setTimeout(() => {
        saveMsg.remove();
      }, 3000);

      // Notify content scripts of the change
      notifyContentScripts();
    });
  }

  function resetOptions() {
    if (confirm('Reset all options to default values?')) {
      blockModeSelect.value = defaultOptions.blockMode;
      partialMatchSelect.value = defaultOptions.partialMatch;
      caseSensitiveCheckbox.checked = defaultOptions.caseSensitive;
      scanIntervalInput.value = defaultOptions.scanInterval;
      
      saveOptions();
    }
  }

  function exportSettings() {
    chrome.storage.sync.get(['blockedKeywords', 'blockedCreators', 'options', 'statistics'], (result) => {
      const data = {
        blockedKeywords: result.blockedKeywords || [],
        blockedCreators: result.blockedCreators || [],
        options: result.options || defaultOptions,
        exportDate: new Date().toISOString()
      };
      
      // Create a JSON blob
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtube-content-blocker-settings-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    });
  }

  function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Validate the imported data
        if (!Array.isArray(data.blockedKeywords) || !Array.isArray(data.blockedCreators)) {
          throw new Error('Invalid format: blockedKeywords or blockedCreators are not arrays');
        }
        
        // Save the imported data
        chrome.storage.sync.set({
          blockedKeywords: data.blockedKeywords,
          blockedCreators: data.blockedCreators,
          options: data.options || defaultOptions
        }, () => {
          alert('Settings imported successfully!');
          loadOptions();
          notifyContentScripts();
        });
      } catch (error) {
        alert(`Error importing settings: ${error.message}`);
      }
      
      // Reset the file input
      event.target.value = '';
    };
    
    reader.readAsText(file);
  }

  function loadStatistics() {
    chrome.storage.sync.get(['statistics'], (result) => {
      const stats = result.statistics || {
        blockedCount: 0,
        lastBlocked: 'None',
        keywordCounts: {},
        creatorCounts: {}
      };
      
      // Update statistics display
      blockedCountElement.textContent = stats.blockedCount;
      lastBlockedElement.textContent = stats.lastBlocked || 'None';
      
      // Find most blocked keyword
      const topKeyword = Object.entries(stats.keywordCounts || {})
        .sort((a, b) => b[1] - a[1])[0];
      topKeywordElement.textContent = topKeyword ? `${topKeyword[0]} (${topKeyword[1]})` : 'None';
      
      // Find most blocked creator
      const topCreator = Object.entries(stats.creatorCounts || {})
        .sort((a, b) => b[1] - a[1])[0];
      topCreatorElement.textContent = topCreator ? `${topCreator[0]} (${topCreator[1]})` : 'None';
    });
  }

  function resetStatistics() {
    if (confirm('Reset all statistics? This cannot be undone.')) {
      chrome.storage.sync.set({
        statistics: {
          blockedCount: 0,
          lastBlocked: 'None',
          keywordCounts: {},
          creatorCounts: {}
        }
      }, () => {
        loadStatistics();
        alert('Statistics have been reset.');
      });
    }
  }

  function notifyContentScripts() {
    chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' }).catch(() => {
          // Ignore errors from tabs where content script isn't loaded
        });
      });
    });
  }
});
