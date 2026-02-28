// Popup Script
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  try {
    const content = document.getElementById('content');
    
    // Get current configuration
    const message = { type: 'getConfig' };
    const response = await sendMessage(message);
    
    if (!response.success) {
      console.error('Failed to load configuration:', response.error);
      showError(content, 'Failed to load configuration: ' + (response.error || 'Unknown error'));
      return;
    }
    
    if (!response.config) {
      console.error('No configuration returned');
      showError(content, 'Configuration is empty');
      return;
    }
    
    const config = response.config;
    
    // Check if password is set
    const passwordSet = await isPasswordSet();
    
    // Get current restriction status
    const restrictionResponse = await sendMessage({ 
      type: 'isCurrentlyRestricted',
      config: config
    });
    
    const isRestricted = restrictionResponse.success && restrictionResponse.restricted;
    
    // Render popup content
    let html = '';
    
    // Status section
    const statusClass = isRestricted ? 'status-restricted' : 'status-allowed';
    const statusText = isRestricted ? 'RESTRICTED' : 'ALLOWED';
    
    html += '<div class="status-card">';
    html += '<div class="status-label">Current Mode</div>';
    html += `<div class="status-value ${statusClass}">${statusText}</div>`;
    html += '</div>';
    
    // Active schedules section
    if (config.schedules && config.schedules.length > 0) {
      html += '<div class="info-section">';
      html += '<h3>Active Schedules</h3>';
      config.schedules.forEach((schedule, index) => {
        const daysText = schedule.days && schedule.days.length > 0 
          ? getDayNames(schedule.days).join(', ')
          : 'Daily';
        html += `<div class="info-item">`;
        html += `<strong>${schedule.startTime} - ${schedule.endTime}</strong><br>`;
        html += `Mode: ${schedule.mode} | ${daysText}`;
        html += `</div>`;
      });
      html += '</div>';
    }
    
    // Block list summary
    if (config.blockList && config.blockList.length > 0) {
      html += '<div class="info-section">';
      html += `<h3>Blocked Domains (${config.blockList.length})</h3>`;
      const displayedDomains = config.blockList.slice(0, 3);
      displayedDomains.forEach(domain => {
        html += `<div class="info-item">${domain}</div>`;
      });
      if (config.blockList.length > 3) {
        html += `<div class="info-item" style="color: #999;">... and ${config.blockList.length - 3} more</div>`;
      }
      html += '</div>';
    }
    
    // Settings protection status
    html += '<div class="info-section">';
    html += '<h3>Security</h3>';
    html += `<div class="info-item">🔐 Password Protected: ${passwordSet ? 'Yes' : 'No'}</div>`;
    html += `<div class="info-item">📊 Logging: ${config.logging.enabled ? 'Enabled' : 'Disabled'}</div>`;
    html += '</div>';
    
    // Buttons
    html += '<div class="button-group">';
    html += '<button class="btn-primary" id="settingsBtn">Settings</button>';
    html += '<button class="btn-secondary" id="viewLogsBtn">View Logs</button>';
    html += '</div>';
    
    content.innerHTML = html;
    
    // Add event listeners
    document.getElementById('settingsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    
    document.getElementById('viewLogsBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') });
    });
    
  } catch (error) {
    console.error('Error initializing popup:', error);
    document.getElementById('content').innerHTML = 
      `<div class="error">Error loading popup: ${error.message}</div>`;
  }
}

/**
 * Send message to background service worker with timeout
 */
function sendMessage(message) {
  return new Promise((resolve) => {
    // 5 second timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      resolve({ success: false, error: 'Message timeout - extension may not be ready' });
    }, 5000);
    
    chrome.runtime.sendMessage(message, (response) => {
      clearTimeout(timeoutId);
      if (chrome.runtime.lastError) {
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
 * Convert day numbers to readable names
 */
function getDayNames(dayNumbers) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNumbers.map(n => days[n]);
}

/**
 * Show error message
 */
function showError(element, message) {
  element.innerHTML = `<div class="error">${message}</div>`;
}
