// Options Page Script
let currentConfig = null;
let isUnlocked = false;

document.addEventListener('DOMContentLoaded', initializeOptions);

async function initializeOptions() {
  try {
    console.log('initializeOptions called');
    // Check if password is set
    const passwordSet = await isPasswordSet();
    console.log('Password set:', passwordSet);
    
    if (passwordSet && !isUnlocked) {
      console.log('Showing password check');
      showPasswordCheck();
      addPasswordCheckListeners();
    } else {
      console.log('Unlocking and loading configuration');
      isUnlocked = true;
      const settingsContent = document.getElementById('settingsContent');
      if (settingsContent) {
        settingsContent.classList.remove('hidden');
      } else {
        console.warn('settingsContent element not found');
      }
      await loadConfiguration();
      addEventListeners();
      console.log('initializeOptions completed successfully');
    }
  } catch (error) {
    console.error('Error in initializeOptions:', error);
    showError('Failed to initialize settings: ' + error.message);
  }
}

/**
 * Show password check UI
 */
function showPasswordCheck() {
  document.getElementById('passwordCheck').classList.add('show');
  document.getElementById('settingsContent').classList.add('hidden');
}

/**
 * Add listeners for password check
 */
function addPasswordCheckListeners() {
  try {
    const unlockBtn = document.getElementById('unlockBtn');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', verifyAccess);
    }
    
    const accessPassword = document.getElementById('accessPassword');
    if (accessPassword) {
      accessPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') verifyAccess();
      });
    }
  } catch (error) {
    console.error('Error adding password check listeners:', error);
  }
}

/**
 * Verify password access
 */
async function verifyAccess() {
  const password = document.getElementById('accessPassword').value;
  
  if (!password) {
    showWarning('Please enter a password');
    return;
  }
  
  try {
    const response = await sendMessage({
      type: 'verifyPassword',
      password: password
    });
    
    if (response.success && response.isValid) {
      isUnlocked = true;
      document.getElementById('passwordCheck').classList.remove('show');
      document.getElementById('settingsContent').classList.remove('hidden');
      await loadConfiguration();
      addEventListeners();
      showSuccess('Access granted');
    } else {
      showError('Invalid password');
      document.getElementById('accessPassword').value = '';
    }
  } catch (error) {
    showError('Error verifying password: ' + error.message);
  }
}

/**
 * Enhanced loadConfiguration with better error handling
 */
async function loadConfiguration() {
  try {
    console.log('loadConfiguration called');
    
    // FIX #5: Add timeout to prevent hanging
    const response = await Promise.race([
      sendMessage({ type: 'getConfig' }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Configuration load timeout')), 10000)
      )
    ]);
    
    console.log('getConfig response:', response);
    
    if (!response.success) {
      console.error('Failed to load configuration:', response.error);
      showError('Failed to load configuration: ' + (response.error || 'Unknown error'));
      return;
    }
    
    if (!response.config) {
      console.error('No configuration returned');
      showError('Configuration is empty. Using default configuration.');
      // Create default config
      currentConfig = {
        blockList: [],
        alwaysAllowedList: [],
        schedules: [],
        keywordFiltering: {
          enabled: false,
          keywords: []
        },
        logging: {
          enabled: false,
          maxEntries: 1000
        },
        passwordProtected: false
      };
    } else {
      currentConfig = response.config;
    }
    
    console.log('Configuration loaded:', currentConfig);
    console.log('currentConfig set:', currentConfig);
    
    renderConfiguration();
    console.log('renderConfiguration called');
    
    // FIX #6: Show success message
    showSuccess('Configuration loaded successfully');
    
  } catch (error) {
    console.error('Error loading configuration:', error);
    showError('Error loading configuration: ' + error.message);
    
    // FIX #7: Provide fallback configuration
    currentConfig = {
      blockList: [],
      alwaysAllowedList: [],
      schedules: [],
      keywordFiltering: {
        enabled: false,
        keywords: []
      },
      logging: {
        enabled: false,
        maxEntries: 1000
      },
      passwordProtected: false
    };
    renderConfiguration();
    showWarning('Using default configuration due to loading error');
  }
}

/**
 * Render configuration in UI
 */
