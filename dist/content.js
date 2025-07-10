/**
 * YouTube Content Blocker - Content Script
 * 
 * This script runs on YouTube pages and:
 * - Identifies videos based on their titles and creators
 * - Hides videos that match blocking criteria
 * - Responds to settings changes
 * - Tracks blocking statistics
 */

// Global options
let globalOptions = {
  blockMode: 'hide',
  partialMatch: 'partial',
  caseSensitive: false,
  scanInterval: 1000
};

// Store references to observers and timeouts
let mutationObserver = null;
let scanTimeoutId = null;
let processingInProgress = false;

// Initialize block counters for current page
let pageBlockStats = {
  total: 0,
  keywords: {},
  creators: {}
};

// Main function to process YouTube videos
function processYouTubeVideos() {
  if (processingInProgress) return;
  processingInProgress = true;
  
  chrome.storage.sync.get(['blockedKeywords', 'blockedCreators', 'interestKeywords', 'filterMode', 'enabled', 'options'], (result) => {
    const blockedKeywords = result.blockedKeywords || [];
    const blockedCreators = result.blockedCreators || [];
    const interestKeywords = result.interestKeywords || [];
    const filterMode = result.filterMode || 'block';
    const enabled = result.enabled !== undefined ? result.enabled : true;
    
    // Update global options
    if (result.options) {
      globalOptions = { ...globalOptions, ...result.options };
    }

    // Early return if disabled
    if (!enabled) {
      processingInProgress = false;
      return;
    }

    // Early return if no criteria for current mode
    if ((filterMode === 'block' && blockedKeywords.length === 0 && blockedCreators.length === 0) ||
        (filterMode === 'show' && interestKeywords.length === 0)) {
      processingInProgress = false;
      return;
    }

    try {
      // Process different YouTube page layouts
      if (window.location.pathname === '/') {
        // Home page
        if (filterMode === 'block') {
          processHomePage(blockedKeywords, blockedCreators);
        } else {
          processHomePageShowOnly(interestKeywords);
        }
      } else if (window.location.pathname.startsWith('/results')) {
        // Search results
        if (filterMode === 'block') {
          processSearchResults(blockedKeywords, blockedCreators);
        } else {
          processSearchResultsShowOnly(interestKeywords);
        }
      } else if (window.location.pathname === '/feed/subscriptions') {
        // Subscriptions page
        if (filterMode === 'block') {
          processSubscriptionsPage(blockedKeywords, blockedCreators);
        } else {
          processSubscriptionsPageShowOnly(interestKeywords);
        }
      } else if (window.location.pathname === '/feed/trending') {
        // Trending page
        if (filterMode === 'block') {
          processTrendingPage(blockedKeywords, blockedCreators);
        } else {
          processTrendingPageShowOnly(interestKeywords);
        }
      } else if (window.location.pathname === '/feed/explore') {
        // Explore page
        if (filterMode === 'block') {
          processExplorePage(blockedKeywords, blockedCreators);
        } else {
          processExplorePageShowOnly(interestKeywords);
        }
      } else if (window.location.pathname.startsWith('/watch')) {
        // Watch page - handle recommendations
        if (filterMode === 'block') {
          processWatchPageRecommendations(blockedKeywords, blockedCreators);
        } else {
          processWatchPageRecommendationsShowOnly(interestKeywords);
        }
      } else if (window.location.pathname.startsWith('/channel/') || 
                window.location.pathname.startsWith('/c/') || 
                window.location.pathname.startsWith('/user/') ||
                window.location.pathname.startsWith('/@')) {
        // Channel pages
        if (filterMode === 'block') {
          processChannelPage(blockedKeywords, blockedCreators);
        } else {
          processChannelPageShowOnly(interestKeywords);
        }
      } else if (window.location.pathname.startsWith('/shorts')) {
        // Shorts page
        if (filterMode === 'block') {
          processShortsPage(blockedKeywords, blockedCreators);
        } else {
          processShortsPageShowOnly(interestKeywords);
        }
      } else if (window.location.pathname.startsWith('/playlist')) {
        // Playlist page
        if (filterMode === 'block') {
          processPlaylistPage(blockedKeywords, blockedCreators);
        } else {
          processPlaylistPageShowOnly(interestKeywords);
        }
      }
    } catch (error) {
      console.error('YouTube Content Blocker: Error processing videos', error);
    }
    
    processingInProgress = false;
  });
}

// Process videos on home page
function processHomePage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on search results
function processSearchResults(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on subscriptions page
function processSubscriptionsPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on trending page
function processTrendingPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on explore page
function processExplorePage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-rich-grid-renderer ytd-rich-item-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process recommendations on watch page
function processWatchPageRecommendations(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-compact-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);

  // Also check if current video should be blocked (refresh if so)
  const videoTitle = document.querySelector('.ytd-video-primary-info-renderer .title')?.textContent?.trim() || '';
  const channelName = document.querySelector('#owner #text a')?.textContent?.trim() || '';
  
  if (videoTitle && channelName) {
    const blockInfo = shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators);
    if (blockInfo.shouldBlock) {
      // If user is watching a video that should be blocked, show warning and offer to go back
      showBlockedVideoOverlay();
      
      // Log the blocked video
      logBlockedVideo({
        title: videoTitle,
        creator: channelName,
        matchedKeyword: blockInfo.matchedKeyword,
        matchedCreator: blockInfo.matchedCreator,
        pageType: 'watch'
      });
    }
  }
}

// Process videos on channel pages
function processChannelPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
  
  // Get channel name from page
  const channelName = document.querySelector('#channel-name #text')?.textContent?.trim() || 
                     document.querySelector('#channel-header-container .ytd-channel-name')?.textContent?.trim() || '';
  
  // Check if this channel is blocked
  if (channelName) {
    const isBlocked = blockedCreators.some(creator => {
      if (globalOptions.caseSensitive) {
        return channelName.includes(creator);
      } else {
        return channelName.toLowerCase().includes(creator.toLowerCase());
      }
    });
    
    if (isBlocked) {
      // Add a banner at the top of the page
      showBlockedChannelBanner(channelName);
    }
  }
}

// Process videos on shorts page
function processShortsPage(blockedKeywords, blockedCreators) {
  const shortsElements = document.querySelectorAll('ytd-reel-video-renderer');
  shortsElements.forEach(shortsElement => {
    // Get video title
    const titleElement = shortsElement.querySelector('#video-title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = shortsElement.querySelector('#channel-name a, #text-container a');
    const channelName = channelElement?.textContent?.trim() || '';

    if (videoTitle && channelName) {
      const blockInfo = shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators);
      if (blockInfo.shouldBlock) {
        // Apply appropriate blocking mode
        applyBlockingMode(shortsElement, blockInfo);
        
        // Log the blocked short
        logBlockedVideo({
          title: videoTitle,
          creator: channelName,
          matchedKeyword: blockInfo.matchedKeyword,
          matchedCreator: blockInfo.matchedCreator,
          pageType: 'shorts'
        });
      }
    }
  });
}

