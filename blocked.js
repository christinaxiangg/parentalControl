// Blocked page script
(function() {
  try {
    // Get parameters from URL
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason') || 'unknown';
    const domain = params.get('domain');
    const keyword = params.get('keyword');
    
    // Set current time
    const now = new Date();
    document.getElementById('blockedTime').textContent = now.toLocaleString();
    
    // Set blocked URL
    const referrer = document.referrer || 'Unknown';
    document.getElementById('blockedUrl').textContent = referrer || 'Unknown';
    
    // Customize message based on reason
    const messageBox = document.getElementById('messageBox');
    const subtitleText = document.getElementById('subtitleText');
    const reasonText = document.getElementById('reasonText');
    
    if (reason === 'blocked_domain') {
      subtitleText.textContent = 'This domain has been blocked by parental controls.';
      reasonText.textContent = 'Domain: ' + (domain || 'Unknown');
      messageBox.className = 'message restricted-message';
      messageBox.innerHTML = '<strong>Domain Blocked</strong><br><p style="margin-top: 10px;">The domain you are trying to access is on the block list and cannot be accessed.</p>';
    } else if (reason === 'keyword_filtered') {
      subtitleText.textContent = 'This page contains restricted content.';
      reasonText.textContent = 'Content Filter: ' + (keyword || 'Inappropriate content detected');
      messageBox.className = 'message filtered-message';
      messageBox.innerHTML = '<strong>Content Blocked</strong><br><p style="margin-top: 10px;">The page you tried to access contains content that has been filtered by parental controls.</p>';
    } else if (reason === 'restricted_hour') {
      subtitleText.textContent = 'Website access is currently restricted.';
      reasonText.textContent = 'Restricted Hours';
      messageBox.className = 'message restricted-message';
      messageBox.innerHTML = '<strong>Time Restriction</strong><br><p style="margin-top: 10px;">Website access is not allowed during the current restricted hours. Please try again later.</p>';
      
      // Show time info
      const timeInfo = document.getElementById('timeInfo');
      timeInfo.innerHTML = '⏰ <strong>Restricted Hours Active</strong><br>Website access will be available after the restricted period ends.';
    }
    
    // Log the blocked attempt with the actual blocked URL
    // For blocked_domain reason, use the domain parameter; for others use referrer
    let blockedUrl = referrer;
    if (reason === 'blocked_domain' && domain) {
      blockedUrl = 'https://' + domain;
    }
    
    chrome.runtime.sendMessage({
      type: 'logBlockedAttempt',
      url: blockedUrl,
      reason: reason
    });
    
    // Disable going back
    window.history.forward();
    setTimeout(() => {
      if (window.history.length > 0) {
        window.location.href = 'about:blank';
      }
    }, 100);
  } catch (error) {
    console.error('Error in blocked page script:', error);
  }
})();
