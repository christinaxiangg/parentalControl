// Parental Control Extension - Background Service Worker

// Import scripts (load in order of dependencies)
importScripts('cacheManager.js');
importScripts('securityHelper.js');
importScripts('configValidator.js');
importScripts('analyticsManager.js');
importScripts('storageManager.js');
importScripts('rulesEngine.js');

// Initialization state tracking (FIX: Critical fix for race condition)
let initializationComplete = false;
let initializationPromise = null;
let initializationStartTime = Date.now();

// Initialize managers with error handling
let storageManager, rulesEngine, analyticsManager, messageRateLimiter, cacheManager;

// Create initialization promise to prevent race conditions
initializationPromise = (async () => {
  try {
    console.log('[Init] Starting background service worker initialization...');
    
    // FIX #1: Add timeout for initialization
    const initTimeout = setTimeout(() => {
      console.error('[Init] Initialization timeout after 30 seconds');
      initializationComplete = true; // Mark as complete even on timeout to prevent hanging
    }, 30000);
    
    console.log('[Init] Creating CacheManager...');
    try {
      cacheManager = new CacheManager();
      console.log('[Init] CacheManager created successfully');
    } catch (error) {
      console.error('[Init] Failed to create CacheManager:', error);
      cacheManager = null;
    }

    console.log('[Init] Creating StorageManager...');
    try {
      storageManager = new StorageManager();
      console.log('[Init] StorageManager created successfully');
    } catch (error) {
      console.error('[Init] Failed to create StorageManager:', error);
      storageManager = null;
    }

    console.log('[Init] Creating RulesEngine...');
    try {
      rulesEngine = new RulesEngine();
      console.log('[Init] RulesEngine created successfully');
    } catch (error) {
      console.error('[Init] Failed to create RulesEngine:', error);
      rulesEngine = null;
    }

    console.log('[Init] Creating AnalyticsManager...');
    try {
      analyticsManager = new AnalyticsManager();
      console.log('[Init] AnalyticsManager created successfully');
    } catch (error) {
      console.error('[Init] Failed to create AnalyticsManager:', error);
      analyticsManager = null;
    }

    // Create rate limiter if SecurityHelper is available
    console.log('[Init] Creating message rate limiter...');
    try {
      if (typeof SecurityHelper !== 'undefined' && SecurityHelper.createRateLimiter) {
        messageRateLimiter = SecurityHelper.createRateLimiter(100, 60000);
        console.log('[Init] Message rate limiter created successfully');
      } else {
        console.warn('[Init] SecurityHelper not available for rate limiting');
        messageRateLimiter = null;
      }
    } catch (error) {
      console.error('[Init] Failed to create message rate limiter:', error);
      messageRateLimiter = null;
    }
    
    clearTimeout(initTimeout);
    initializationComplete = true;
    console.log('[Init] Background service worker initialization completed successfully');
    console.log('[Init] Total initialization time:', Date.now() - initializationStartTime, 'ms');
    
  } catch (error) {
    console.error('[Init] Critical error during initialization:', error);
    initializationComplete = true; // Prevent hanging
  }
})();

/**
 * Wait for module initialization to complete
 * FIX: Critical fix - prevents race conditions in updateRules()
 */