// Process videos on playlist page
function processPlaylistPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// "Show Only" mode processing functions

// Process home page for "Show Only" mode
function processHomePageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process search results for "Show Only" mode
function processSearchResultsShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process subscriptions page for "Show Only" mode
function processSubscriptionsPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process trending page for "Show Only" mode
function processTrendingPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process explore page for "Show Only" mode
function processExplorePageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-rich-grid-renderer ytd-rich-item-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process watch page recommendations for "Show Only" mode
function processWatchPageRecommendationsShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-compact-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process channel page for "Show Only" mode
function processChannelPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process shorts page for "Show Only" mode
function processShortsPageShowOnly(interestKeywords) {
  const shortsElements = document.querySelectorAll('ytd-reel-video-renderer');
  processShortsElementsShowOnly(shortsElements, interestKeywords);
}

// Process playlist page for "Show Only" mode
function processPlaylistPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process a collection of video elements for "Show Only" mode
function processVideoElementsShowOnly(videoElements, interestKeywords) {
  videoElements.forEach(videoElement => {
    // Skip already processed elements for this cycle
    if (videoElement.hasAttribute('data-yt-content-blocker-show-only-processed')) {
      return;
    }
    
    // Mark as processed for this cycle
    videoElement.setAttribute('data-yt-content-blocker-show-only-processed', 'true');
    
    // Get video title
    const titleElement = videoElement.querySelector('#video-title, .title-wrapper h3, .title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = videoElement.querySelector('#channel-name a, #metadata a, .ytd-channel-name a');
    const channelName = channelElement?.textContent?.trim() || '';
    
    // Get video description if available
    const descriptionElement = videoElement.querySelector('#description, #description-text, .description');
    const description = descriptionElement?.textContent?.trim() || '';
    
    if (videoTitle && channelName) {
      // Get video ID if possible (for caching LLM results)
      let videoId = '';
      const linkElement = videoElement.querySelector('a#thumbnail');
      if (linkElement && linkElement.href) {
        const match = linkElement.href.match(/(?:v=|\/)([\w-]{11})(?:\?|&|\/|$)/);
        if (match) {
          videoId = match[1];
        }
      }
      
      // Video data object to pass to the LLM API
      const videoData = {
        videoId: videoId,
        title: videoTitle,
        channelName: channelName,
        description: description
      };
      
      // Check if this video is of interest using LLM API
      checkVideoRelevance(videoData, interestKeywords, (isRelated, matchedKeyword) => {
        if (!isRelated) {
          // If video is not related to any interest keywords, hide it
          applyShowOnlyMode(videoElement, false);
        } else {
          // If video is related, make sure it's visible and highlight it
          applyShowOnlyMode(videoElement, true, matchedKeyword);
        }
      });
    }
  });
  
  // Reset the processed state for all elements after processing is complete
  // This allows for reprocessing when filter criteria change
  setTimeout(() => {
    videoElements.forEach(el => {
      el.removeAttribute('data-yt-content-blocker-show-only-processed');
    });
  }, 100);
}

// Process shorts elements for "Show Only" mode
function processShortsElementsShowOnly(shortsElements, interestKeywords) {
  shortsElements.forEach(shortsElement => {
    // Skip already processed elements
    if (shortsElement.hasAttribute('data-yt-content-blocker-show-only-processed')) {
      return;
    }
    
    // Mark as processed
    shortsElement.setAttribute('data-yt-content-blocker-show-only-processed', 'true');
    
    // Get video title
    const titleElement = shortsElement.querySelector('#video-title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = shortsElement.querySelector('#channel-name a, #text-container a');
    const channelName = channelElement?.textContent?.trim() || '';

    if (videoTitle && channelName) {
      // Get video ID if possible
      let videoId = '';
      const match = window.location.href.match(/shorts\/([\w-]{11})/);
      if (match) {
        videoId = match[1];
      }
      
      // Video data object
      const videoData = {
        videoId: videoId,
        title: videoTitle,
        channelName: channelName,
        description: ''
      };
      
      // Check if this short is of interest
      checkVideoRelevance(videoData, interestKeywords, (isRelated, matchedKeyword) => {
        if (!isRelated) {
          // If not related, hide it
          applyShowOnlyMode(shortsElement, false);
        } else {
          // If related, make sure it's visible
          applyShowOnlyMode(shortsElement, true, matchedKeyword);
        }
      });
    }
  });
  
  // Reset the processed state
  setTimeout(() => {
    shortsElements.forEach(el => {
      el.removeAttribute('data-yt-content-blocker-show-only-processed');
    });
  }, 100);
}

// Apply the selected blocking mode to a video element
function applyBlockingMode(element, blockInfo) {
  // Add a class to mark this video as blocked
  element.classList.add('yt-content-blocker-hidden');
  
  // Apply the appropriate blocking style based on options
  switch(globalOptions.blockMode) {
    case 'blur':
      // Blur the video instead of hiding it
      element.style.filter = 'blur(10px)';
      element.style.opacity = '0.5';
      element.setAttribute('title', `Blocked: ${blockInfo.matchedKeyword || blockInfo.matchedCreator}`);
      break;
      
    case 'replace':
      // Replace with a placeholder that shows why it was blocked
      const reason = blockInfo.matchedKeyword 
        ? `Blocked keyword: "${blockInfo.matchedKeyword}"`
        : `Blocked creator: "${blockInfo.matchedCreator}"`;
      
      const height = element.offsetHeight || 'auto';
      
      // Store original HTML so it can be restored if needed
      element.setAttribute('data-original-content', element.innerHTML);
      
      // Create placeholder
      element.innerHTML = `
        <div class="yt-content-blocker-placeholder" style="
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          color: #666;
        ">
          <div>
            <div style="color: #cc0000; font-weight: bold; margin-bottom: 8px;">Content Blocked</div>
            <div>${reason}</div>
          </div>
        </div>
      `;
      break;
      
    case 'hide':
    default:
      // Default behavior: hide the video
      element.style.display = 'none';
      break;
  }
}

// Determine if a video should be blocked based on title and channel
function shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators) {
  // Default return object
  const result = {
    shouldBlock: false,
    matchedKeyword: null,
    matchedCreator: null
  };
  
  // Check against keywords, following the matching rules in options
  for (const keyword of blockedKeywords) {
    let title = videoTitle;
    let keywordToCheck = keyword;
    
    // Handle case sensitivity
    if (!globalOptions.caseSensitive) {
      title = title.toLowerCase();
      keywordToCheck = keywordToCheck.toLowerCase();
    }
    
    let isMatch = false;
    
    // Apply matching method
    switch (globalOptions.partialMatch) {
      case 'exact':
        isMatch = title === keywordToCheck;
        break;
        
      case 'word':
        const regex = new RegExp(`\\b${escapeRegExp(keywordToCheck)}\\b`, globalOptions.caseSensitive ? '' : 'i');
        isMatch = regex.test(title);
        break;
        
      case 'partial':
      default:
        isMatch = title.includes(keywordToCheck);
        break;
    }
    
    if (isMatch) {
      result.shouldBlock = true;
      result.matchedKeyword = keyword;
      return result;
    }
  }

  // Check against blocked creators
  for (const creator of blockedCreators) {
    let channel = channelName;
    let creatorToCheck = creator;
    
    // Handle case sensitivity
    if (!globalOptions.caseSensitive) {
      channel = channel.toLowerCase();
      creatorToCheck = creatorToCheck.toLowerCase();
    }
    
    // We use includes() for creators to catch partial matches
    if (channel.includes(creatorToCheck)) {
      result.shouldBlock = true;
      result.matchedCreator = creator;
      return result;
    }
  }

  return result;
}

// Escape special characters for regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create an overlay for when a user is on a blocked video page
function showBlockedVideoOverlay() {
  // Only create overlay if it doesn't already exist
  if (!document.querySelector('.yt-content-blocker-overlay')) {
    const player = document.querySelector('#player');
    
    if (player) {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'yt-content-blocker-overlay';
      overlay.innerHTML = `
        <div class="yt-content-blocker-message">
          <h2>Video Blocked</h2>
          <p>This video matches your blocking criteria.</p>
          <button id="yt-content-blocker-go-back">Go Back</button>
          <button id="yt-content-blocker-show-anyway" class="secondary">Show Anyway</button>
        </div>
      `;

      // Style the overlay
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '9999';

      // Style the message
      const message = overlay.querySelector('.yt-content-blocker-message');
      message.style.backgroundColor = 'white';
      message.style.padding = '30px';
      message.style.borderRadius = '8px';
      message.style.textAlign = 'center';
      message.style.maxWidth = '400px';

      // Style the title
      const title = overlay.querySelector('h2');
      title.style.color = '#cc0000';
      title.style.marginBottom = '15px';

      // Style the primary button
      const primaryButton = overlay.querySelector('#yt-content-blocker-go-back');
      primaryButton.style.backgroundColor = '#cc0000';
      primaryButton.style.color = 'white';
      primaryButton.style.border = 'none';
      primaryButton.style.padding = '10px 20px';
      primaryButton.style.borderRadius = '4px';
      primaryButton.style.marginTop = '20px';
      primaryButton.style.marginRight = '10px';
      primaryButton.style.cursor = 'pointer';
      primaryButton.style.fontWeight = 'bold';

      // Style the secondary button
      const secondaryButton = overlay.querySelector('#yt-content-blocker-show-anyway');
      secondaryButton.style.backgroundColor = '#f0f0f0';
      secondaryButton.style.color = '#333';
      secondaryButton.style.border = 'none';
      secondaryButton.style.padding = '10px 20px';
      secondaryButton.style.borderRadius = '4px';
      secondaryButton.style.marginTop = '20px';
      secondaryButton.style.cursor = 'pointer';

      // Add primary button event listener
      primaryButton.addEventListener('click', () => {
        window.history.back();
      });

      // Add secondary button event listener
      secondaryButton.addEventListener('click', () => {
        overlay.remove();
      });

      // Add overlay to the page
      document.body.appendChild(overlay);
    }
  }
}

// Show a banner when a user is on a blocked channel page
function showBlockedChannelBanner(channelName) {
  // Only create banner if it doesn't already exist
  if (!document.querySelector('.yt-content-blocker-channel-banner')) {
    const header = document.querySelector('#channel-header');
    
    if (header) {
      // Create banner
      const banner = document.createElement('div');
      banner.className = 'yt-content-blocker-channel-banner';
      banner.innerHTML = `
        <div class="banner-message">
          <strong>Warning:</strong> This channel (${channelName}) is in your blocked creators list.
          <button id="yt-content-blocker-unblock-channel">Unblock Channel</button>
        </div>
      `;

      // Style the banner
      banner.style.backgroundColor = 'rgba(204, 0, 0, 0.1)';
      banner.style.color = '#cc0000';
      banner.style.padding = '10px 20px';
      banner.style.textAlign = 'center';
      banner.style.fontSize = '14px';
      banner.style.fontWeight = 'normal';
      banner.style.borderBottom = '1px solid #cc0000';
      
      // Style the button
      const button = banner.querySelector('button');
      button.style.backgroundColor = '#cc0000';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.padding = '5px 10px';
      button.style.borderRadius = '4px';
      button.style.marginLeft = '10px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';

      // Add button event listener
      button.addEventListener('click', () => {
        chrome.storage.sync.get(['blockedCreators'], (result) => {
          const blockedCreators = result.blockedCreators || [];
          const updatedList = blockedCreators.filter(creator => {
            return !channelName.toLowerCase().includes(creator.toLowerCase());
          });
          
          chrome.storage.sync.set({ blockedCreators: updatedList }, () => {
            banner.innerHTML = `<div class="banner-message">Channel unblocked successfully!</div>`;
            banner.style.backgroundColor = 'rgba(0, 204, 0, 0.1)';
            banner.style.color = '#00cc00';
            
            // Remove banner after 3 seconds
            setTimeout(() => {
              banner.remove();
            }, 3000);
          });
        });
      });

      // Insert banner at the top of the page
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }
}

// Log blocked video to statistics
function logBlockedVideo(data) {
  // Update local page stats
  pageBlockStats.total++;
  
  if (data.matchedKeyword) {
    pageBlockStats.keywords[data.matchedKeyword] = (pageBlockStats.keywords[data.matchedKeyword] || 0) + 1;
  }
  
  if (data.matchedCreator) {
    pageBlockStats.creators[data.matchedCreator] = (pageBlockStats.creators[data.matchedCreator] || 0) + 1;
  }
  
  // Send to background script to update global stats
  chrome.runtime.sendMessage({
    action: 'logBlockedVideo',
    data: data
  });
}

// Create a MutationObserver to detect when new videos are added to the page
function setupMutationObserver() {
  // Disconnect any existing observer
  if (mutationObserver) {
    mutationObserver.disconnect();
  }
  
  // Clear any pending scan
  if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
  }

  // Create a new observer
  mutationObserver = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        shouldProcess = true;
      }
    });
    
    // Use debounced processing to avoid performance issues
    if (shouldProcess) {
      if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
      }
      
      scanTimeoutId = setTimeout(() => {
        processYouTubeVideos();
      }, globalOptions.scanInterval);
    }
  });

  // Start observing the document with the configured parameters
  mutationObserver.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false,
    characterData: false
  });
}