function renderConfiguration() {
  // Render block list
  renderBlockList();
  
  // Render always allowed list
  renderAlwaysAllowedList();
  
  // Render schedules
  renderSchedules();
  
  // Set keyword filtering checkbox
  document.getElementById('enableKeywordFiltering').checked = 
    currentConfig.keywordFiltering.enabled;
  
  // Set logging checkbox
  document.getElementById('enableLogging').checked = 
    currentConfig.logging.enabled;
  
  // Set max log entries
  document.getElementById('maxLogEntries').value = 
    currentConfig.logging.maxEntries || 1000;
  
  updateKeywordFilteringUI();
  updateLoggingUI();
}

/**
 * Render block list
 */
function renderBlockList() {
  try {
    console.log('renderBlockList() called');
    const container = document.getElementById('blockListItems');
    
    if (!container) {
      console.error('blockListItems container not found');
      return;
    }
    
    console.log('Container found:', container);
    console.log('currentConfig.blockList:', currentConfig?.blockList);
    
    if (!currentConfig.blockList || currentConfig.blockList.length === 0) {
      console.log('No items in blockList, showing empty message');
      container.innerHTML = '<div class="no-items">No domains blocked</div>';
      return;
    }
    
    const html = currentConfig.blockList.map((domain, index) => `
    <div class="list-item">
      <span class="list-item-text">${escapeHtml(domain)}</span>
      <button class="btn-danger btn-small" onclick="removeDomain(${index})">Remove</button>
    </div>
  `).join('');
    
    console.log('Generated HTML:', html);
    container.innerHTML = html;
    console.log('renderBlockList() completed successfully');
  } catch (error) {
    console.error('Error in renderBlockList:', error);
  }
}

/**
 * Render always allowed list
 */
function renderAlwaysAllowedList() {
  const container = document.getElementById('alwaysAllowedItems');
  
  if (!currentConfig.alwaysAllowedList || currentConfig.alwaysAllowedList.length === 0) {
    container.innerHTML = '<div class="no-items">No domains in Always Allowed list</div>';
    return;
  }
  
  container.innerHTML = currentConfig.alwaysAllowedList.map((domain, index) => `
    <div class="list-item">
      <span class="list-item-text">${escapeHtml(domain)}</span>
      <button class="btn-danger btn-small" onclick="removeAllowedDomain(${index})">Remove</button>
    </div>
  `).join('');
}

/**
 * Render schedules
 */
function renderSchedules() {
  const container = document.getElementById('schedulesList');
  
  if (!currentConfig.schedules || currentConfig.schedules.length === 0) {
    container.innerHTML = '<div class="no-items">No schedules configured</div>';
    return;
  }
  
  container.innerHTML = currentConfig.schedules.map((schedule, index) => {
    const days = schedule.days && schedule.days.length > 0
      ? getDayNames(schedule.days).join(', ')
      : 'Every day';
    
    return `
      <div class="schedule-item">
        <h4>${schedule.mode.toUpperCase()} Mode: ${schedule.startTime} - ${schedule.endTime}</h4>
        <div class="schedule-info">
          <strong>Days:</strong> ${days}
        </div>
        <button class="btn-danger btn-small" onclick="removeSchedule(${index})">Remove Schedule</button>
      </div>
    `;
  }).join('');
}

/**
 * Add event listeners
 */
function addEventListeners() {
  // Helper function to safely add event listener
  const safeAddListener = (id, event, handler) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, handler);
    } else {
      console.warn(`Element with ID '${id}' not found`);
    }
  };
  
  try {
    // Domain management
    safeAddListener('addDomainBtn', 'click', addDomain);
    safeAddListener('newDomain', 'keypress', (e) => {
      if (e.key === 'Enter') addDomain();
    });
    
    safeAddListener('addAllowedDomainBtn', 'click', addAllowedDomain);
    safeAddListener('newAllowedDomain', 'keypress', (e) => {
      if (e.key === 'Enter') addAllowedDomain();
    });
    
    // Schedule management
    safeAddListener('addScheduleBtn', 'click', addSchedule);
    
    // Checkbox changes
    safeAddListener('enableKeywordFiltering', 'change', updateKeywordFilteringUI);
    safeAddListener('enableLogging', 'change', updateLoggingUI);
    
    // Settings management
    safeAddListener('updatePasswordBtn', 'click', updatePassword);
    safeAddListener('saveAllBtn', 'click', saveAllSettings);
    safeAddListener('reloadBtn', 'click', () => {
      location.reload();
    });
    safeAddListener('resetBtn', 'click', resetAll);
    
    // Export/import buttons
    safeAddListener('exportBtn', 'click', exportConfiguration);
    safeAddListener('importBtn', 'change', importConfiguration);
    
  } catch (error) {
    console.error('Error adding event listeners:', error);
  }
}

