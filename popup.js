document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const keywordInput = document.getElementById('keyword-input');
  const addKeywordBtn = document.getElementById('add-keyword');
  const keywordList = document.getElementById('keyword-list');
  const creatorInput = document.getElementById('creator-input');
  const addCreatorBtn = document.getElementById('add-creator');
  const creatorList = document.getElementById('creator-list');
  const interestKeywordInput = document.getElementById('interest-keyword-input');
  const addInterestKeywordBtn = document.getElementById('add-interest-keyword');
  const interestKeywordList = document.getElementById('interest-keyword-list');
  const enabledToggle = document.getElementById('enabled-toggle');
  const openOptionsLink = document.getElementById('open-options');
  const blockedCountElement = document.getElementById('blocked-count');
  const filterModeRadios = document.querySelectorAll('input[name="filterMode"]');
  const blockModeSections = document.querySelectorAll('.block-mode-section');
  const showModeSections = document.querySelectorAll('.show-mode-section');

  // Load saved data
  loadBlockedItems();
  loadInterestKeywords();
  loadFilterMode();
  loadExtensionState();
  loadStatistics();  // Event listeners
  addKeywordBtn.addEventListener('click', addKeyword);
  keywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword();
  });

  addCreatorBtn.addEventListener('click', addCreator);
  creatorInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addCreator();
  });
  
  addInterestKeywordBtn.addEventListener('click', addInterestKeyword);
  interestKeywordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addInterestKeyword();
  });

  enabledToggle.addEventListener('change', () => {
    saveExtensionState(enabledToggle.checked);
  });
  
  // Add event listeners for filter mode radios
  filterModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setFilterMode(e.target.value);
    });
  });
  
  if (openOptionsLink) {
    openOptionsLink.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Functions
  function addKeyword() {
    const keyword = keywordInput.value.trim();
    if (!keyword) return;

    chrome.storage.sync.get(['blockedKeywords'], (result) => {
      const blockedKeywords = result.blockedKeywords || [];
      
      // Check if keyword already exists
      if (blockedKeywords.includes(keyword.toLowerCase())) {
        alert('This keyword is already blocked');
        return;
      }
      
      // Add new keyword
      blockedKeywords.push(keyword.toLowerCase());
      
      // Save updated list
      chrome.storage.sync.set({ blockedKeywords }, () => {
        keywordInput.value = '';
        renderKeywordList(blockedKeywords);
        notifyContentScript();
      });
    });
  }

  function addCreator() {
    const creator = creatorInput.value.trim();
    if (!creator) return;

    chrome.storage.sync.get(['blockedCreators'], (result) => {
      const blockedCreators = result.blockedCreators || [];
      
      // Check if creator already exists
      if (blockedCreators.includes(creator.toLowerCase())) {
        alert('This creator is already blocked');
        return;
      }
      
      // Add new creator
      blockedCreators.push(creator.toLowerCase());
      
      // Save updated list
      chrome.storage.sync.set({ blockedCreators }, () => {
        creatorInput.value = '';
        renderCreatorList(blockedCreators);
        notifyContentScript();
      });
    });
  }

  function addInterestKeyword() {
    const keyword = interestKeywordInput.value.trim();
    if (!keyword) return;

    chrome.storage.sync.get(['interestKeywords'], (result) => {
      const interestKeywords = result.interestKeywords || [];
      
      // Check if keyword already exists
      if (interestKeywords.includes(keyword.toLowerCase())) {
        alert('This interest keyword is already added');
        return;
      }
      
      // Add new keyword
      interestKeywords.push(keyword.toLowerCase());
      
      // Save updated list
      chrome.storage.sync.set({ interestKeywords }, () => {
        interestKeywordInput.value = '';
        renderInterestKeywordList(interestKeywords);
        notifyContentScript();
      });
    });
  }

  function removeKeyword(keyword) {
    chrome.storage.sync.get(['blockedKeywords'], (result) => {
      const blockedKeywords = result.blockedKeywords || [];
      const updatedList = blockedKeywords.filter(k => k !== keyword);
      
      chrome.storage.sync.set({ blockedKeywords: updatedList }, () => {
        renderKeywordList(updatedList);
        notifyContentScript();
      });
    });
  }

  function removeCreator(creator) {
    chrome.storage.sync.get(['blockedCreators'], (result) => {
      const blockedCreators = result.blockedCreators || [];
      const updatedList = blockedCreators.filter(c => c !== creator);
      
      chrome.storage.sync.set({ blockedCreators: updatedList }, () => {
        renderCreatorList(updatedList);
        notifyContentScript();
      });
    });
  }

  function removeInterestKeyword(keyword) {
    chrome.storage.sync.get(['interestKeywords'], (result) => {
      const interestKeywords = result.interestKeywords || [];
      const updatedList = interestKeywords.filter(k => k !== keyword);
      
      chrome.storage.sync.set({ interestKeywords: updatedList }, () => {
        renderInterestKeywordList(updatedList);
        notifyContentScript();
      });
    });
  }

  function renderKeywordList(keywords) {
    keywordList.innerHTML = '';
    
    if (keywords.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.textContent = 'No keywords blocked';
      emptyMsg.className = 'list-item empty';
      keywordList.appendChild(emptyMsg);
      return;
    }
    
    keywords.forEach(keyword => {
      const li = document.createElement('li');
      li.className = 'list-item';
      
      const span = document.createElement('span');
      span.textContent = keyword;
      
      const button = document.createElement('button');
      button.textContent = 'Remove';
      button.addEventListener('click', () => removeKeyword(keyword));
      
      li.appendChild(span);
      li.appendChild(button);
      keywordList.appendChild(li);
    });
  }

  function renderCreatorList(creators) {
    creatorList.innerHTML = '';
    
    if (creators.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.textContent = 'No creators blocked';
      emptyMsg.className = 'list-item empty';
      creatorList.appendChild(emptyMsg);
      return;
    }
    
    creators.forEach(creator => {
      const li = document.createElement('li');
      li.className = 'list-item';
      
      const span = document.createElement('span');
      span.textContent = creator;
      
      const button = document.createElement('button');
      button.textContent = 'Remove';
      button.addEventListener('click', () => removeCreator(creator));
      
      li.appendChild(span);
      li.appendChild(button);
      creatorList.appendChild(li);
    });
  }

  function renderInterestKeywordList(keywords) {
    interestKeywordList.innerHTML = '';
    
    if (keywords.length === 0) {
      const emptyMsg = document.createElement('li');
      emptyMsg.textContent = 'No interest keywords added';
      emptyMsg.className = 'list-item empty';
      interestKeywordList.appendChild(emptyMsg);
      return;
    }
    
    keywords.forEach(keyword => {
      const li = document.createElement('li');
      li.className = 'list-item';
      
      const span = document.createElement('span');
      span.textContent = keyword;
      
      const button = document.createElement('button');
      button.textContent = 'Remove';
      button.addEventListener('click', () => removeInterestKeyword(keyword));
      
      li.appendChild(span);
      li.appendChild(button);
      interestKeywordList.appendChild(li);
    });
  }

  function loadBlockedItems() {
    chrome.storage.sync.get(['blockedKeywords', 'blockedCreators'], (result) => {
      renderKeywordList(result.blockedKeywords || []);
      renderCreatorList(result.blockedCreators || []);
    });
  }

  function loadInterestKeywords() {
    chrome.storage.sync.get(['interestKeywords'], (result) => {
      renderInterestKeywordList(result.interestKeywords || []);
    });
  }

  function loadExtensionState() {
    chrome.storage.sync.get(['enabled'], (result) => {
      const enabled = result.enabled !== undefined ? result.enabled : true;
      enabledToggle.checked = enabled;
    });
  }

  function saveExtensionState(enabled) {
    chrome.storage.sync.set({ enabled }, () => {
      notifyContentScript();
    });
  }

  function notifyContentScript() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'settingsUpdated' });
      }
    });
  }
  
  function loadStatistics() {
    chrome.storage.sync.get(['statistics'], (result) => {
      const stats = result.statistics || { blockedCount: 0 };
      
      if (blockedCountElement) {
        blockedCountElement.textContent = stats.blockedCount.toString();
      }
    });
  }

  function loadFilterMode() {
    chrome.storage.sync.get(['filterMode'], (result) => {
      const filterMode = result.filterMode || 'block';
      
      // Set the correct radio button
      document.querySelector(`input[name="filterMode"][value="${filterMode}"]`).checked = true;
      
      // Show/hide appropriate sections
      updateVisibleSections(filterMode);
    });
  }

  function setFilterMode(mode) {
    chrome.storage.sync.set({ filterMode: mode }, () => {
      updateVisibleSections(mode);
      notifyContentScript();
    });
  }

  function updateVisibleSections(mode) {
    if (mode === 'block') {
      blockModeSections.forEach(section => section.style.display = 'block');
      showModeSections.forEach(section => section.style.display = 'none');
    } else {
      blockModeSections.forEach(section => section.style.display = 'none');
      showModeSections.forEach(section => section.style.display = 'block');
    }
  }
});