// Add CSS styles for blocked content
function addBlockedContentStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .yt-content-blocker-hidden {
      /* Base styles applied to all blocked videos regardless of mode */
      position: relative;
    }
    
    /* Transition effects for blur mode */
    .yt-content-blocker-hidden[style*="filter: blur"] {
      transition: filter 0.3s ease, opacity 0.3s ease;
    }
    
    /* Smooth transition for any elements we hide */
    [data-yt-content-blocker-processed="true"],
    [data-yt-content-blocker-show-only-processed="true"] {
      transition: opacity 0.3s ease, filter 0.3s ease;
    }
    
    /* Styling for the channel banner */
    .yt-content-blocker-channel-banner {
      position: sticky;
      top: 0;
      z-index: 9000;
      width: 100%;
    }
    
    /* Styling for interest match highlighting */
    .yt-content-blocker-interest-match {
      outline: 2px solid rgba(0, 128, 255, 0.5);
      outline-offset: -2px;
      position: relative;
    }
    
    /* Badge animation */
    .yt-content-blocker-badge {
      animation: fadeIn 0.3s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Make overlay responsive */
    @media (max-width: 768px) {
      .yt-content-blocker-message {
        width: 90% !important;
        padding: 20px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Handle channel name extraction for context menu
function getChannelFromElement(linkUrl) {
  // Find all links on the page
  const links = document.querySelectorAll('a');
  
  for (const link of links) {
    if (link.href === linkUrl) {
      // Get closest container that might have channel info
      const container = link.closest('ytd-channel-name');
      if (container) {
        const channelName = container.querySelector('#text')?.textContent?.trim();
        if (channelName) {
          return channelName;
        }
      }
      
      // If we found the link but couldn't extract the name
      return link.textContent?.trim() || null;
    }
  }
  
  return null;
}

// Initialize the extension
function init() {
  // Get options first
  chrome.runtime.sendMessage({ action: 'getOptions' }, (response) => {
    if (response && response.options) {
      globalOptions = response.options;
    }
    
    // Process videos initially
    processYouTubeVideos();
    
    // Add CSS styles
    addBlockedContentStyles();
    
    // Set up mutation observer to catch dynamically loaded content
    setupMutationObserver();
    
    console.log('YouTube Content Blocker: Initialized successfully');
  });
}

// Run initialization when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsUpdated') {
    // Refresh processing when settings change
    processYouTubeVideos();
    sendResponse({ success: true });
  } else if (message.action === 'getChannelName') {
    // Extract channel name from link or element
    const channelName = getChannelFromElement(message.data.linkUrl);
    sendResponse({ channelName });
  } else if (message.action === 'getChannelFromElement') {
    // Extract channel directly from DOM element
    const channelName = getChannelFromElement(message.data.linkUrl);
    sendResponse({ channelName });
  }
  
  // Must return true if we want to send a response asynchronously
  return true;
});

