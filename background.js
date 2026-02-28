// Parental Control Extension - Background Service Worker

// Import scripts (load in order of dependencies)
importScripts('cacheManager.js');
importScripts('securityHelper.js');
importScripts('configValidator.js');
importScripts('analyticsManager.js');
importScripts('storageManager.js');
importScripts('rulesEngine.js');

// Initialize managers with error handling
let storageManager, rulesEngine, analyticsManager, messageRateLimiter, cacheManager;

try {
  console.log('Creating CacheManager...');
  cacheManager = new CacheManager();
  console.log('CacheManager created');
} catch (error) {
  console.error('Failed to create CacheManager:', error);
  cacheManager = null;
}

try {
  console.log('Creating StorageManager...');
  storageManager = new StorageManager();
  console.log('StorageManager created');
} catch (error) {
  console.error('Failed to create StorageManager:', error);
  storageManager = null;
}

try {
  console.log('Creating RulesEngine...');
  rulesEngine = new RulesEngine();
  console.log('RulesEngine created');
} catch (error) {
  console.error('Failed to create RulesEngine:', error);
  rulesEngine = null;
}

try {
  console.log('Creating AnalyticsManager...');
  analyticsManager = new AnalyticsManager();
  console.log('AnalyticsManager created');
} catch (error) {
  console.error('Failed to create AnalyticsManager:', error);
  analyticsManager = null;
}

try {
  console.log('Creating messageRateLimiter...');
  if (typeof SecurityHelper !== 'undefined' && SecurityHelper.createRateLimiter) {
    messageRateLimiter = SecurityHelper.createRateLimiter(100, 60000);
    console.log('messageRateLimiter created');
  } else {
    console.error('SecurityHelper not available');
    messageRateLimiter = null;
  }
} catch (error) {
  console.error('Failed to create messageRateLimiter:', error);
  messageRateLimiter = null;
}

console.log('Background service worker initialized');

// Initialize extension on install or startup
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === 'install') {
      // First install - open setup page
      if (analyticsManager && analyticsManager.trackEvent) {
        await analyticsManager.trackEvent('extension_installed');
      }
      chrome.runtime.openOptionsPage();
      // Update rules in background (non-blocking)
      if (typeof updateRules === 'function') {
        updateRules().catch(error => {
          console.error('Failed to update rules on install:', error);
        });
      }
    } else if (details.reason === 'update') {
      // Update - ensure rules are current
      if (analyticsManager && analyticsManager.trackEvent) {
        await analyticsManager.trackEvent('extension_updated');
      }
      // Update rules in background (non-blocking)
      if (typeof updateRules === 'function') {
        updateRules().catch(error => {
          console.error('Failed to update rules on update:', error);
        });
      }
    }
  } catch (error) {
    console.error('Error during extension installation:', error);
  }
});

// Listen for storage changes and update rules
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  try {
    if (areaName === 'local' && 'config' in changes) {
      if (typeof updateRules === 'function') {
        await updateRules();
      }
    }
  } catch (error) {
    console.error('Error handling storage changes:', error);
  }
});

/**
 * Update rules with caching and error handling
 */
async function updateRules() {
  try {
    // Check if required modules are initialized
    if (!storageManager || !rulesEngine || !cacheManager) {
      console.error('Required modules not initialized for rule update');
      return;
    }
    
    const config = await withRetry(() => storageManager.getConfig(), 3);
    
    // Check cache first
    const cacheKey = JSON.stringify(config);
    const cachedRules = cacheManager.get('generated_rules');
    
    if (cachedRules) {
      // Use cached rules if available
      await applyRules(cachedRules);
      return;
    }
    
    // Generate new rules
    const rules = await rulesEngine.generateRules(config);
    
    // Cache the rules
    cacheManager.set('generated_rules', rules, 5 * 60 * 1000); // 5 minute cache
    
    // Apply rules
    await applyRules(rules);
    
    chrome.storage.local.set({ 
      lastRuleUpdate: new Date().toISOString(),
      ruleCount: rules.length 
    });
  } catch (error) {
    console.error('Error updating rules:', error);
    await reportError('Rule update failed', error);
  }
}

/**
 * Apply rules with error handling
 */
async function applyRules(rules) {
  try {
    // Get existing rule IDs
    const existingRules = await chrome.declarativeNetRequest.getSessionRules();
    const existingIds = existingRules.map(rule => rule.id);
    
    // Remove old rules
    if (existingIds.length > 0) {
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: existingIds
      });
    }
    
    // Add new rules
    if (rules.length > 0) {
      // Split into chunks if too many rules
      const chunkSize = 100;
      for (let i = 0; i < rules.length; i += chunkSize) {
        const chunk = rules.slice(i, i + chunkSize);
        await chrome.declarativeNetRequest.updateSessionRules({
          addRules: chunk
        });
      }
    }
  } catch (error) {
    console.error('Error applying rules:', error);
    throw error;
  }
}

// Check and update rules periodically (every minute)
// Delay initial execution to allow modules to initialize
if (typeof updateRules === 'function') {
  setTimeout(() => {
    setInterval(() => {
      if (typeof updateRules === 'function') {
        updateRules().catch(error => {
          console.error('Error in periodic rule update:', error);
        });
      }
    }, 60000);
  }, 5000); // 5 second delay before first check
}