/**
 * Add domain to block list with validation
 */
function addDomain() {
  try {
    console.log('addDomain called');
    console.log('currentConfig:', currentConfig);
    
    // FIX #1: Enhanced null check with user feedback
    if (!currentConfig) {
      console.error('currentConfig is null - configuration not loaded');
      showError('Configuration not loaded. Please refresh the page and try again.');
      return;
    }
    
    const input = document.getElementById('newDomain');
    if (!input) {
      console.error('Input element newDomain not found');
      showError('Interface error. Please refresh the page.');
      return;
    }
    
    let domain = input.value.trim().toLowerCase();
    console.log('Domain entered:', domain);
    
    if (!domain) {
      showWarning('Please enter a domain');
      return;
    }
    
    // Basic validation - domain must have at least one dot or be localhost
    if (!domain.includes('.') && domain !== 'localhost') {
      showWarning('Invalid domain format. Use format like example.com');
      return;
    }
    
    // FIX #2: Initialize arrays if undefined
    if (!currentConfig.blockList) {
      console.warn('blockList not defined, creating it');
      currentConfig.blockList = [];
    }
    
    // Check for duplicates
    if (currentConfig.blockList.includes(domain)) {
      showWarning('Domain already in block list');
      return;
    }
    
    if (currentConfig.blockList.length >= 10000) {
      showWarning('Block list is full (10000 max)');
      return;
    }
    
    // Add the domain
    currentConfig.blockList.push(domain);
    console.log('Domain added. Current blockList:', currentConfig.blockList);
    
    input.value = '';
    
    // Re-render the list
    console.log('Calling renderBlockList()');
    renderBlockList();
    console.log('renderBlockList() completed');
    
    showSuccess('Domain added to block list');
    
    // FIX #3: Auto-save changes
    saveAllSettings().catch(error => {
      console.warn('Failed to auto-save after adding domain:', error);
      showWarning('Domain added but failed to save. Please click "Save All Settings" manually.');
    });
    
  } catch (error) {
    console.error('Error in addDomain:', error);
    console.error('Error stack:', error.stack);
    showError('Error adding domain: ' + error.message);
  }
}

/**
 * Remove domain from block list
 */
function removeDomain(index) {
  if (index >= 0 && index < currentConfig.blockList.length) {
    const domain = currentConfig.blockList[index];
    currentConfig.blockList.splice(index, 1);
    renderBlockList();
    showSuccess(`${domain} removed from block list`);
  }
}

/**
 * Add domain to always allowed list with validation
 */
function addAllowedDomain() {
  try {
    console.log('addAllowedDomain called');
    console.log('currentConfig:', currentConfig);
    
    // FIX #1: Enhanced null check with user feedback
    if (!currentConfig) {
      console.error('currentConfig is null - configuration not loaded');
      showError('Configuration not loaded. Please refresh the page and try again.');
      return;
    }
    
    // FIX #2: Add null check for input element (was missing, causing crashes)
    const input = document.getElementById('newAllowedDomain');
    if (!input) {
      console.error('Input element newAllowedDomain not found');
      showError('Interface error. Please refresh the page.');
      return;
    }
    
    let domain = input.value.trim().toLowerCase();
    console.log('Allowed domain entered:', domain);
    
    if (!domain) {
      showWarning('Please enter a domain');
      return;
    }
    
    // Basic validation - domain must have at least one dot or be localhost
    if (!domain.includes('.') && domain !== 'localhost') {
      showWarning('Invalid domain format. Use format like example.com');
      return;
    }
    
    // FIX #3: Initialize alwaysAllowedList if undefined (was missing, causing crashes)
    if (!currentConfig.alwaysAllowedList) {
      console.warn('alwaysAllowedList not defined, creating it');
      currentConfig.alwaysAllowedList = [];
    }
    
    // Check for duplicates
    if (currentConfig.alwaysAllowedList.includes(domain)) {
      showWarning('Domain already in Always Allowed list');
      return;
    }
    
    if (currentConfig.alwaysAllowedList.length >= 10000) {
      showWarning('Always Allowed list is full (10000 max)');
      return;
    }
    
    currentConfig.alwaysAllowedList.push(domain);
    console.log('Domain added. Current alwaysAllowedList:', currentConfig.alwaysAllowedList);
    
    input.value = '';
    renderAlwaysAllowedList();
    showSuccess('Domain added to Always Allowed list');
    
    // FIX #4: Auto-save changes
    saveAllSettings().catch(error => {
      console.warn('Failed to auto-save after adding domain:', error);
      showWarning('Domain added but failed to save. Please click "Save All Settings" manually.');
    });
    
  } catch (error) {
    console.error('Error in addAllowedDomain:', error);
    console.error('Error stack:', error.stack);
    showError('Error adding domain: ' + error.message);
  }
}