// Ensure the LLM API functions are available
// This is necessary because content.js needs to use checkVideoRelevance function from llm-api.js
if (typeof checkVideoRelevance !== 'function') {
  // Simple fallback implementation that checks for keywords in title and channel
  function checkVideoRelevance(videoData, interestKeywords, callback) {
    if (!interestKeywords || interestKeywords.length === 0) {
      callback(false, null);
      return;
    }
    
    const videoText = `${videoData.title} ${videoData.channelName} ${videoData.description || ''}`.toLowerCase();
    
    for (const keyword of interestKeywords) {
      if (videoText.includes(keyword.toLowerCase())) {
        callback(true, keyword);
        return;
      }
    }
    
    callback(false, null);
  }
  
  // When the actual LLM API is loaded, it will override these functions
  console.log('YouTube Content Blocker: Using fallback keyword matching until LLM API is loaded');
}

// Process videos on home page
function processHomePage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on search results
function processSearchResults(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on subscriptions page
function processSubscriptionsPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on trending page
function processTrendingPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on explore page
function processExplorePage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-rich-grid-renderer ytd-rich-item-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process recommendations on watch page
function processWatchPageRecommendations(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-compact-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);

  // Also check if current video should be blocked (refresh if so)
  const videoTitle = document.querySelector('.ytd-video-primary-info-renderer .title')?.textContent?.trim() || '';
  const channelName = document.querySelector('#owner #text a')?.textContent?.trim() || '';
  
  if (videoTitle && channelName) {
    const blockInfo = shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators);
    if (blockInfo.shouldBlock) {
      // If user is watching a video that should be blocked, show warning and offer to go back
      showBlockedVideoOverlay();
      
      // Log the blocked video
      logBlockedVideo({
        title: videoTitle,
        creator: channelName,
        matchedKeyword: blockInfo.matchedKeyword,
        matchedCreator: blockInfo.matchedCreator,
        pageType: 'watch'
      });
    }
  }
}

// Process videos on channel pages
function processChannelPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
  
  // Get channel name from page
  const channelName = document.querySelector('#channel-name #text')?.textContent?.trim() || 
                     document.querySelector('#channel-header-container .ytd-channel-name')?.textContent?.trim() || '';
  
  // Check if this channel is blocked
  if (channelName) {
    const isBlocked = blockedCreators.some(creator => {
      if (globalOptions.caseSensitive) {
        return channelName.includes(creator);
      } else {
        return channelName.toLowerCase().includes(creator.toLowerCase());
      }
    });
    
    if (isBlocked) {
      // Add a banner at the top of the page
      showBlockedChannelBanner(channelName);
    }
  }
}

// Process videos on shorts page
function processShortsPage(blockedKeywords, blockedCreators) {
  const shortsElements = document.querySelectorAll('ytd-reel-video-renderer');
  shortsElements.forEach(shortsElement => {
    // Get video title
    const titleElement = shortsElement.querySelector('#video-title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = shortsElement.querySelector('#channel-name a, #text-container a');
    const channelName = channelElement?.textContent?.trim() || '';

    if (videoTitle && channelName) {
      const blockInfo = shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators);
      if (blockInfo.shouldBlock) {
        // Apply appropriate blocking mode
        applyBlockingMode(shortsElement, blockInfo);
        
        // Log the blocked short
        logBlockedVideo({
          title: videoTitle,
          creator: channelName,
          matchedKeyword: blockInfo.matchedKeyword,
          matchedCreator: blockInfo.matchedCreator,
          pageType: 'shorts'
        });
      }
    }
  });
}

// Process videos on playlist page
function processPlaylistPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// "Show Only" mode processing functions

