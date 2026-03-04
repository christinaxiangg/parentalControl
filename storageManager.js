// Storage Manager - Handles configuration, passwords, and logging
class StorageManager {
  
  constructor() {
    this.STORAGE_QUOTA_PERCENT = 0.8; // Use max 80% of quota
  }
  
  /**
   * Get complete configuration with error handling
   */
  async getConfig() {
    try {
      return await new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get('config', (result) => {
            try {
              if (chrome.runtime.lastError) {
                reject(new Error('Storage access error: ' + chrome.runtime.lastError.message));
              } else {
                const config = result.config || this.getDefaultConfig();
                resolve(config);
              }
            } catch (innerError) {
              reject(innerError);
            }
          });
        } catch (setupError) {
          reject(setupError);
        }
      });
    } catch (error) {
      console.error('Error getting config:', error);
      return this.getDefaultConfig();
    }
  }
  
  /**
   * Save configuration with validation and error handling
   */
  async saveConfig(config) {
    try {
      // Validate configuration
      const validation = ConfigValidator.validate(config);
      if (!validation.isValid) {
        throw new Error('Configuration validation failed: ' + validation.errors.join(', '));
      }
      
      // Check storage quota before saving
      await this.checkStorageQuota();
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ config }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to save config: ' + chrome.runtime.lastError.message));
          } else {
            // Clear rules cache when config changes (works in service worker context)
            if (typeof cacheManager !== 'undefined') {
              cacheManager.delete('generated_rules');
            }
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }
  
  /**
   * Get default configuration template
   */
  getDefaultConfig() {
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
      passwordProtected: true,
      version: '2.0'
    };
  }
  
  /**
   * Set master password with validation
   */
  async setPassword(password) {
    try {
      // Validate password
      if (!ConfigValidator.isValidPassword(password)) {
        throw new Error('Password must be 4-128 characters');
      }
      
      const hash = await this.hashPassword(password);
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ passwordHash: hash }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to set password: ' + chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error setting password:', error);
      throw error;
    }
  }
  
  /**
   * Verify password against stored hash
   */
  async verifyPassword(password) {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get('passwordHash', async (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Password verification failed: ' + chrome.runtime.lastError.message));
            return;
          }
          
          if (!result.passwordHash) {
            resolve(false);
            return;
          }
          
          try {
            const providedHash = await this.hashPassword(password);
            resolve(providedHash === result.passwordHash);
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }
  
  /**
   * Hash password using SHA-256
   */
  async hashPassword(password) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert buffer to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Password hashing failed');
    }
  }
  
  /**
   * Check if password is set
   */
  async isPasswordSet() {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get('passwordHash', (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Password check failed: ' + chrome.runtime.lastError.message));
          } else {
            resolve(!!result.passwordHash);
          }
        });
      });
    } catch (error) {
      console.error('Error checking password:', error);
      return false;
    }
  }
  
  /**
   * Log blocked attempt with quota management
   */
  async logBlockedAttempt(url, reason) {
    try {
      const config = await this.getConfig();
      
      if (!config.logging.enabled) {
        return;
      }
      
      // Check storage quota
      await this.checkStorageQuota();
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.get('logs', (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to access logs: ' + chrome.runtime.lastError.message));
            return;
          }
          
          try {
            let logs = result.logs || [];
            
            // Add new log entry with validation
            const logEntry = {
              url: SecurityHelper.sanitizeUrl(url) || url,
              reason: reason,
              timestamp: new Date().toISOString(),
              id: Date.now()
            };
            
            logs.unshift(logEntry);
            
            // Trim logs if exceeding max
            if (logs.length > config.logging.maxEntries) {
              logs = logs.slice(0, config.logging.maxEntries);
            }
            
            chrome.storage.local.set({ logs }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error('Failed to save log: ' + chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error logging blocked attempt:', error);
    }
  }
  
  /**
   * Get all logs
   */
  async getLogs() {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get('logs', (result) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to retrieve logs: ' + chrome.runtime.lastError.message));
          } else {
            resolve(result.logs || []);
          }
        });
      });
    } catch (error) {
      console.error('Error getting logs:', error);
      return [];
    }
  }
  
  /**
   * Clear logs
   */
  async clearLogs() {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ logs: [] }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to clear logs: ' + chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error clearing logs:', error);
      throw error;
    }
  }
  
  /**
   * Export configuration as JSON
   */
  async exportConfig() {
    try {
      const config = await this.getConfig();
      const backup = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        config: config,
        note: 'This backup does not include passwords. You will need to set a new password after importing.'
      };
      
      return backup;
    } catch (error) {
      console.error('Error exporting config:', error);
      throw error;
    }
  }
  
  /**
   * Import configuration from JSON
   */
  async importConfig(backup) {
    try {
      if (!backup || !backup.config) {
        throw new Error('Invalid backup format');
      }
      
      // Validate imported configuration
      const validation = ConfigValidator.validate(backup.config);
      if (!validation.isValid) {
        throw new Error('Invalid configuration: ' + validation.errors.join(', '));
      }
      
      await this.saveConfig(backup.config);
      return true;
    } catch (error) {
      console.error('Error importing config:', error);
      throw error;
    }
  }
  
  /**
   * Check storage quota
   */
  async checkStorageQuota() {
    try {
      if (!chrome.storage.local.getBytesInUse) {
        return; // Method not available
      }
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.getBytesInUse(null, (bytesUsed) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to check storage quota: ' + chrome.runtime.lastError.message));
            return;
          }
          
          const quota = chrome.storage.local.QUOTA_BYTES;
          const maxAllowed = quota * this.STORAGE_QUOTA_PERCENT;
          
          if (bytesUsed > maxAllowed) {
            console.warn(`Storage quota warning: ${Math.round(bytesUsed / 1024)}KB used of ${Math.round(quota / 1024)}KB`);
            // Attempt to free space by removing old logs
            this.clearOldLogs().catch(console.error);
          }
          
          resolve({
            used: bytesUsed,
            quota: quota,
            percentage: (bytesUsed / quota) * 100
          });
        });
      });
    } catch (error) {
      console.error('Error checking storage quota:', error);
    }
  }
  
  /**
   * Clear old logs to free storage
   */
  async clearOldLogs() {
    try {
      const logs = await this.getLogs();
      
      if (logs.length === 0) {
        return;
      }
      
      // Keep only last 100 logs
      const recentLogs = logs.slice(0, 100);
      
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ logs: recentLogs }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to clear old logs: ' + chrome.runtime.lastError.message));
          } else {
            console.log('Cleared old logs to free storage');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error clearing old logs:', error);
    }
  }
  
  /**
   * Reset all configuration
   */
  async resetAll() {
    try {
      return new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(new Error('Failed to reset: ' + chrome.runtime.lastError.message));
          } else {
            // Clear cache as well (only in service worker context where cacheManager is available)
            if (typeof cacheManager !== 'undefined') {
              cacheManager.clear();
            }
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Error resetting all:', error);
      throw error;
    }
  }
}