/**
 * Handle messages from popup and content scripts with validation
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Check if modules are initialized
    if (!storageManager || !rulesEngine || !analyticsManager) {
      console.error('One or more modules not initialized');
      sendResponse({ success: false, error: 'Extension not fully initialized' });
      return true;
    }
    
    // Validate sender
    if (SecurityHelper && !SecurityHelper.isValidMessageSender(sender)) {
      sendResponse({ success: false, error: 'Invalid sender' });
      return true;
    }
    
    // Rate limiting (if available)
    if (messageRateLimiter && !messageRateLimiter.check('message_' + sender.url)) {
      sendResponse({ success: false, error: 'Rate limited' });
      return true;
    }
    
    handleMessage(message, sender, sendResponse);
  } catch (error) {
    console.error('Error in message listener:', error);
    sendResponse({ success: false, error: 'Message listener error: ' + error.message });
  }
  return true; // Keep channel open for async response
});

/**
 * Handle different message types with comprehensive error handling
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    // Validate message structure
    if (!message || typeof message !== 'object' || !message.type) {
      sendResponse({ success: false, error: 'Invalid message format' });
      return;
    }
    
    switch (message.type) {
      case 'getConfig':
        await handleGetConfig(sendResponse);
        break;
      
      case 'saveConfig':
        await handleSaveConfig(message, sendResponse);
        break;
      
      case 'logBlockedAttempt':
        await handleLogBlockedAttempt(message, sendResponse);
        break;
      
      case 'isCurrentlyRestricted':
        await handleIsCurrentlyRestricted(message, sendResponse);
        break;
      
      case 'verifyPassword':
        await handleVerifyPassword(message, sendResponse);
        break;
      
      case 'setPassword':
        await handleSetPassword(message, sendResponse);
        break;
      
      case 'exportConfig':
        await handleExportConfig(sendResponse);
        break;
      
      case 'importConfig':
        await handleImportConfig(message, sendResponse);
        break;
      
      case 'getAnalytics':
        await handleGetAnalytics(message, sendResponse);
        break;
      
      default:
        sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ 
      success: false, 
      error: 'Message handler error: ' + error.message 
    });
  }
}

async function handleGetConfig(sendResponse) {
  try {
    // Verify storageManager is available
    if (!storageManager) {
      console.error('StorageManager not initialized');
      sendResponse({ success: false, error: 'StorageManager not available' });
      return;
    }
    
    const config = await storageManager.getConfig();
    if (!config) {
      console.error('Config is null or undefined');
      sendResponse({ success: true, config: storageManager.getDefaultConfig() });
      return;
    }
    
    sendResponse({ success: true, config });
  } catch (error) {
    console.error('Error in handleGetConfig:', error);
    // Return default config on error for better UX
    try {
      const defaultConfig = storageManager.getDefaultConfig();
      sendResponse({ success: true, config: defaultConfig });
    } catch (fallbackError) {
      sendResponse({ success: false, error: error.message || 'Failed to load configuration' });
    }
  }
}

async function handleSaveConfig(message, sendResponse) {
  try {
    if (!SecurityHelper.validateMessage(message, ['config'])) {
      sendResponse({ success: false, error: 'Invalid save config message' });
      return;
    }
    
    await storageManager.saveConfig(message.config);
    await analyticsManager.trackEvent('config_saved');
    await updateRules();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleLogBlockedAttempt(message, sendResponse) {
  try {
    if (!SecurityHelper.validateMessage(message, ['url', 'reason'])) {
      sendResponse({ success: false, error: 'Invalid log message' });
      return;
    }
    
    await storageManager.logBlockedAttempt(message.url, message.reason);
    await analyticsManager.trackBlockedAttempt(message.url, message.reason);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleIsCurrentlyRestricted(message, sendResponse) {
  try {
    if (!SecurityHelper.validateMessage(message, ['config'])) {
      sendResponse({ success: false, error: 'Invalid restriction check message' });
      return;
    }
    
    const restricted = rulesEngine.isCurrentlyRestricted(message.config);
    sendResponse({ success: true, restricted });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleVerifyPassword(message, sendResponse) {
  try {
    if (!SecurityHelper.validateMessage(message, ['password'])) {
      sendResponse({ success: false, error: 'Invalid password message' });
      return;
    }
    
    const isValid = await storageManager.verifyPassword(message.password);
    await analyticsManager.trackPasswordAttempt(isValid);
    sendResponse({ success: true, isValid });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSetPassword(message, sendResponse) {
  try {
    if (!SecurityHelper.validateMessage(message, ['password'])) {
      sendResponse({ success: false, error: 'Invalid set password message' });
      return;
    }
    
    await storageManager.setPassword(message.password);
    await analyticsManager.trackEvent('password_changed');
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleExportConfig(sendResponse) {
  try {
    const backup = await storageManager.exportConfig();
    await analyticsManager.trackEvent('config_exported');
    sendResponse({ success: true, backup });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleImportConfig(message, sendResponse) {
  try {
    if (!SecurityHelper.validateMessage(message, ['backup'])) {
      sendResponse({ success: false, error: 'Invalid import message' });
      return;
    }
    
    await storageManager.importConfig(message.backup);
    await analyticsManager.trackEvent('config_imported');
    await updateRules();
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGetAnalytics(message, sendResponse) {
  try {
    const days = message.days || 7;
    const report = await analyticsManager.generateUsageReport(days);
    sendResponse({ success: true, report });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Retry operation with exponential backoff
 */
async function withRetry(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Report error for debugging
 */
async function reportError(context, error) {
  try {
    if (analyticsManager && analyticsManager.trackEvent) {
      await analyticsManager.trackEvent('error', {
        context: context,
        message: error.message,
        stack: error.stack
      });
    } else {
      console.error('AnalyticsManager not available to report error');
    }
  } catch (e) {
    console.error('Failed to report error:', e);
  }
}