// Process home page for "Show Only" mode
function processHomePageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process search results for "Show Only" mode
function processSearchResultsShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process subscriptions page for "Show Only" mode
function processSubscriptionsPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process trending page for "Show Only" mode
function processTrendingPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process explore page for "Show Only" mode
function processExplorePageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-rich-grid-renderer ytd-rich-item-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process watch page recommendations for "Show Only" mode
function processWatchPageRecommendationsShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-compact-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process channel page for "Show Only" mode
function processChannelPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process shorts page for "Show Only" mode
function processShortsPageShowOnly(interestKeywords) {
  const shortsElements = document.querySelectorAll('ytd-reel-video-renderer');
  processShortsElementsShowOnly(shortsElements, interestKeywords);
}

// Process playlist page for "Show Only" mode
function processPlaylistPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process a collection of video elements for "Show Only" mode
function processVideoElementsShowOnly(videoElements, interestKeywords) {
  videoElements.forEach(videoElement => {
    // Skip already processed elements for this cycle
    if (videoElement.hasAttribute('data-yt-content-blocker-show-only-processed')) {
      return;
    }
    
    // Mark as processed for this cycle
    videoElement.setAttribute('data-yt-content-blocker-show-only-processed', 'true');
    
    // Get video title
    const titleElement = videoElement.querySelector('#video-title, .title-wrapper h3, .title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = videoElement.querySelector('#channel-name a, #metadata a, .ytd-channel-name a');
    const channelName = channelElement?.textContent?.trim() || '';
    
    // Get video description if available
    const descriptionElement = videoElement.querySelector('#description, #description-text, .description');
    const description = descriptionElement?.textContent?.trim() || '';
    
    if (videoTitle && channelName) {
      // Get video ID if possible (for caching LLM results)
      let videoId = '';
      const linkElement = videoElement.querySelector('a#thumbnail');
      if (linkElement && linkElement.href) {
        const match = linkElement.href.match(/(?:v=|\/)([\w-]{11})(?:\?|&|\/|$)/);
        if (match) {
          videoId = match[1];
        }
      }
      
      // Video data object to pass to the LLM API
      const videoData = {
        videoId: videoId,
        title: videoTitle,
        channelName: channelName,
        description: description
      };
      
      // Check if this video is of interest using LLM API
      checkVideoRelevance(videoData, interestKeywords, (isRelated, matchedKeyword) => {
        if (!isRelated) {
          // If video is not related to any interest keywords, hide it
          applyShowOnlyMode(videoElement, false);
        } else {
          // If video is related, make sure it's visible and highlight it
          applyShowOnlyMode(videoElement, true, matchedKeyword);
        }
      });
    }
  });
  
  // Reset the processed state for all elements after processing is complete
  // This allows for reprocessing when filter criteria change
  setTimeout(() => {
    videoElements.forEach(el => {
      el.removeAttribute('data-yt-content-blocker-show-only-processed');
    });
  }, 100);
}

// Process shorts elements for "Show Only" mode
function processShortsElementsShowOnly(shortsElements, interestKeywords) {
  shortsElements.forEach(shortsElement => {
    // Skip already processed elements
    if (shortsElement.hasAttribute('data-yt-content-blocker-show-only-processed')) {
      return;
    }
    
    // Mark as processed
    shortsElement.setAttribute('data-yt-content-blocker-show-only-processed', 'true');
    
    // Get video title
    const titleElement = shortsElement.querySelector('#video-title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = shortsElement.querySelector('#channel-name a, #text-container a');
    const channelName = channelElement?.textContent?.trim() || '';

    if (videoTitle && channelName) {
      // Get video ID if possible
      let videoId = '';
      const match = window.location.href.match(/shorts\/([\w-]{11})/);
      if (match) {
        videoId = match[1];
      }
      
      // Video data object
      const videoData = {
        videoId: videoId,
        title: videoTitle,
        channelName: channelName,
        description: ''
      };
      
      // Check if this short is of interest
      checkVideoRelevance(videoData, interestKeywords, (isRelated, matchedKeyword) => {
        if (!isRelated) {
          // If not related, hide it
          applyShowOnlyMode(shortsElement, false);
        } else {
          // If related, make sure it's visible
          applyShowOnlyMode(shortsElement, true, matchedKeyword);
        }
      });
    }
  });
  
  // Reset the processed state
  setTimeout(() => {
    shortsElements.forEach(el => {
      el.removeAttribute('data-yt-content-blocker-show-only-processed');
    });
  }, 100);
}

// Apply the selected blocking mode to a video element
function applyBlockingMode(element, blockInfo) {
  // Add a class to mark this video as blocked
  element.classList.add('yt-content-blocker-hidden');
  
  // Apply the appropriate blocking style based on options
  switch(globalOptions.blockMode) {
    case 'blur':
      // Blur the video instead of hiding it
      element.style.filter = 'blur(10px)';
      element.style.opacity = '0.5';
      element.setAttribute('title', `Blocked: ${blockInfo.matchedKeyword || blockInfo.matchedCreator}`);
      break;
      
    case 'replace':
      // Replace with a placeholder that shows why it was blocked
      const reason = blockInfo.matchedKeyword 
        ? `Blocked keyword: "${blockInfo.matchedKeyword}"`
        : `Blocked creator: "${blockInfo.matchedCreator}"`;
      
      const height = element.offsetHeight || 'auto';
      
      // Store original HTML so it can be restored if needed
      element.setAttribute('data-original-content', element.innerHTML);
      
      // Create placeholder
      element.innerHTML = `
        <div class="yt-content-blocker-placeholder" style="
          height: ${height}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          color: #666;
        ">
          <div>
            <div style="color: #cc0000; font-weight: bold; margin-bottom: 8px;">Content Blocked</div>
            <div>${reason}</div>
          </div>
        </div>
      `;
      break;
      
    case 'hide':
    default:
      // Default behavior: hide the video
      element.style.display = 'none';
      break;
  }
}

// Determine if a video should be blocked based on title and channel
function shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators) {
  // Default return object
  const result = {
    shouldBlock: false,
    matchedKeyword: null,
    matchedCreator: null
  };
  
  // Check against keywords, following the matching rules in options
  for (const keyword of blockedKeywords) {
    let title = videoTitle;
    let keywordToCheck = keyword;
    
    // Handle case sensitivity
    if (!globalOptions.caseSensitive) {
      title = title.toLowerCase();
      keywordToCheck = keywordToCheck.toLowerCase();
    }
    
    let isMatch = false;
    
    // Apply matching method
    switch (globalOptions.partialMatch) {
      case 'exact':
        isMatch = title === keywordToCheck;
        break;
        
      case 'word':
        const regex = new RegExp(`\\b${escapeRegExp(keywordToCheck)}\\b`, globalOptions.caseSensitive ? '' : 'i');
        isMatch = regex.test(title);
        break;
        
      case 'partial':
      default:
        isMatch = title.includes(keywordToCheck);
        break;
    }
    
    if (isMatch) {
      result.shouldBlock = true;
      result.matchedKeyword = keyword;
      return result;
    }
  }

  // Check against blocked creators
  for (const creator of blockedCreators) {
    let channel = channelName;
    let creatorToCheck = creator;
    
    // Handle case sensitivity
    if (!globalOptions.caseSensitive) {
      channel = channel.toLowerCase();
      creatorToCheck = creatorToCheck.toLowerCase();
    }
    
    // We use includes() for creators to catch partial matches
    if (channel.includes(creatorToCheck)) {
      result.shouldBlock = true;
      result.matchedCreator = creator;
      return result;
    }
  }

  return result;
}

// Escape special characters for regex
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create an overlay for when a user is on a blocked video page
function showBlockedVideoOverlay() {
  // Only create overlay if it doesn't already exist
  if (!document.querySelector('.yt-content-blocker-overlay')) {
    const player = document.querySelector('#player');
    
    if (player) {
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'yt-content-blocker-overlay';
      overlay.innerHTML = `
        <div class="yt-content-blocker-message">
          <h2>Video Blocked</h2>
          <p>This video matches your blocking criteria.</p>
          <button id="yt-content-blocker-go-back">Go Back</button>
          <button id="yt-content-blocker-show-anyway" class="secondary">Show Anyway</button>
        </div>
      `;

      // Style the overlay
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
      overlay.style.display = 'flex';
      overlay.style.justifyContent = 'center';
      overlay.style.alignItems = 'center';
      overlay.style.zIndex = '9999';

      // Style the message
      const message = overlay.querySelector('.yt-content-blocker-message');
      message.style.backgroundColor = 'white';
      message.style.padding = '30px';
      message.style.borderRadius = '8px';
      message.style.textAlign = 'center';
      message.style.maxWidth = '400px';

      // Style the title
      const title = overlay.querySelector('h2');
      title.style.color = '#cc0000';
      title.style.marginBottom = '15px';

      // Style the primary button
      const primaryButton = overlay.querySelector('#yt-content-blocker-go-back');
      primaryButton.style.backgroundColor = '#cc0000';
      primaryButton.style.color = 'white';
      primaryButton.style.border = 'none';
      primaryButton.style.padding = '10px 20px';
      primaryButton.style.borderRadius = '4px';
      primaryButton.style.marginTop = '20px';
      primaryButton.style.marginRight = '10px';
      primaryButton.style.cursor = 'pointer';
      primaryButton.style.fontWeight = 'bold';

      // Style the secondary button
      const secondaryButton = overlay.querySelector('#yt-content-blocker-show-anyway');
      secondaryButton.style.backgroundColor = '#f0f0f0';
      secondaryButton.style.color = '#333';
      secondaryButton.style.border = 'none';
      secondaryButton.style.padding = '10px 20px';
      secondaryButton.style.borderRadius = '4px';
      secondaryButton.style.marginTop = '20px';
      secondaryButton.style.cursor = 'pointer';

      // Add primary button event listener
      primaryButton.addEventListener('click', () => {
        window.history.back();
      });

      // Add secondary button event listener
      secondaryButton.addEventListener('click', () => {
        overlay.remove();
      });

      // Add overlay to the page
      document.body.appendChild(overlay);
    }
  }
}

// Show a banner when a user is on a blocked channel page
function showBlockedChannelBanner(channelName) {
  // Only create banner if it doesn't already exist
  if (!document.querySelector('.yt-content-blocker-channel-banner')) {
    const header = document.querySelector('#channel-header');
    
    if (header) {
      // Create banner
      const banner = document.createElement('div');
      banner.className = 'yt-content-blocker-channel-banner';
      banner.innerHTML = `
        <div class="banner-message">
          <strong>Warning:</strong> This channel (${channelName}) is in your blocked creators list.
          <button id="yt-content-blocker-unblock-channel">Unblock Channel</button>
        </div>
      `;

      // Style the banner
      banner.style.backgroundColor = 'rgba(204, 0, 0, 0.1)';
      banner.style.color = '#cc0000';
      banner.style.padding = '10px 20px';
      banner.style.textAlign = 'center';
      banner.style.fontSize = '14px';
      banner.style.fontWeight = 'normal';
      banner.style.borderBottom = '1px solid #cc0000';
      
      // Style the button
      const button = banner.querySelector('button');
      button.style.backgroundColor = '#cc0000';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.padding = '5px 10px';
      button.style.borderRadius = '4px';
      button.style.marginLeft = '10px';
      button.style.cursor = 'pointer';
      button.style.fontSize = '12px';

      // Add button event listener
      button.addEventListener('click', () => {
        chrome.storage.sync.get(['blockedCreators'], (result) => {
          const blockedCreators = result.blockedCreators || [];
          const updatedList = blockedCreators.filter(creator => {
            return !channelName.toLowerCase().includes(creator.toLowerCase());
          });
          
          chrome.storage.sync.set({ blockedCreators: updatedList }, () => {
            banner.innerHTML = `<div class="banner-message">Channel unblocked successfully!</div>`;
            banner.style.backgroundColor = 'rgba(0, 204, 0, 0.1)';
            banner.style.color = '#00cc00';
            
            // Remove banner after 3 seconds
            setTimeout(() => {
              banner.remove();
            }, 3000);
          });
        });
      });

      // Insert banner at the top of the page
      document.body.insertBefore(banner, document.body.firstChild);
    }
  }
}

// Log blocked video to statistics
function logBlockedVideo(data) {
  // Update local page stats
  pageBlockStats.total++;
  
  if (data.matchedKeyword) {
    pageBlockStats.keywords[data.matchedKeyword] = (pageBlockStats.keywords[data.matchedKeyword] || 0) + 1;
  }
  
  if (data.matchedCreator) {
    pageBlockStats.creators[data.matchedCreator] = (pageBlockStats.creators[data.matchedCreator] || 0) + 1;
  }
  
  // Send to background script to update global stats
  chrome.runtime.sendMessage({
    action: 'logBlockedVideo',
    data: data
  });
}

// Create a MutationObserver to detect when new videos are added to the page
function setupMutationObserver() {
  // Disconnect any existing observer
  if (mutationObserver) {
    mutationObserver.disconnect();
  }
  
  // Clear any pending scan
  if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
  }

  // Create a new observer
  mutationObserver = new MutationObserver((mutations) => {
    let shouldProcess = false;
    
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        shouldProcess = true;
      }
    });
    
    // Use debounced processing to avoid performance issues
    if (shouldProcess) {
      if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
      }
      
      scanTimeoutId = setTimeout(() => {
        processYouTubeVideos();
      }, globalOptions.scanInterval);
    }
  });

  // Start observing the document with the configured parameters
  mutationObserver.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: false,
    characterData: false
  });
}

