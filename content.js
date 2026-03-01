// Content Script - Keyword filtering with error handling and debounced scanning
let config = null;
let debounceTimer = null;
let observer = null;

// Initialize with error handling
(async () => {
  try {
    // Safety check - don't run on blocked page
    if (window.location.pathname.includes('blocked.html')) {
      return;
    }
    
    // Get current configuration
    const response = await sendMessageSafely({ type: 'getConfig' });
    config = response.config;
    
    if (!config || !config.keywordFiltering || !config.keywordFiltering.enabled) {
      return;
    }
    
    if (config.keywordFiltering.keywords.length === 0) {
      return;
    }
    
    // Check if we're currently restricted
    const restrictionCheck = await sendMessageSafely({
      type: 'isCurrentlyRestricted',
      config: config
    });
    
    if (!restrictionCheck.success || !restrictionCheck.restricted) {
      // Only run keyword check during restricted hours
      return;
    }
    
    console.log('[KeywordFilter] Keyword filtering enabled, scanning page');
    
    // FIX: Debounce keyword scanning to improve performance
    // Scan immediately once, then watch for content changes with debouncing
    scanPageForKeywords();
    setupDebouncedScanning();
  } catch (error) {
    console.error('Content script initialization error:', error);
  }
})();

/**
 * Setup debounced scanning for dynamically loaded content
 */
function setupDebouncedScanning() {
  try {
    // Create MutationObserver to watch for DOM changes
    observer = new MutationObserver(() => {
      // Debounce: clear previous timer and set new one
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[KeywordFilter] Page content changed, rescanning...');
        scanPageForKeywords();
      }, 500); // Wait 500ms after DOM changes stop before scanning
    });
    
    // Watch for changes to body and subtree
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: false // Ignore text changes, only child additions/removals
      });
      console.log('[KeywordFilter] MutationObserver started, watching for content changes');
    }
  } catch (error) {
    console.error('[KeywordFilter] Error setting up debounced scanning:', error);
  }
}

/**
 * Scan page for blocked keywords
 */
function scanPageForKeywords() {
  try {
    if (!document.body) {
      setTimeout(scanPageForKeywords, 100);
      return;
    }
    
    // Get visible page text with character limit
    const pageText = getPageText().toLowerCase();
    
    if (!pageText || pageText.length === 0) {
      return;
    }
    
    // Check for blocked keywords
    for (const keyword of config.keywordFiltering.keywords) {
      const cleanKeyword = keyword.toLowerCase().trim();
      
      if (!cleanKeyword) {
        continue;
      }
      
      // Use word boundaries for matching
      const regex = new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      
      if (regex.test(pageText)) {
        console.log(`[KeywordFilter] Blocked keyword found: '${keyword}'`);
        blockPage(keyword);
        return;
      }
    }
    
    console.log('[KeywordFilter] No blocked keywords found on page');
  } catch (error) {
    console.error('Error scanning page for keywords:', error);
  }
}

/**
 * Extract page text safely with limits
 */
function getPageText() {
  try {
    // Limit text to first 100KB to avoid performance issues
    const text = document.body.innerText || '';
    return text.substring(0, 100000);
  } catch (error) {
    console.error('Error getting page text:', error);
    return '';
  }
}

/**
 * Block page and redirect to blocked page
 */
function blockPage(keyword) {
  try {
    chrome.runtime.sendMessage({
      type: 'logBlockedAttempt',
      url: window.location.href,
      reason: 'keyword_filtered'
    }, () => {
      // Ignore errors
    });
    
    window.location.href = chrome.runtime.getURL(
      'blocked.html?reason=keyword_filtered&keyword=' + encodeURIComponent(keyword)
    );
  } catch (error) {
    console.error('Error blocking page:', error);
  }
}

/**
 * Send message safely with timeout
 */
function sendMessageSafely(message) {
  return new Promise((resolve) => {
    try {
      const timeoutId = setTimeout(() => {
        resolve({ success: false, error: 'Message timeout' });
      }, 5000);
      
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        resolve(response || { success: false, error: 'No response' });
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
}
