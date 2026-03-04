// Configuration Validator - Validates extension configuration
class ConfigValidator {
  
  /**
   * Validate complete configuration
   */
  static validate(config) {
    const errors = [];
    const warnings = [];
    
    if (!config) {
      errors.push('Configuration object is null or undefined');
      return { isValid: false, errors, warnings };
    }
    
    // Validate block list
    if (config.blockList) {
      if (!Array.isArray(config.blockList)) {
        errors.push('blockList must be an array');
      } else {
        config.blockList.forEach((domain, index) => {
          if (!this.isValidDomain(domain)) {
            errors.push(`Invalid domain in blockList at index ${index}: "${domain}"`);
          }
        });
        
        if (config.blockList.length > 10000) {
          warnings.push('blockList contains more than 10,000 domains (may impact performance)');
        }
      }
    }
    
    // Validate always allowed list
    if (config.alwaysAllowedList) {
      if (!Array.isArray(config.alwaysAllowedList)) {
        errors.push('alwaysAllowedList must be an array');
      } else {
        config.alwaysAllowedList.forEach((domain, index) => {
          if (!this.isValidDomain(domain)) {
            errors.push(`Invalid domain in alwaysAllowedList at index ${index}: "${domain}"`);
          }
        });
      }
    }
    
    // Validate schedules
    if (config.schedules) {
      if (!Array.isArray(config.schedules)) {
        errors.push('schedules must be an array');
      } else {
        config.schedules.forEach((schedule, index) => {
          const scheduleErrors = this.validateSchedule(schedule, index);
          errors.push(...scheduleErrors);
        });
      }
    }
    
    // Validate keyword filtering
    if (config.keywordFiltering) {
      if (typeof config.keywordFiltering.enabled !== 'boolean') {
        errors.push('keywordFiltering.enabled must be a boolean');
      }
      
      if (!Array.isArray(config.keywordFiltering.keywords)) {
        errors.push('keywordFiltering.keywords must be an array');
      } else if (config.keywordFiltering.keywords.length > 1000) {
        warnings.push('More than 1000 keywords configured (may impact performance)');
      }
    }
    
    // Validate logging
    if (config.logging) {
      if (typeof config.logging.enabled !== 'boolean') {
        errors.push('logging.enabled must be a boolean');
      }
      
      if (typeof config.logging.maxEntries !== 'number' || config.logging.maxEntries < 100) {
        errors.push('logging.maxEntries must be a number >= 100');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate individual schedule
   */
  static validateSchedule(schedule, index) {
    const errors = [];
    
    if (!schedule || typeof schedule !== 'object') {
      errors.push(`Schedule at index ${index} is not a valid object`);
      return errors;
    }
    
    // Validate mode
    if (!schedule.mode || !['allowed', 'restricted'].includes(schedule.mode)) {
      errors.push(`Schedule ${index}: mode must be 'allowed' or 'restricted'`);
    }
    
    // Validate start time
    if (!this.isValidTimeFormat(schedule.startTime)) {
      errors.push(`Schedule ${index}: invalid start time format "${schedule.startTime}" (use HH:MM)`);
    }
    
    // Validate end time
    if (!this.isValidTimeFormat(schedule.endTime)) {
      errors.push(`Schedule ${index}: invalid end time format "${schedule.endTime}" (use HH:MM)`);
    }
    
    // Validate days
    if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
      errors.push(`Schedule ${index}: days must be a non-empty array`);
    } else {
      schedule.days.forEach(day => {
        if (typeof day !== 'number' || day < 0 || day > 6) {
          errors.push(`Schedule ${index}: invalid day value ${day} (must be 0-6)`);
        }
      });
    }
    
    return errors;
  }
  
  /**
   * Validate domain format
   */
  static isValidDomain(domain) {
    if (typeof domain !== 'string' || domain.length === 0) {
      return false;
    }
    
    // Simple domain validation - no special characters, valid format
    const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]{2,}$/i;
    return domainRegex.test(domain.toLowerCase());
  }
  
  /**
   * Validate time format HH:MM
   */
  static isValidTimeFormat(time) {
    if (typeof time !== 'string') {
      return false;
    }
    
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }
  
  /**
   * Validate password requirements
   */
  static isValidPassword(password) {
    if (typeof password !== 'string') {
      return false;
    }
    
    // Minimum 4 characters
    if (password.length < 4) {
      return false;
    }
    
    // Maximum 128 characters (reasonable limit)
    if (password.length > 128) {
      return false;
    }
    
    // Require at least one letter and one number
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    return hasLetter && hasNumber;
  }
  
  /**
   * Sanitize domain input
   */
  static sanitizeDomain(domain) {
    if (typeof domain !== 'string') {
      return '';
    }
    
    return domain.trim().toLowerCase();
  }
  
  /**
   * Sanitize keyword input
   */
  static sanitizeKeyword(keyword) {
    if (typeof keyword !== 'string') {
      return '';
    }
    
    // Remove special regex characters and trim
    return keyword.trim().toLowerCase().replace(/[<>]/g, '');
  }
  
  /**
   * Get validation error message for UI
   */
  static getErrorMessage(error) {
    const messages = {
      'invalid_domain': 'Domain format is invalid. Use format like example.com',
      'invalid_time': 'Time must be in HH:MM format (24-hour)',
      'invalid_password': 'Password must be 4-128 characters with at least one letter and number (e.g., abc123)',
      'duplicate_domain': 'This domain is already in the list',
      'no_days_selected': 'Please select at least one day of the week'
    };
    
    return messages[error] || 'An error occurred';
  }
}