// Add CSS styles for blocked content
function addBlockedContentStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .yt-content-blocker-hidden {
      /* Base styles applied to all blocked videos regardless of mode */
      position: relative;
    }
    
    /* Transition effects for blur mode */
    .yt-content-blocker-hidden[style*="filter: blur"] {
      transition: filter 0.3s ease, opacity 0.3s ease;
    }
    
    /* Smooth transition for any elements we hide */
    [data-yt-content-blocker-processed="true"],
    [data-yt-content-blocker-show-only-processed="true"] {
      transition: opacity 0.3s ease, filter 0.3s ease;
    }
    
    /* Styling for the channel banner */
    .yt-content-blocker-channel-banner {
      position: sticky;
      top: 0;
      z-index: 9000;
      width: 100%;
    }
    
    /* Styling for interest match highlighting */
    .yt-content-blocker-interest-match {
      outline: 2px solid rgba(0, 128, 255, 0.5);
      outline-offset: -2px;
      position: relative;
    }
    
    /* Badge animation */
    .yt-content-blocker-badge {
      animation: fadeIn 0.3s ease-in-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Make overlay responsive */
    @media (max-width: 768px) {
      .yt-content-blocker-message {
        width: 90% !important;
        padding: 20px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// Handle channel name extraction for context menu
function getChannelFromElement(linkUrl) {
  // Find all links on the page
  const links = document.querySelectorAll('a');
  
  for (const link of links) {
    if (link.href === linkUrl) {
      // Get closest container that might have channel info
      const container = link.closest('ytd-channel-name');
      if (container) {
        const channelName = container.querySelector('#text')?.textContent?.trim();
        if (channelName) {
          return channelName;
        }
      }
      
      // If we found the link but couldn't extract the name
      return link.textContent?.trim() || null;
    }
  }
  
  return null;
}

// Initialize the extension
function init() {
  // Get options first
  chrome.runtime.sendMessage({ action: 'getOptions' }, (response) => {
    if (response && response.options) {
      globalOptions = response.options;
    }
    
    // Process videos initially
    processYouTubeVideos();
    
    // Add CSS styles
    addBlockedContentStyles();
    
    // Set up mutation observer to catch dynamically loaded content
    setupMutationObserver();
    
    console.log('YouTube Content Blocker: Initialized successfully');
  });
}

// Run initialization when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsUpdated') {
    // Refresh processing when settings change
    processYouTubeVideos();
    sendResponse({ success: true });
  } else if (message.action === 'getChannelName') {
    // Extract channel name from link or element
    const channelName = getChannelFromElement(message.data.linkUrl);
    sendResponse({ channelName });
  } else if (message.action === 'getChannelFromElement') {
    // Extract channel directly from DOM element
    const channelName = getChannelFromElement(message.data.linkUrl);
    sendResponse({ channelName });
  }
  
  // Must return true if we want to send a response asynchronously
  return true;
});

