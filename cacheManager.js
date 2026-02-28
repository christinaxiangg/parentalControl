// Cache Manager - Implements caching with TTL support
class CacheManager {
  constructor(ttlMs = 5 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttlMs; // Time to live in milliseconds
  }
  
  /**
   * Get cached value if valid
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  /**
   * Set value in cache
   */
  set(key, value, customTtl = null) {
    const ttl = customTtl !== null ? customTtl : this.ttl;
    
    this.cache.set(key, {
      value: value,
      expiry: Date.now() + ttl,
      timestamp: Date.now()
    });
  }
  
  /**
   * Check if key exists and is valid
   */
  has(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete specific cache entry
   */
  delete(key) {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }
  
  /**
   * Clear expired entries
   */
  prune() {
    const now = Date.now();
    let prunedCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        prunedCount++;
      }
    }
    
    return prunedCount;
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      ttl: this.ttl,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.expiry - Date.now()
      }))
    };
  }
  
  /**
   * Get or compute value
   */
  async getOrCompute(key, computeFn, customTtl = null) {
    const cached = this.get(key);
    
    if (cached !== null) {
      return cached;
    }
    
    const value = await computeFn();
    this.set(key, value, customTtl);
    return value;
  }
}

// Create singleton instance
const cacheManager = new CacheManager();