/**
 * Remove domain from always allowed list
 */
function removeAllowedDomain(index) {
  if (index >= 0 && index < currentConfig.alwaysAllowedList.length) {
    const domain = currentConfig.alwaysAllowedList[index];
    currentConfig.alwaysAllowedList.splice(index, 1);
    renderAlwaysAllowedList();
    showSuccess(`${domain} removed from Always Allowed list`);
  }
}

/**
 * Add schedule
 */
function addSchedule() {
  try {
    const mode = document.querySelector('input[name="scheduleMode"]:checked').value;
    const startTime = document.getElementById('scheduleStart').value;
    const endTime = document.getElementById('scheduleEnd').value;
    
    const days = [];
    const dayInputs = ['dayMonday', 'dayTuesday', 'dayWednesday', 'dayThursday', 
                       'dayFriday', 'daySaturday', 'daySunday'];
    
    dayInputs.forEach((id, index) => {
      // Map HTML id to day numbers: Mon=1, Tue=2, ..., Sun=0
      const dayNum = id === 'daySunday' ? 0 : (index + 1);
      if (document.getElementById(id).checked) {
        days.push(dayNum);
      }
    });
    
    if (days.length === 0) {
      showWarning('Please select at least one day');
      return;
    }
    
    const schedule = {
      mode,
      startTime,
      endTime,
      days
    };
    
    if (!currentConfig.schedules) {
      currentConfig.schedules = [];
    }
    
    currentConfig.schedules.push(schedule);
    
    // Reset form
    document.getElementById('scheduleStart').value = '09:00';
    document.getElementById('scheduleEnd').value = '17:00';
    document.getElementById('modeRestricted').checked = true;
    dayInputs.forEach(id => document.getElementById(id).checked = false);
    
    renderSchedules();
    showSuccess('Schedule added');
  } catch (error) {
    console.error('Error in addSchedule:', error);
    showError('Error adding schedule: ' + error.message);
  }
}

/**
 * Remove schedule
 */
function removeSchedule(index) {
  if (index >= 0 && index < currentConfig.schedules.length) {
    currentConfig.schedules.splice(index, 1);
    renderSchedules();
    showSuccess('Schedule removed');
  }
}

/**
 * Update keyword filtering UI visibility
 */
function updateKeywordFilteringUI() {
  const enabled = document.getElementById('enableKeywordFiltering').checked;
  const section = document.getElementById('keywordFilteringSection');
  
  if (enabled) {
    section.classList.remove('hidden');
  } else {
    section.classList.add('hidden');
  }
  
  currentConfig.keywordFiltering.enabled = enabled;
}

/**
 * Update logging UI visibility
 */
function updateLoggingUI() {
  const enabled = document.getElementById('enableLogging').checked;
  const section = document.getElementById('loggingSection');
  
  if (enabled) {
    section.classList.remove('hidden');
  } else {
    section.classList.add('hidden');
  }
  
  currentConfig.logging.enabled = enabled;
}

/**
 * Update password with validation
 */
async function updatePassword() {
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!newPassword) {
    showWarning('Please enter a password');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }
  
  // Validate password requirements (4-128 characters)
  if (newPassword.length < 4 || newPassword.length > 128) {
    showWarning('Password must be 4-128 characters');
    return;
  }
  
  try {
    await sendMessage({
      type: 'setPassword',
      password: newPassword
    });
    
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showSuccess('Password updated successfully');
  } catch (error) {
    showError('Error updating password: ' + error.message);
  }
}