// Ensure the LLM API functions are available
// This is necessary because content.js needs to use checkVideoRelevance function from llm-api.js
if (typeof checkVideoRelevance !== 'function') {
  // Simple fallback implementation that checks for keywords in title and channel
  function checkVideoRelevance(videoData, interestKeywords, callback) {
    if (!interestKeywords || interestKeywords.length === 0) {
      callback(false, null);
      return;
    }
    
    const videoText = `${videoData.title} ${videoData.channelName} ${videoData.description || ''}`.toLowerCase();
    
    for (const keyword of interestKeywords) {
      if (videoText.includes(keyword.toLowerCase())) {
        callback(true, keyword);
        return;
      }
    }
    
    callback(false, null);
  }
  
  // When the actual LLM API is loaded, it will override these functions
  console.log('YouTube Content Blocker: Using fallback keyword matching until LLM API is loaded');
}

// Process videos on home page
function processHomePage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on search results
function processSearchResults(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on subscriptions page
function processSubscriptionsPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on trending page
function processTrendingPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process videos on explore page
function processExplorePage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-rich-grid-renderer ytd-rich-item-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// Process recommendations on watch page
function processWatchPageRecommendations(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-compact-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);

  // Also check if current video should be blocked (refresh if so)
  const videoTitle = document.querySelector('.ytd-video-primary-info-renderer .title')?.textContent?.trim() || '';
  const channelName = document.querySelector('#owner #text a')?.textContent?.trim() || '';
  
  if (videoTitle && channelName) {
    const blockInfo = shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators);
    if (blockInfo.shouldBlock) {
      // If user is watching a video that should be blocked, show warning and offer to go back
      showBlockedVideoOverlay();
      
      // Log the blocked video
      logBlockedVideo({
        title: videoTitle,
        creator: channelName,
        matchedKeyword: blockInfo.matchedKeyword,
        matchedCreator: blockInfo.matchedCreator,
        pageType: 'watch'
      });
    }
  }
}

// Process videos on channel pages
function processChannelPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
  
  // Get channel name from page
  const channelName = document.querySelector('#channel-name #text')?.textContent?.trim() || 
                     document.querySelector('#channel-header-container .ytd-channel-name')?.textContent?.trim() || '';
  
  // Check if this channel is blocked
  if (channelName) {
    const isBlocked = blockedCreators.some(creator => {
      if (globalOptions.caseSensitive) {
        return channelName.includes(creator);
      } else {
        return channelName.toLowerCase().includes(creator.toLowerCase());
      }
    });
    
    if (isBlocked) {
      // Add a banner at the top of the page
      showBlockedChannelBanner(channelName);
    }
  }
}