async function waitForInitialization() {
  const maxWait = 10000; // 10 seconds timeout
  const startTime = Date.now();
  
  while (!initializationComplete && (Date.now() - startTime) < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (!initializationComplete) {
    throw new Error('Module initialization timeout (10s exceeded)');
  }
}

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
 * FIX: Now waits for initialization to prevent race conditions
 */
async function updateRules() {
  try {
    // FIX: Critical - Wait for all modules to be initialized before proceeding
    await waitForInitialization();
    
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
 * Check if critical modules are initialized with detailed reporting
 */
function areModulesReady() {
  const modules = {
    storageManager: typeof storageManager !== 'undefined',
    rulesEngine: typeof rulesEngine !== 'undefined',
    analyticsManager: typeof analyticsManager !== 'undefined',
    securityHelper: typeof SecurityHelper !== 'undefined'
  };
  
  const missingModules = Object.keys(modules).filter(name => !modules[name]);
  
  if (missingModules.length > 0) {
    console.warn('[ErrorBoundary] Missing modules:', missingModules.join(', '));
    return { ready: false, missing: missingModules };
  }
  
  return { ready: true, missing: [] };
}

/**
 * Handle messages from popup and content scripts with comprehensive error boundary
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Check module initialization status before processing
    const moduleStatus = areModulesReady();
    if (!moduleStatus.ready) {
      console.error('[ErrorBoundary] Cannot process message, modules not ready:', moduleStatus.missing.join(', '));
      sendResponse({ 
        success: false, 
        error: 'Extension initializing - please try again in a moment' 
      });
      return true;
    }
    
    // Validate sender if SecurityHelper is available
    if (typeof SecurityHelper !== 'undefined' && !SecurityHelper.isValidMessageSender(sender)) {
      console.warn('[ErrorBoundary] Invalid message sender rejected:', sender.url);
      sendResponse({ success: false, error: 'Invalid sender' });
      return true;
    }
    
    // Rate limiting (if available)
    if (typeof messageRateLimiter !== 'undefined' && !messageRateLimiter.check('message_' + (sender.url || 'unknown'))) {
      console.warn('[ErrorBoundary] Message rate limited from:', sender.url);
      sendResponse({ success: false, error: 'Rate limited' });
      return true;
    }
    
    handleMessage(message, sender, sendResponse);
  } catch (error) {
    console.error('[ErrorBoundary] Error in message listener:', error);
    // Always respond, even with error
    try {
      sendResponse({ success: false, error: 'Message listener error: ' + (error.message || 'Unknown error') });
    } catch (responseError) {
      console.error('[ErrorBoundary] Failed to send error response:', responseError);
    }
  }
  return true; // Keep channel open for async response
});

/**
 * Handle different message types with comprehensive error handling and null checks
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    // Validate message structure
    if (!message || typeof message !== 'object' || !message.type) {
      console.warn('[ErrorBoundary] Invalid message format received');
      sendResponse({ success: false, error: 'Invalid message format' });
      return;
    }
    
    // FIX: Add comprehensive error boundaries for all message types
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
        console.warn('[ErrorBoundary] Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error handling message type:', message?.type, error);
    // Always respond with error
    try {
      sendResponse({ 
        success: false, 
        error: 'Message handler error: ' + (error.message || 'Unknown error') 
      });
    } catch (responseError) {
      console.error('[ErrorBoundary] Failed to send handler error response:', responseError);
    }
  }
}

/**
 * Handle getConfig with enhanced error handling and fallbacks
 */
async function handleGetConfig(sendResponse) {
  try {
    console.log('[Handle] Processing getConfig request');
    
    // FIX #2: Wait for initialization with timeout
    if (!initializationComplete) {
      console.warn('[Handle] Service worker still initializing, waiting...');
      const maxWaitTime = 15000; // 15 seconds
      const startTime = Date.now();
      
      while (!initializationComplete && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!initializationComplete) {
        console.error('[Handle] Initialization timeout - returning default config');
        sendResponse({ 
          success: true, 
          config: getDefaultConfigFallback(),
          warning: 'Service worker initialization timeout - using default configuration'
        });
        return;
      }
    }
    
    // FIX #3: Add comprehensive null checks
    if (!storageManager) {
      console.error('[Handle] StorageManager not available - returning default config');
      sendResponse({ 
        success: true, 
        config: getDefaultConfigFallback(),
        warning: 'StorageManager unavailable - using default configuration'
      });
      return;
    }
    
    try {
      const config = await storageManager.getConfig();
      console.log('[Handle] Retrieved config from storage');
      
      if (!config) {
        console.warn('[Handle] Config is null/undefined - returning default');
        const defaultConfig = storageManager.getDefaultConfig ? 
          storageManager.getDefaultConfig() : 
          getDefaultConfigFallback();
        sendResponse({ 
          success: true, 
          config: defaultConfig,
          warning: 'Using default configuration'
        });
        return;
      }
      
      sendResponse({ success: true, config });
      console.log('[Handle] Successfully sent configuration response');
      
    } catch (storageError) {
      console.error('[Handle] StorageManager.getConfig failed:', storageError);
      // Fallback to default config
      try {
        const defaultConfig = storageManager.getDefaultConfig ? 
          storageManager.getDefaultConfig() : 
          getDefaultConfigFallback();
        sendResponse({ 
          success: true, 
          config: defaultConfig,
          warning: 'Using default configuration due to storage error'
        });
      } catch (fallbackError) {
        console.error('[Handle] Failed to get default config:', fallbackError);
        sendResponse({ 
          success: false, 
          error: 'Failed to load configuration: ' + (storageError.message || 'Unknown error') 
        });
      }
    }
  } catch (error) {
    console.error('[Handle] Error in handleGetConfig:', error);
    sendResponse({ 
      success: false, 
      error: 'GetConfig error: ' + (error.message || 'Unknown error') 
    });
  }
}

/**
 * Default configuration fallback (used when StorageManager is unavailable)
 */
function getDefaultConfigFallback() {
  console.log('[Fallback] Returning default configuration');
  return {
    blockList: [],
    alwaysAllowedList: [],
    schedules: [],
    keywordFiltering: {
      enabled: false,
      keywords: []
    },
    logging: {
      enabled: true,
      maxEntries: 1000
    },
    passwordProtected: false,
    version: '2.0'
  };
}

async function handleSaveConfig(message, sendResponse) {
  try {
    // FIX: Add comprehensive null checks and error handling
    if (typeof storageManager === 'undefined' || !storageManager) {
      console.error('[ErrorBoundary] StorageManager not initialized for saveConfig');
      sendResponse({ success: false, error: 'StorageManager not available' });
      return;
    }
    
    // Validate message structure
    if (!message.config || typeof message.config !== 'object') {
      console.warn('[ErrorBoundary] Invalid config in saveConfig message');
      sendResponse({ success: false, error: 'Invalid configuration format' });
      return;
    }
    
    // Validate message with SecurityHelper if available
    if (typeof SecurityHelper !== 'undefined' && SecurityHelper.validateMessage) {
      if (!SecurityHelper.validateMessage(message, ['config'])) {
        console.warn('[ErrorBoundary] Security validation failed for saveConfig');
        sendResponse({ success: false, error: 'Invalid save config message' });
        return;
      }
    }
    
    try {
      await storageManager.saveConfig(message.config);
      
      // Track event if available
      if (typeof analyticsManager !== 'undefined' && analyticsManager.trackEvent) {
        analyticsManager.trackEvent('config_saved').catch(err => {
          console.warn('[ErrorBoundary] Failed to track config_saved event:', err);
        });
      }
      
      // Update rules if available
      if (typeof updateRules === 'function') {
        updateRules().catch(err => {
          console.error('[ErrorBoundary] Failed to update rules after config save:', err);
        });
      }
      
      sendResponse({ success: true });
    } catch (storageError) {
      console.error('[ErrorBoundary] Failed to save config:', storageError);
      sendResponse({ success: false, error: 'Failed to save configuration: ' + (storageError.message || 'Unknown error') });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleSaveConfig:', error);
    sendResponse({ success: false, error: 'SaveConfig error: ' + (error.message || 'Unknown error') });
  }
}

async function handleIsCurrentlyRestricted(message, sendResponse) {
  try {
    // FIX: Add null check for rulesEngine
    if (typeof rulesEngine === 'undefined' || !rulesEngine) {
      console.error('[ErrorBoundary] RulesEngine not initialized for isCurrentlyRestricted');
      sendResponse({ success: false, error: 'RulesEngine not available' });
      return;
    }
    
    // Validate message
    if (!message.config || typeof message.config !== 'object') {
      console.warn('[ErrorBoundary] Invalid config in isCurrentlyRestricted message');
      sendResponse({ success: false, error: 'Invalid configuration format' });
      return;
    }
    
    try {
      const restricted = rulesEngine.isCurrentlyRestricted(message.config);
      sendResponse({ success: true, restricted });
    } catch (engineError) {
      console.error('[ErrorBoundary] RulesEngine.isCurrentlyRestricted failed:', engineError);
      sendResponse({ success: false, error: 'Restriction check failed: ' + (engineError.message || 'Unknown error') });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleIsCurrentlyRestricted:', error);
    sendResponse({ success: false, error: 'Restriction check error: ' + (error.message || 'Unknown error') });
  }
}

async function handleVerifyPassword(message, sendResponse) {
  try {
    // FIX: Add null check for storageManager
    if (typeof storageManager === 'undefined' || !storageManager) {
      console.error('[ErrorBoundary] StorageManager not initialized for verifyPassword');
      sendResponse({ success: false, error: 'StorageManager not available' });
      return;
    }
    
    // Validate message
    if (!message.password || typeof message.password !== 'string') {
      console.warn('[ErrorBoundary] Invalid password in verifyPassword message');
      sendResponse({ success: false, error: 'Invalid password format' });
      return;
    }
    
    // Validate with SecurityHelper if available
    if (typeof SecurityHelper !== 'undefined' && SecurityHelper.validateMessage) {
      if (!SecurityHelper.validateMessage(message, ['password'])) {
        console.warn('[ErrorBoundary] Security validation failed for verifyPassword');
        sendResponse({ success: false, error: 'Invalid password message' });
        return;
      }
    }
    
    try {
      const isValid = await storageManager.verifyPassword(message.password);
      
      // Track event if available
      if (typeof analyticsManager !== 'undefined' && analyticsManager.trackPasswordAttempt) {
        analyticsManager.trackPasswordAttempt(isValid).catch(err => {
          console.warn('[ErrorBoundary] Failed to track password attempt:', err);
        });
      }
      
      sendResponse({ success: true, isValid });
    } catch (storageError) {
      console.error('[ErrorBoundary] Password verification failed:', storageError);
      sendResponse({ success: false, error: 'Password verification failed' });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleVerifyPassword:', error);
    sendResponse({ success: false, error: 'Password verification error: ' + (error.message || 'Unknown error') });
  }
}

async function handleSetPassword(message, sendResponse) {
  try {
    if (typeof storageManager === 'undefined' || !storageManager) {
      console.error('[ErrorBoundary] StorageManager not initialized for setPassword');
      sendResponse({ success: false, error: 'StorageManager not available' });
      return;
    }
    
    if (!message.password || typeof message.password !== 'string') {
      console.warn('[ErrorBoundary] Invalid password in setPassword message');
      sendResponse({ success: false, error: 'Invalid password format' });
      return;
    }
    
    if (typeof SecurityHelper !== 'undefined' && SecurityHelper.validateMessage) {
      if (!SecurityHelper.validateMessage(message, ['password'])) {
        console.warn('[ErrorBoundary] Security validation failed for setPassword');
        sendResponse({ success: false, error: 'Invalid set password message' });
        return;
      }
    }
    
    try {
      await storageManager.setPassword(message.password);
      
      if (typeof analyticsManager !== 'undefined' && analyticsManager.trackEvent) {
        analyticsManager.trackEvent('password_changed').catch(err => {
          console.warn('[ErrorBoundary] Failed to track password_changed event:', err);
        });
      }
      
      sendResponse({ success: true });
    } catch (storageError) {
      console.error('[ErrorBoundary] Failed to set password:', storageError);
      sendResponse({ success: false, error: 'Failed to set password' });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleSetPassword:', error);
    sendResponse({ success: false, error: 'SetPassword error: ' + (error.message || 'Unknown error') });
  }
}

async function handleLogBlockedAttempt(message, sendResponse) {
  try {
    if (typeof storageManager === 'undefined' || !storageManager) {
      console.error('[ErrorBoundary] StorageManager not initialized for logBlockedAttempt');
      sendResponse({ success: false, error: 'StorageManager not available' });
      return;
    }
    
    if (!message.url || typeof message.url !== 'string' || !message.reason || typeof message.reason !== 'string') {
      console.warn('[ErrorBoundary] Invalid parameters in logBlockedAttempt message');
      sendResponse({ success: false, error: 'Invalid log message format' });
      return;
    }
    
    if (typeof SecurityHelper !== 'undefined' && SecurityHelper.validateMessage) {
      if (!SecurityHelper.validateMessage(message, ['url', 'reason'])) {
        console.warn('[ErrorBoundary] Security validation failed for logBlockedAttempt');
        sendResponse({ success: false, error: 'Invalid log message' });
        return;
      }
    }
    
    try {
      await storageManager.logBlockedAttempt(message.url, message.reason);
      
      if (typeof analyticsManager !== 'undefined' && analyticsManager.trackBlockedAttempt) {
        analyticsManager.trackBlockedAttempt(message.url, message.reason).catch(err => {
          console.warn('[ErrorBoundary] Failed to track blocked attempt:', err);
        });
      }
      
      sendResponse({ success: true });
    } catch (storageError) {
      console.error('[ErrorBoundary] Failed to log blocked attempt:', storageError);
      sendResponse({ success: false, error: 'Failed to log blocked attempt' });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleLogBlockedAttempt:', error);
    sendResponse({ success: false, error: 'LogBlockedAttempt error: ' + (error.message || 'Unknown error') });
  }
}

async function handleExportConfig(sendResponse) {
  try {
    if (typeof storageManager === 'undefined' || !storageManager) {
      console.error('[ErrorBoundary] StorageManager not initialized for exportConfig');
      sendResponse({ success: false, error: 'StorageManager not available' });
      return;
    }
    
    try {
      const backup = await storageManager.exportConfig();
      
      if (typeof analyticsManager !== 'undefined' && analyticsManager.trackEvent) {
        analyticsManager.trackEvent('config_exported').catch(err => {
          console.warn('[ErrorBoundary] Failed to track config_exported event:', err);
        });
      }
      
      sendResponse({ success: true, backup });
    } catch (storageError) {
      console.error('[ErrorBoundary] Failed to export config:', storageError);
      sendResponse({ success: false, error: 'Failed to export configuration' });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleExportConfig:', error);
    sendResponse({ success: false, error: 'ExportConfig error: ' + (error.message || 'Unknown error') });
  }
}

async function handleImportConfig(message, sendResponse) {
  try {
    if (typeof storageManager === 'undefined' || !storageManager) {
      console.error('[ErrorBoundary] StorageManager not initialized for importConfig');
      sendResponse({ success: false, error: 'StorageManager not available' });
      return;
    }
    
    if (!message.backup || typeof message.backup !== 'object') {
      console.warn('[ErrorBoundary] Invalid backup in importConfig message');
      sendResponse({ success: false, error: 'Invalid backup format' });
      return;
    }
    
    if (typeof SecurityHelper !== 'undefined' && SecurityHelper.validateMessage) {
      if (!SecurityHelper.validateMessage(message, ['backup'])) {
        console.warn('[ErrorBoundary] Security validation failed for importConfig');
        sendResponse({ success: false, error: 'Invalid import message' });
        return;
      }
    }
    
    try {
      await storageManager.importConfig(message.backup);
      
      if (typeof analyticsManager !== 'undefined' && analyticsManager.trackEvent) {
        analyticsManager.trackEvent('config_imported').catch(err => {
          console.warn('[ErrorBoundary] Failed to track config_imported event:', err);
        });
      }
      
      if (typeof updateRules === 'function') {
        updateRules().catch(err => {
          console.error('[ErrorBoundary] Failed to update rules after config import:', err);
        });
      }
      
      sendResponse({ success: true });
    } catch (storageError) {
      console.error('[ErrorBoundary] Failed to import config:', storageError);
      sendResponse({ success: false, error: 'Failed to import configuration: ' + (storageError.message || 'Unknown error') });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleImportConfig:', error);
    sendResponse({ success: false, error: 'ImportConfig error: ' + (error.message || 'Unknown error') });
  }
}

async function handleGetAnalytics(message, sendResponse) {
  try {
    if (typeof analyticsManager === 'undefined' || !analyticsManager) {
      console.error('[ErrorBoundary] AnalyticsManager not initialized for getAnalytics');
      sendResponse({ success: false, error: 'AnalyticsManager not available' });
      return;
    }
    
    try {
      const days = message.days || 7;
      if (typeof days !== 'number' || days < 1) {
        console.warn('[ErrorBoundary] Invalid days parameter in getAnalytics');
        sendResponse({ success: false, error: 'Invalid days parameter' });
        return;
      }
      
      const report = await analyticsManager.generateUsageReport(days);
      sendResponse({ success: true, report });
    } catch (analyticsError) {
      console.error('[ErrorBoundary] Failed to generate analytics report:', analyticsError);
      sendResponse({ success: false, error: 'Failed to generate analytics report' });
    }
  } catch (error) {
    console.error('[ErrorBoundary] Error in handleGetAnalytics:', error);
    sendResponse({ success: false, error: 'GetAnalytics error: ' + (error.message || 'Unknown error') });
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
