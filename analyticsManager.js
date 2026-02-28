// Analytics Manager - Local analytics and event tracking
class AnalyticsManager {
  
  constructor() {
    this.events = [];
    this.maxEvents = 5000;
  }
  
  /**
   * Track an event
   */
  async trackEvent(eventType, data = {}) {
    try {
      const event = {
        type: eventType,
        timestamp: Date.now(),
        data: data
      };
      
      this.events.push(event);
      
      // Keep only recent events
      if (this.events.length > this.maxEvents) {
        this.events = this.events.slice(-this.maxEvents);
      }
      
      // Persist periodically
      if (this.events.length % 100 === 0) {
        await this.persistEvents();
      }
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }
  
  /**
   * Track blocked attempt
   */
  async trackBlockedAttempt(url, reason) {
    await this.trackEvent('blocked_attempt', {
      url: this.sanitizeUrl(url),
      reason: reason,
      domain: this.extractDomain(url)
    });
  }
  
  /**
   * Track setting change
   */
  async trackSettingChange(setting, oldValue, newValue) {
    await this.trackEvent('setting_changed', {
      setting: setting,
      oldValue: this.sanitizeValue(oldValue),
      newValue: this.sanitizeValue(newValue)
    });
  }
  
  /**
   * Track schedule activation
   */
  async trackScheduleActivation(scheduleIndex, mode) {
    await this.trackEvent('schedule_activated', {
      scheduleIndex: scheduleIndex,
      mode: mode
    });
  }
  
  /**
   * Track password attempt
   */
  async trackPasswordAttempt(success) {
    await this.trackEvent('password_attempt', {
      success: success
    });
  }
  
  /**
   * Generate usage report
   */
  async generateUsageReport(days = 7) {
    try {
      const events = await this.loadEvents();
      const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      const recentEvents = events.filter(e => e.timestamp > cutoffTime);
      
      const report = {
        period: `Last ${days} days`,
        generatedAt: new Date().toISOString(),
        totalEvents: recentEvents.length,
        eventTypes: this.groupEventsByType(recentEvents),
        blockedAttempts: this.analyzeBlockedAttempts(recentEvents),
        schedule: this.analyzeScheduleActivation(recentEvents),
        mostBlockedDomains: this.getMostBlockedDomains(recentEvents),
        blockReasons: this.getBlockReasons(recentEvents),
        dailyStats: this.getDailyStatistics(recentEvents),
        patterns: this.identifyPatterns(recentEvents)
      };
      
      return report;
    } catch (error) {
      console.error('Error generating usage report:', error);
      return null;
    }
  }
  
  /**
   * Analyze blocked attempts
   */
  analyzeBlockedAttempts(events) {
    const blocked = events.filter(e => e.type === 'blocked_attempt');
    
    return {
      total: blocked.length,
      unique_domains: new Set(blocked.map(e => e.data.domain)).size,
      by_reason: this.groupBy(blocked, e => e.data.reason)
    };
  }
  
  /**
   * Get most blocked domains
   */
  getMostBlockedDomains(events, limit = 10) {
    const blocked = events.filter(e => e.type === 'blocked_attempt');
    const domains = {};
    
    blocked.forEach(e => {
      const domain = e.data.domain;
      domains[domain] = (domains[domain] || 0) + 1;
    });
    
    return Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([domain, count]) => ({ domain, count }));
  }
  
  /**
   * Get block reasons distribution
   */
  getBlockReasons(events) {
    const blocked = events.filter(e => e.type === 'blocked_attempt');
    const reasons = {};
    
    blocked.forEach(e => {
      const reason = e.data.reason || 'unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });
    
    return reasons;
  }
  
  /**
   * Analyze schedule activations
   */
  analyzeScheduleActivation(events) {
    const scheduleEvents = events.filter(e => e.type === 'schedule_activated');
    
    return {
      total_activations: scheduleEvents.length,
      by_mode: this.groupBy(scheduleEvents, e => e.data.mode)
    };
  }
  
  /**
   * Get daily statistics
   */
  getDailyStatistics(events) {
    const daily = {};
    
    events.forEach(e => {
      const date = new Date(e.timestamp).toISOString().split('T')[0];
      if (!daily[date]) {
        daily[date] = { total: 0, blocked: 0, changes: 0 };
      }
      
      daily[date].total++;
      if (e.type === 'blocked_attempt') daily[date].blocked++;
      if (e.type === 'setting_changed') daily[date].changes++;
    });
    
    return daily;
  }
  
  /**
   * Identify patterns in blocking
   */
  identifyPatterns(events) {
    const patterns = {
      peakBlockTime: null,
      mostActiveDay: null,
      averageBlocksPerDay: 0
    };
    
    const blocked = events.filter(e => e.type === 'blocked_attempt');
    
    if (blocked.length === 0) {
      return patterns;
    }
    
    // Analysis would go here
    patterns.averageBlocksPerDay = Math.round(blocked.length / 7);
    
    return patterns;
  }
  
  /**
   * Group events by type
   */
  groupEventsByType(events) {
    return this.groupBy(events, e => e.type);
  }
  
  /**
   * Generic grouping utility
   */
  groupBy(items, keyFn) {
    const groups = {};
    
    items.forEach(item => {
      const key = keyFn(item);
      groups[key] = (groups[key] || 0) + 1;
    });
    
    return groups;
  }
  
  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname || urlObj.host || '';
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Sanitize URL for storage
   */
  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch (error) {
      return '';
    }
  }
  
  /**
   * Sanitize values for storage
   */
  sanitizeValue(value) {
    if (typeof value === 'string') {
      return value.substring(0, 100); // Limit string length
    }
    if (typeof value === 'object') {
      return '[object]';
    }
    return value;
  }
  
  /**
   * Persist events to storage
   */
  async persistEvents() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.set({ analytics_events: this.events }, resolve);
      });
    } catch (error) {
      console.error('Error persisting events:', error);
    }
  }
  
  /**
   * Load events from storage
   */
  async loadEvents() {
    try {
      return new Promise((resolve) => {
        chrome.storage.local.get('analytics_events', (result) => {
          resolve(result.analytics_events || []);
        });
      });
    } catch (error) {
      console.error('Error loading events:', error);
      return [];
    }
  }
  
  /**
   * Export analytics as JSON
   */
  async exportAnalytics() {
    try {
      const events = await this.loadEvents();
      const report = await this.generateUsageReport(30);
      
      return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        report: report,
        rawEvents: events
      };
    } catch (error) {
      console.error('Error exporting analytics:', error);
      return null;
    }
  }
  
  /**
   * Clear analytics data
   */
  async clearAnalytics() {
    try {
      this.events = [];
      return new Promise((resolve) => {
        chrome.storage.local.remove(['analytics_events'], resolve);
      });
    } catch (error) {
      console.error('Error clearing analytics:', error);
    }
  }
}
