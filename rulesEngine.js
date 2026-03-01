// Rules Engine - Generates declarativeNetRequest rules based on configuration
class RulesEngine {
  
  /**
   * Generate declarativeNetRequest rules based on configuration
   */
  async generateRules(config) {
    try {
      // Validate configuration
      const validation = ConfigValidator.validate(config);
      if (!validation.isValid) {
        console.warn('Configuration validation warnings:', validation.warnings);
      }
      
      const rules = [];
      let ruleId = 1;
      
      // Determine what should be blocked based on current time and schedules
      const blockedDomains = this.getBlockedDomainsForCurrentTime(config);
      
      // Create rules for blocked domains (max 30MB rule set)
      const maxRules = 30000; // Safety limit
      
      for (const domain of blockedDomains) {
        if (ruleId >= maxRules) {
          console.warn('Reached maximum rule limit');
          break;
        }
        
        // Validate domain before adding
        if (!ConfigValidator.isValidDomain(domain)) {
          console.warn('Skipping invalid domain:', domain);
          continue;
        }
        
        try {
          // Rule for exact domain match
          rules.push({
            id: ruleId++,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: { 
                url: chrome.runtime.getURL(
                  'blocked.html?reason=blocked_domain&domain=' + encodeURIComponent(domain)
                ) 
              }
            },
            condition: {
              urlFilter: '||' + domain,
              resourceTypes: ['main_frame']
            }
          });
        } catch (error) {
          console.error('Error adding rule for domain:', domain, error);
        }
      }
      
      return rules;
    } catch (error) {
      console.error('Error generating rules:', error);
      return [];
    }
  }
  
  /**
   * Determine which domains should be blocked based on current time
   */
  getBlockedDomainsForCurrentTime(config) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
    const currentDayOfWeek = now.getDay(); // 0 = Sunday
    
    let mode = 'allowed'; // default mode
    
    // Check if we're in a restricted schedule
    if (config.schedules && config.schedules.length > 0) {
      for (const schedule of config.schedules) {
        if (this.isScheduleActive(schedule, currentTime, currentDayOfWeek)) {
          mode = schedule.mode;
          break;
        }
      }
    }
    
    const blockedDomains = [];
    
    // FIX: Properly exclude always-allowed domains from blocking
    // Create Set of always-allowed domains for efficient lookup
    const alwaysAllowed = new Set();
    if (config.alwaysAllowedList && config.alwaysAllowedList.length > 0) {
      config.alwaysAllowedList.forEach(domain => alwaysAllowed.add(domain.toLowerCase()));
    }
    
    if (mode === 'restricted') {
      // In restricted mode: block all domains in block list EXCEPT those in always-allowed list
      if (config.blockList && config.blockList.length > 0) {
        config.blockList.forEach(domain => {
          const lowerDomain = domain.toLowerCase();
          if (!alwaysAllowed.has(lowerDomain)) {
            blockedDomains.push(domain);
          } else {
            console.log(`[RulesEngine] Domain '${domain}' is in always-allowed list, not blocking during restricted mode`);
          }
        });
      }
    } else {
      // In allowed mode: block items in block list (they can still override allowed domains)
      // Also respect always-allowed list as an additional whitelist
      if (config.blockList && config.blockList.length > 0) {
        config.blockList.forEach(domain => {
          const lowerDomain = domain.toLowerCase();
          if (!alwaysAllowed.has(lowerDomain)) {
            blockedDomains.push(domain);
          } else {
            console.log(`[RulesEngine] Domain '${domain}' is in always-allowed list, not blocking during allowed mode`);
          }
        });
      }
    }
    
    return [...new Set(blockedDomains)]; // Remove duplicates
  }
  
  /**
   * Check if a schedule is currently active
   */
  isScheduleActive(schedule, currentTime, currentDayOfWeek) {
    // Check if today is in the schedule's days
    if (schedule.days && schedule.days.length > 0) {
      if (!schedule.days.includes(currentDayOfWeek)) {
        return false;
      }
    }
    
    const startTime = this.timeStringToMinutes(schedule.startTime);
    const endTime = this.timeStringToMinutes(schedule.endTime);
    
    if (startTime <= endTime) {
      // Normal schedule (e.g., 09:00-17:00)
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Overnight schedule (e.g., 20:00-07:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }
  
  /**
   * Convert time string (HH:MM) to minutes since midnight
   */
  timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  /**
   * Check if currently in restricted mode
   */
  isCurrentlyRestricted(config) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const currentDayOfWeek = now.getDay();
    
    if (!config.schedules || config.schedules.length === 0) {
      return false;
    }
    
    for (const schedule of config.schedules) {
      if (schedule.mode === 'restricted' && 
          this.isScheduleActive(schedule, currentTime, currentDayOfWeek)) {
        return true;
      }
    }
    
    return false;
  }
}