/**
 * Save all settings with comprehensive validation
 */
async function saveAllSettings() {
  try {
    // Update keyword filtering settings with basic sanitization
    const keywordsList = document.getElementById('keywordsList').value;
    currentConfig.keywordFiltering.keywords = keywordsList
      .split('\n')
      .map(k => k.trim())
      .filter(k => k && k.length > 0);
    
    if (currentConfig.keywordFiltering.keywords.length > 1000) {
      showWarning('Too many keywords (max 1000)');
      return;
    }
    
    // Validate max log entries
    const maxEntries = parseInt(document.getElementById('maxLogEntries').value) || 1000;
    if (isNaN(maxEntries) || maxEntries < 100 || maxEntries > 100000) {
      showWarning('Log entries must be between 100 and 100000');
      return;
    }
    currentConfig.logging.maxEntries = maxEntries;
    
    // Save configuration (backend will do full validation)
    
    // Save configuration
    const response = await sendMessage({
      type: 'saveConfig',
      config: currentConfig
    });
    
    if (response.success) {
      showSuccess('Settings saved successfully!');
    } else {
      showError('Failed to save settings: ' + response.error);
    }
  } catch (error) {
    showError('Error saving settings: ' + error.message);
  }
}

/**
 * Reset all settings
 */
function resetAll() {
  if (confirm('⚠️ This will erase ALL configuration data. The extension will need to be reinstalled to use it again. Are you sure?')) {
    if (confirm('This action cannot be undone. Type OK if you are absolutely sure:')) {
      chrome.runtime.sendMessage({ type: 'resetAll' }, async () => {
        await chrome.storage.local.clear();
        showSuccess('All settings have been reset. Please uninstall and reinstall the extension.');
      });
    }
  }
}

/**
 * Export configuration as JSON file
 */
async function exportConfiguration() {
  try {
    const response = await sendMessage({ type: 'exportConfig' });
    
    if (!response.success) {
      showError('Failed to export configuration');
      return;
    }
    
    const backup = response.backup;
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parental-control-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showSuccess('Configuration exported successfully');
  } catch (error) {
    showError('Error exporting configuration: ' + error.message);
  }
}

/**
 * Import configuration from JSON file
 */
function importConfiguration(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const backup = JSON.parse(content);
      
      const response = await sendMessage({
        type: 'importConfig',
        backup: backup
      });
      
      if (response.success) {
        showSuccess('Configuration imported successfully. Please reload the page.');
        setTimeout(() => location.reload(), 2000);
      } else {
        showError('Failed to import configuration: ' + response.error);
      }
    } catch (error) {
      showError('Error importing configuration: ' + error.message);
    }
  };
  
  reader.readAsText(file);
  // Reset file input
  event.target.value = '';
}

/**
 * Send message to background service worker with timeout
 */
function sendMessage(message) {
  return new Promise((resolve) => {
    console.log('sendMessage:', message);
    
    // 5 second timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.error('Message timeout for:', message.type);
      resolve({ success: false, error: 'Message timeout - extension may not be ready' });
    }, 5000);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeoutId);
      console.log('Message response for', message.type, ':', response);
      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { success: false, error: 'No response' });
      }
    });
  });
}

/**
 * Check if password is set
 */
function isPasswordSet() {
  return new Promise((resolve) => {
    chrome.storage.local.get('passwordHash', (result) => {
      resolve(!!result.passwordHash);
    });
  });
}

/**
 * Get day names from day numbers
 */
function getDayNames(dayNumbers) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNumbers.map(n => days[n]);
}

/**
 * Show success message
 */
function showSuccess(message) {
  const el = document.getElementById('successMessage');
  el.textContent = '✓ ' + message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

/**
 * Show error message
 */
function showError(message) {
  const el = document.getElementById('errorMessage');
  el.textContent = '✕ ' + message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 6000);
}

/**
 * Show warning message
 */
function showWarning(message) {
  const el = document.getElementById('warningMessage');
  el.textContent = '⚠ ' + message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

/**
 * Escape HTML special characters for safe display
 */
function escapeHtml(text) {
  return SecurityHelper.escapeHtml(text);
}
