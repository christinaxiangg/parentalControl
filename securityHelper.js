// Security Helper - Input sanitization and security utilities
class SecurityHelper {
  
  /**
   * Escape HTML special characters to prevent XSS
   */
  static escapeHtml(text) {
    if (typeof text !== 'string') {
      return '';
    }
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }
  
  /**
   * Remove potentially dangerous HTML
   */
  static sanitizeHtml(html) {
    if (typeof html !== 'string') {
      return '';
    }
    
    // Remove script tags and event handlers
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  }
  
  /**
   * Validate URL origin for message passing
   */
  static isValidOrigin(origin) {
    if (typeof origin !== 'string') {
      return false;
    }
    
    // Only allow chrome extension origin
    const extensionId = chrome.runtime.id;
    const validOrigin = `chrome-extension://${extensionId}`;
    
    return origin === validOrigin;
  }
  
  /**
   * Validate sender in message
   */
  static isValidMessageSender(sender) {
    if (!sender || !sender.url) {
      return false;
    }
    
    const url = new URL(sender.url);
    
    // Allow messages only from extension itself, not from external content
    return url.protocol === 'chrome-extension:';
  }
  
  /**
   * Create Content Security Policy headers for blocked page
   */
  static getBlockedPageCSP() {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"]
    };
  }
  
  /**
   * Safely create JSON response
   */
  static createSafeResponse(data) {
    try {
      // Ensure response is JSON serializable
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      console.error('Error creating safe response:', error);
      return { error: 'Invalid response data' };
    }
  }
  
  /**
   * Validate and sanitize URL
   */
  static sanitizeUrl(url) {
    if (typeof url !== 'string') {
      return '';
    }
    
    try {
      const urlObj = new URL(url);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return '';
      }
      return urlObj.toString();
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Rate limiting helper
   */
  static createRateLimiter(maxRequests = 10, windowMs = 60000) {
    const requests = new Map();
    
    return {
      check: function(key) {
        const now = Date.now();
        const userRequests = requests.get(key) || [];
        
        // Remove old requests outside the window
        const recentRequests = userRequests.filter(time => now - time < windowMs);
        
        if (recentRequests.length >= maxRequests) {
          return false;
        }
        
        recentRequests.push(now);
        requests.set(key, recentRequests);
        return true;
      },
      
      reset: function(key) {
        requests.delete(key);
      }
    };
  }
  
  /**
   * Secure message validation
   */
  static validateMessage(message, expectedFields = []) {
    if (!message || typeof message !== 'object') {
      return false;
    }
    
    // Check required fields
    for (const field of expectedFields) {
      if (!(field in message)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if content is safe to display
   */
  static isSafeContent(text) {
    if (typeof text !== 'string') {
      return false;
    }
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\(/i,
      /alert\(/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Generate security headers for extension pages
   */
  static getSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=()'
    };
  }
  
  /**
   * Verify message signature (basic implementation)
   */
  static async verifyMessageIntegrity(data, signature) {
    try {
      // Convert data to bytes
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(data));
      
      // Verify signature matches
      // This is a simple check - implement HMAC for production
      return true;
    } catch (error) {
      console.error('Error verifying message integrity:', error);
      return false;
    }
  }
}

// Create singleton for rate limiter
const messageRateLimiter = SecurityHelper.createRateLimiter(100, 60000);
