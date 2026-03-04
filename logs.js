let allLogs = [];
let filteredLogs = [];
let config = null;

// Session-based unlock tracking
const SESSION_KEY = 'extensionUnlocked';

function isSessionUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

function setSessionUnlocked() {
  sessionStorage.setItem(SESSION_KEY, 'true');
}

async function isPasswordSet() {
  return new Promise(resolve => {
    chrome.storage.local.get('passwordHash', (result) => {
      resolve(!!result.passwordHash);
    });
  });
}

document.addEventListener('DOMContentLoaded', initializeLogs);

async function initializeLogs() {
    try {
        // Check if password protection is needed
        const passwordSet = await isPasswordSet();
        
        if (passwordSet && !isSessionUnlocked()) {
          // Show password check
          document.getElementById('passwordCheck').style.display = 'block';
          document.getElementById('logsContent').style.display = 'none';
          document.getElementById('unlockBtn').addEventListener('click', verifyAccess);
          document.getElementById('accessPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') verifyAccess();
          });
          return;
        }
        
        // Password not set or already unlocked, load logs
        if (passwordSet) {
          setSessionUnlocked();
        }
        document.getElementById('passwordCheck').style.display = 'none';
        document.getElementById('logsContent').style.display = 'block';
        
        // Get configuration and logs
        const configResponse = await sendMessage({ type: 'getConfig' });
        config = configResponse.config;
        
        const logs = await getLogs();
        allLogs = logs;
        filteredLogs = [...allLogs];
        
        if (!config.logging.enabled) {
            document.getElementById('infoMessage').textContent = 
                '⚠️ Logging is not enabled. Enable logging in settings to track blocked attempts.';
            document.getElementById('infoMessage').classList.add('show');
        }
        
        renderLogs();
        renderStats();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing logs:', error);
    }
}

async function verifyAccess() {
  const password = document.getElementById('accessPassword').value;
  
  if (!password) {
    alert('Please enter a password');
    return;
  }
  
  try {
    const response = await sendMessage({
      type: 'verifyPassword',
      password: password
    });
    
    if (response.success && response.isValid) {
      setSessionUnlocked();
      document.getElementById('passwordCheck').style.display = 'none';
      document.getElementById('logsContent').style.display = 'block';
      
      // Reload logs after unlock
      const configResponse = await sendMessage({ type: 'getConfig' });
      config = configResponse.config;
      
      const logs = await getLogs();
      allLogs = logs;
      filteredLogs = [...allLogs];
      
      renderLogs();
      renderStats();
      setupEventListeners();
    } else if (response.rateLimited) {
      alert('Too many incorrect attempts. Please try again in 5 minutes.');
      document.getElementById('accessPassword').value = '';
    } else {
      alert('Invalid password');
      document.getElementById('accessPassword').value = '';
    }
  } catch (error) {
    alert('Error verifying password: ' + error.message);
  }
}


function renderStats() {
    if (allLogs.length === 0) {
        document.getElementById('statsContainer').innerHTML = '';
        return;
    }
    
    const stats = {
        totalBlocked: allLogs.length,
        blockedDomains: 0,
        contentFiltered: 0,
        timeRestricted: 0
    };
    
    allLogs.forEach(log => {
        if (log.reason === 'blocked_domain') stats.blockedDomains++;
        else if (log.reason === 'keyword_filtered') stats.contentFiltered++;
        else if (log.reason === 'restricted_hour') stats.timeRestricted++;
    });
    
    const html = `
        <div class="stat-card">
            <div class="stat-value">${stats.totalBlocked}</div>
            <div class="stat-label">Total Blocked</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.blockedDomains}</div>
            <div class="stat-label">Blocked Domains</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.contentFiltered}</div>
            <div class="stat-label">Content Filtered</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.timeRestricted}</div>
            <div class="stat-label">Time Restricted</div>
        </div>
    `;
    
    document.getElementById('statsContainer').innerHTML = html;
}

function renderLogs() {
    const container = document.getElementById('logsList');
    
    if (filteredLogs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No logs yet</h3>
                <p>Blocked attempts will appear here when logging is enabled.</p>
            </div>
        `;
        return;
    }
    
    const html = `
        <table class="log-table">
            <thead>
                <tr>
                    <th>Blocked URL</th>
                    <th>Time</th>
                    <th>Reason</th>
                </tr>
            </thead>
            <tbody>
                ${filteredLogs.map(log => {
                    const url = new URL(log.url, 'http://localhost').hostname || log.url;
                    const date = new Date(log.timestamp);
                    const timeStr = date.toLocaleString();
                    const reasonBadge = getBadgeClass(log.reason);
                    const reasonText = getReasonText(log.reason);
                    
                    return `
                        <tr>
                            <td>${escapeHtml(url)}</td>
                            <td>${timeStr}</td>
                            <td><span class="reason-badge ${reasonBadge}">${reasonText}</span></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

function setupEventListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
    
    document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
    document.getElementById('exportBtn').addEventListener('click', exportLogs);
}

async function clearLogs() {
    if (confirm('Are you sure you want to delete all logs? This cannot be undone.')) {
        chrome.storage.local.set({ logs: [] }, () => {
            allLogs = [];
            filteredLogs = [];
            renderLogs();
            renderStats();
            showSuccess('All logs cleared');
        });
    }
}

function exportLogs() {
    const csv = 'URL,Timestamp,Reason\n' + 
        filteredLogs.map(log => 
            `"${log.url}","${log.timestamp}","${log.reason}"`
        ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parental-control-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function getLogs() {
    return new Promise(resolve => {
        chrome.storage.local.get('logs', (result) => {
            resolve(result.logs || []);
        });
    });
}

function sendMessage(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            resolve(response || { success: false });
        });
    });
}

function getBadgeClass(reason) {
    const classes = {
        'blocked_domain': 'reason-domain',
        'keyword_filtered': 'reason-keyword',
        'restricted_hour': 'reason-time'
    };
    return classes[reason] || 'reason-other';
}

function getReasonText(reason) {
    const texts = {
        'blocked_domain': 'Blocked Domain',
        'keyword_filtered': 'Content Filtered',
        'restricted_hour': 'Time Restricted'
    };
    return texts[reason] || 'Other';
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function showSuccess(message) {
    const el = document.getElementById('successMessage');
    el.textContent = '✓ ' + message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 4000);
}