// Process videos on shorts page
function processShortsPage(blockedKeywords, blockedCreators) {
  const shortsElements = document.querySelectorAll('ytd-reel-video-renderer');
  shortsElements.forEach(shortsElement => {
    // Get video title
    const titleElement = shortsElement.querySelector('#video-title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = shortsElement.querySelector('#channel-name a, #text-container a');
    const channelName = channelElement?.textContent?.trim() || '';

    if (videoTitle && channelName) {
      const blockInfo = shouldBlockVideo(videoTitle, channelName, blockedKeywords, blockedCreators);
      if (blockInfo.shouldBlock) {
        // Apply appropriate blocking mode
        applyBlockingMode(shortsElement, blockInfo);
        
        // Log the blocked short
        logBlockedVideo({
          title: videoTitle,
          creator: channelName,
          matchedKeyword: blockInfo.matchedKeyword,
          matchedCreator: blockInfo.matchedCreator,
          pageType: 'shorts'
        });
      }
    }
  });
}

// Process videos on playlist page
function processPlaylistPage(blockedKeywords, blockedCreators) {
  const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
  processVideoElements(videoElements, blockedKeywords, blockedCreators);
}

// "Show Only" mode processing functions

// Process home page for "Show Only" mode
function processHomePageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process search results for "Show Only" mode
function processSearchResultsShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process subscriptions page for "Show Only" mode
function processSubscriptionsPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process trending page for "Show Only" mode
function processTrendingPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process explore page for "Show Only" mode
function processExplorePageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-rich-grid-renderer ytd-rich-item-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process watch page recommendations for "Show Only" mode
function processWatchPageRecommendationsShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-compact-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process channel page for "Show Only" mode
function processChannelPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-grid-video-renderer, ytd-rich-item-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process shorts page for "Show Only" mode
function processShortsPageShowOnly(interestKeywords) {
  const shortsElements = document.querySelectorAll('ytd-reel-video-renderer');
  processShortsElementsShowOnly(shortsElements, interestKeywords);
}

// Process playlist page for "Show Only" mode
function processPlaylistPageShowOnly(interestKeywords) {
  const videoElements = document.querySelectorAll('ytd-playlist-video-renderer');
  processVideoElementsShowOnly(videoElements, interestKeywords);
}

// Process a collection of video elements for "Show Only" mode
function processVideoElementsShowOnly(videoElements, interestKeywords) {
  videoElements.forEach(videoElement => {
    // Skip already processed elements for this cycle
    if (videoElement.hasAttribute('data-yt-content-blocker-show-only-processed')) {
      return;
    }
    
    // Mark as processed for this cycle
    videoElement.setAttribute('data-yt-content-blocker-show-only-processed', 'true');
    
    // Get video title
    const titleElement = videoElement.querySelector('#video-title, .title-wrapper h3, .title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = videoElement.querySelector('#channel-name a, #metadata a, .ytd-channel-name a');
    const channelName = channelElement?.textContent?.trim() || '';
    
    // Get video description if available
    const descriptionElement = videoElement.querySelector('#description, #description-text, .description');
    const description = descriptionElement?.textContent?.trim() || '';
    
    if (videoTitle && channelName) {
      // Get video ID if possible (for caching LLM results)
      let videoId = '';
      const linkElement = videoElement.querySelector('a#thumbnail');
      if (linkElement && linkElement.href) {
        const match = linkElement.href.match(/(?:v=|\/)([\w-]{11})(?:\?|&|\/|$)/);
        if (match) {
          videoId = match[1];
        }
      }
      
      // Video data object to pass to the LLM API
      const videoData = {
        videoId: videoId,
        title: videoTitle,
        channelName: channelName,
        description: description
      };
      
      // Check if this video is of interest using LLM API
      checkVideoRelevance(videoData, interestKeywords, (isRelated, matchedKeyword) => {
        if (!isRelated) {
          // If video is not related to any interest keywords, hide it
          applyShowOnlyMode(videoElement, false);
        } else {
          // If video is related, make sure it's visible and highlight it
          applyShowOnlyMode(videoElement, true, matchedKeyword);
        }
      });
    }
  });
  
  // Reset the processed state for all elements after processing is complete
  // This allows for reprocessing when filter criteria change
  setTimeout(() => {
    videoElements.forEach(el => {
      el.removeAttribute('data-yt-content-blocker-show-only-processed');
    });
  }, 100);
}

// Process shorts elements for "Show Only" mode
function processShortsElementsShowOnly(shortsElements, interestKeywords) {
  shortsElements.forEach(shortsElement => {
    // Skip already processed elements
    if (shortsElement.hasAttribute('data-yt-content-blocker-show-only-processed')) {
      return;
    }
    
    // Mark as processed
    shortsElement.setAttribute('data-yt-content-blocker-show-only-processed', 'true');
    
    // Get video title
    const titleElement = shortsElement.querySelector('#video-title');
    const videoTitle = titleElement?.textContent?.trim() || '';
    
    // Get channel name
    const channelElement = shortsElement.querySelector('#channel-name a, #text-container a');
    const channelName = channelElement?.textContent?.trim() || '';

    if (videoTitle && channelName) {
      // Get video ID if possible
      let videoId = '';
      const match = window.location.href.match(/shorts\/([\w-]{11})/);
      if (match) {
        videoId = match[1];
      }
      
      // Video data object
      const videoData = {
        videoId: videoId,
        title: videoTitle,
        channelName: channelName,
        description: ''
      };
      
      // Check if this short is of interest
      checkVideoRelevance(videoData, interestKeywords, (isRelated, matchedKeyword) => {
        if (!isRelated) {
          // If not related, hide it
          applyShowOnlyMode(shortsElement, false);
        } else {
          // If related, make sure it's visible
          applyShowOnlyMode(shortsElement, true, matchedKeyword);
        }
      });
    }
  });
  
  // Reset the processed state
  setTimeout(() => {
    shortsElements.forEach(el => {
      el.removeAttribute('data-yt-content-blocker-show-only-processed');
    });
  }, 100);
}

// Apply the appropriate visibility for "Show Only" mode
function applyShowOnlyMode(element, showElement, matchedKeyword = null) {
  if (showElement) {
    // If the element should be shown, remove any hiding styles
    element.style.display = '';
    element.style.filter = '';
    element.style.opacity = '';
    element.classList.remove('yt-content-blocker-hidden');
    
    // Add a slight highlight to indicate it matches interest criteria
    element.classList.add('yt-content-blocker-interest-match');
    
    // Add a badge to show which keyword matched
    if (matchedKeyword && !element.querySelector('.yt-content-blocker-badge')) {
      const badgeContainer = document.createElement('div');
      badgeContainer.className = 'yt-content-blocker-badge';
      badgeContainer.textContent = matchedKeyword;
      badgeContainer.style.position = 'absolute';
      badgeContainer.style.top = '4px';
      badgeContainer.style.right = '4px';
      badgeContainer.style.backgroundColor = 'rgba(0, 128, 255, 0.7)';
      badgeContainer.style.color = 'white';
      badgeContainer.style.padding = '2px 6px';
      badgeContainer.style.borderRadius = '4px';
      badgeContainer.style.fontSize = '11px';
      badgeContainer.style.zIndex = '2';
      
      // Find the right place to insert the badge
      const thumbnailContainer = element.querySelector('#thumbnail') || element;
      thumbnailContainer.style.position = 'relative';
      thumbnailContainer.appendChild(badgeContainer);
    }
  } else {
    // If the element should be hidden
    element.style.display = 'none';
    element.classList.add('yt-content-blocker-hidden');
  }
}
