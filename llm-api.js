/**
 * YouTube Content Blocker - LLM API Integration
 * 
 * This module handles interactions with LLM APIs to analyze video content
 * and determine if it matches user interest keywords.
 */

// Configuration for the LLM API - we'll use a free API
const LLM_API_CONFIG = {
  // HuggingFace Inference API - offers free tier
  apiUrl: 'https://api-inference.huggingface.co/models/facebook/bart-large-mnli',
  headers: {
    'Authorization': 'Bearer hf_dummy_placeholder_key', // Users will need to replace with their free API key
    'Content-Type': 'application/json'
  },
  // OpenAI-compatible open source API alternative (free self-hosted option)
  // For users who want to self-host: https://github.com/xenova/transformers.js
  fallbackApiUrl: 'http://localhost:8080/v1/completions'
};

// Cache for API responses to reduce API calls
const responseCache = new Map();

/**
 * Check if a video is related to any of the user's interest keywords
 * 
 * @param {Object} videoData - Video data including title, description, etc.
 * @param {Array} interestKeywords - List of user's interest keywords
 * @param {Function} callback - Callback function with result (isRelated, matchedKeyword)
 */
function checkVideoRelevance(videoData, interestKeywords, callback) {
  if (!interestKeywords || interestKeywords.length === 0) {
    callback(false, null);
    return;
  }
  
  // First, do a basic keyword check without using the API
  const videoText = `${videoData.title} ${videoData.channelName} ${videoData.description || ''}`.toLowerCase();
  
  // Direct keyword matching
  for (const keyword of interestKeywords) {
    if (videoText.includes(keyword.toLowerCase())) {
      callback(true, keyword);
      return;
    }
  }
  
  // If no direct match, use the LLM API for semantic matching
  const cacheKey = `${videoData.videoId}:${interestKeywords.join(',')}`;
  
  // Check cache first to avoid redundant API calls
  if (responseCache.has(cacheKey)) {
    const cachedResult = responseCache.get(cacheKey);
    callback(cachedResult.isRelated, cachedResult.matchedKeyword);
    return;
  }
  
  // Prepare query for the LLM API
  const prompt = preparePrompt(videoData, interestKeywords);
  
  // Call the LLM API
  callLlmApi(prompt)
    .then(response => {
      // Process the response to determine relevance
      const result = processLlmResponse(response, interestKeywords);
      
      // Cache the result
      responseCache.set(cacheKey, result);
      
      // Return the result
      callback(result.isRelated, result.matchedKeyword);
    })
    .catch(error => {
      console.error('Error calling LLM API:', error);
      // Fall back to basic keyword matching
      callback(false, null);
    });
}

/**
 * Prepare a prompt for the LLM API
 */
function preparePrompt(videoData, interestKeywords) {
  // For HuggingFace's zero-shot classification
  return {
    inputs: `${videoData.title}. Channel: ${videoData.channelName}. ${videoData.description || ''}`,
    parameters: {
      candidate_labels: interestKeywords
    }
  };
  
  // Alternative for OpenAI-compatible APIs
  // return {
  //   prompt: `Video title: "${videoData.title}"\nChannel: "${videoData.channelName}"\nDescription: "${videoData.description || ''}"\n\nDetermine if this video is related to any of these topics: ${interestKeywords.join(', ')}. If yes, which topic?`,
  //   max_tokens: 50,
  //   temperature: 0.3
  // };
}

/**
 * Call the LLM API with the prepared prompt
 */
async function callLlmApi(prompt) {
  try {
    const response = await fetch(LLM_API_CONFIG.apiUrl, {
      method: 'POST',
      headers: LLM_API_CONFIG.headers,
      body: JSON.stringify(prompt)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error calling primary LLM API:', error);
    
    // Try fallback API if available
    if (LLM_API_CONFIG.fallbackApiUrl) {
      try {
        const fallbackResponse = await fetch(LLM_API_CONFIG.fallbackApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prompt)
        });
        
        if (!fallbackResponse.ok) {
          throw new Error(`Fallback API error: ${fallbackResponse.status}`);
        }
        
        return await fallbackResponse.json();
      } catch (fallbackError) {
        console.error('Error calling fallback LLM API:', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

/**
 * Process the response from the LLM API
 */
function processLlmResponse(response, interestKeywords) {
  try {
    // For HuggingFace zero-shot classification
    if (response.scores && response.labels) {
      // Find the highest scoring label
      const maxIndex = response.scores.indexOf(Math.max(...response.scores));
      const highestScore = response.scores[maxIndex];
      const matchedLabel = response.labels[maxIndex];
      
      // If the score is above threshold, consider it a match
      if (highestScore > 0.65) {
        return { isRelated: true, matchedKeyword: matchedLabel };
      }
    } 
    // For OpenAI-compatible API
    else if (response.choices && response.choices.length > 0) {
      const text = response.choices[0].text.toLowerCase();
      
      // Check if any keyword is mentioned in the response
      for (const keyword of interestKeywords) {
        if (text.includes(keyword.toLowerCase()) && 
            (text.includes('yes') || text.includes('related'))) {
          return { isRelated: true, matchedKeyword: keyword };
        }
      }
    }
    
    // No clear match found
    return { isRelated: false, matchedKeyword: null };
  } catch (error) {
    console.error('Error processing LLM response:', error);
    return { isRelated: false, matchedKeyword: null };
  }
}

/**
 * Extract video description from YouTube page
 * This is needed because YouTube doesn't always show the full description in the DOM
 */
function extractVideoDescription(videoId) {
  return new Promise((resolve) => {
    // Try to get description from the page first
    const descriptionElement = document.querySelector('#description-inline-expander, .ytd-expandable-video-description-body-renderer');
    if (descriptionElement) {
      resolve(descriptionElement.textContent.trim());
      return;
    }
    
    // If not found in DOM, try to get from YouTube Data API
    // Note: This is a fallback but requires an API key
    // For a free alternative, we'll just resolve with an empty string
    resolve('');
  });
}

// Export the functions if in a module context
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkVideoRelevance,
    extractVideoDescription
  };
}
