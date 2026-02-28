# Testing Guide - Parental Control Extension Improvements

## Quick Start Testing

### 1. Security Testing

#### XSS Prevention Tests
```javascript
// Test payload in domain input
// Try: <script>alert('xss')</script>
// Expected: Should reject or sanitize

// Test in popup/lists
// Try: <img src=x onerror=alert('xss')>
// Expected: Should be escaped in display
```

#### Message Validation Tests
```javascript
// Open DevTools Console and run:
chrome.runtime.sendMessage(
  { invalidMessage: 'no type field' },
  (response) => console.log(response)
);

// Expected: Should get error about invalid format
```

#### Rate Limiting Tests
```javascript
// Send 150 messages in quick succession
// Expected: After 100, remaining should be rate-limited
```

---

### 2. Configuration Validation Tests

#### Domain Validation
| Input | Expected Result | Status |
|-------|-----------------|--------|
| `google.com` | ✅ Allowed | Valid domain |
| `facebook.com` | ✅ Allowed | Valid domain |
| `invalid` | ❌ Rejected | Single word |
| `<script>` | ❌ Rejected | Special chars |
| `example.c` | ✅ Allowed | Valid TLD |
| `192.168.1.1` | ❌ Rejected | IP not domain |

#### Time Format Validation
| Input | Expected Result |
|-------|-----------------|
| `09:00` | ✅ Valid (24h format) |
| `25:00` | ❌ Invalid (hour > 23) |
| `09:60` | ❌ Invalid (minutes > 59) |
| `9:0` | ❌ Invalid (missing leading 0) |
| `09:00 PM` | ❌ Invalid (not 24h) |

#### Password Validation
| Input | Expected Result |
|-------|-----------------|
| `test` | ✅ Valid (4 chars) |
| `abc` | ❌ Invalid (< 4 chars) |
| `a` * 129 chars | ❌ Invalid (> 128 chars) |
| `my$ecure1Pass` | ✅ Valid (any charset ok) |

---

### 3. Error Handling Tests

#### Storage Error Recovery
1. Go to `chrome://settings/siteData`
2. Clear one extension's stored data while extension is running
3. Open options page
4. **Expected**: Extension recovers with default config

#### Rule Update Error Handling
1. Open DevTools for extension background
2. Add a domain and save
3. **Expected**: Should see "Rule update: X rules applied" or error with retry

#### Configuration Validation Errors
1. Open options page
2. Try to add:
   - Domain: `invalid`
   - **Expected**: "Invalid domain format" warning

---

### 4. Caching Tests

#### Rules Cache Validation
```javascript
// Open DevTools for background
// Add domain, watch rule update (first time)
// Wait and add another domain
// Observe: Rules regenerated, cache updated

// View cache stats:
console.log(cacheManager.getStats());
```

#### Cache Expiry Test
1. Add domain (caches rules)
2. Wait 5+ minutes
3. Refresh page
4. Add another domain
5. **Expected**: New rules generated (cache expired)

---

### 5. Analytics Tests

#### Event Tracking
```javascript
// Check analytics in storage:
chrome.storage.local.get('analytics_events', (result) => {
  console.log('Events:', result.analytics_events);
});

// Should include:
// - extension_installed
// - password_changed
// - config_saved
// - blocked_attempt (when site blocked)
```

#### Report Generation
```javascript
// Generate usage report:
const report = await analyticsManager.generateUsageReport(7);
console.log(report);

// Should include:
// - totalEvents count
// - eventTypes breakdown
// - blockedAttempts with domains
// - mostBlockedDomains list
```

---

### 6. Input Sanitization Tests

#### Domain Sanitization
```javascript
// Test inputs:
ConfigValidator.sanitizeDomain('  EXAMPLE.COM  ');
// Expected: 'example.com'

ConfigValidator.sanitizeDomain('Example.COM');
// Expected: 'example.com'
```

#### Keyword Sanitization
```javascript
ConfigValidator.sanitizeKeyword('  Dangerous<script>  ');
// Expected: 'dangerousscript' (< > removed)
```

---

## Manual Testing Scenarios

### Scenario 1: Initial Setup
1. Install extension
2. Settings page should open automatically
3. Set password: "test123"
4. Add domains: facebook.com, youtube.com
5. Create schedule:
   - Restricted: 20:00 - 07:00
   - Select: Mon-Fri
6. Enable logging
7. Click Save

**Expected**:
- ✅ Password accepted
- ✅ Domains validated
- ✅ Schedule created
- ✅ Popup shows current status
- ✅ Settings page password-protected

---

### Scenario 2: Configuration Import/Export
1. Export configuration (button in Settings)
2. Download file: `parental-control-backup-*.json`
3. Open file - should see JSON with config
4. Create new config
5. Import that file
6. Config should be restored

**Expected**:
- ✅ Export produces valid JSON
- ✅ Version info included
- ✅ Import validates structure
- ✅ Settings reload after import

---

### Scenario 3: Performance with Large Block List
1. Create file with 5000 domains (python script):
```python
with open('domains.txt', 'w') as f:
    for i in range(5000):
        f.write(f'test{i}.example.com\n')
```

2. Paste all into block list
3. Click Save

**Expected**:
- ✅ Should warn about performance
- ✅ Save completes within 5 seconds
- ✅ Rules applied without lag
- ✅ Popup renders quickly

---

### Scenario 4: Storage Quota Handling
1. Enable logging
2. Add 100+ domains to block list
3. Create 10+ schedules
4. View logs (should be auto-pruned)

**Expected**:
- ✅ Extension warns about quota
- ✅ Old logs automatically removed
- ✅ Settings still save successfully
- ✅ No crashes or hangs

---

### Scenario 5: Content Filtering
1. Enable keyword filtering
2. Add keywords: "badword1", "badword2"
3. During restricted hours, visit website with badword1 in content
4. Check logs

**Expected**:
- ✅ Page redirects to blocked.html
- ✅ Reason shows "Content Filtered"
- ✅ Log entry created with keyword
- ✅ During allowed hours: page loads normally

---

## Automated Testing Examples

### Jest Test Examples

```javascript
// __tests__/configValidator.test.js
describe('ConfigValidator', () => {
  test('validates domain format', () => {
    expect(ConfigValidator.isValidDomain('google.com')).toBe(true);
    expect(ConfigValidator.isValidDomain('invalid')).toBe(false);
    expect(ConfigValidator.isValidDomain('<script>')).toBe(false);
  });

  test('validates time format', () => {
    expect(ConfigValidator.isValidTimeFormat('09:00')).toBe(true);
    expect(ConfigValidator.isValidTimeFormat('25:00')).toBe(false);
    expect(ConfigValidator.isValidTimeFormat('9:0')).toBe(false);
  });

  test('sanitizes domain input', () => {
    expect(ConfigValidator.sanitizeDomain('  EXAMPLE.COM  ')).toBe('example.com');
  });

  test('validates complete config', () => {
    const config = {
      blockList: ['google.com'],
      alwaysAllowedList: [],
      schedules: [{
        mode: 'restricted',
        startTime: '20:00',
        endTime: '07:00',
        days: [1, 2, 3]
      }],
      keywordFiltering: { enabled: false, keywords: [] },
      logging: { enabled: true, maxEntries: 1000 }
    };
    
    const result = ConfigValidator.validate(config);
    expect(result.isValid).toBe(true);
  });
});
```

---

## Performance Benchmarks

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Popup load | < 500ms | TBD |
| Settings page load | < 1s | TBD |
| Rules generation (1000 domains) | < 2s | TBD |
| Message round-trip | < 100ms | TBD |
| Memory footprint | < 50MB | TBD |

### Measuring Performance

```javascript
// Measure popup load time
console.time('popup-load');
// ... initialization code ...
console.timeEnd('popup-load');

// Measure rule generation
console.time('generate-rules');
const rules = await rulesEngine.generateRules(config);
console.timeEnd('generate-rules');
console.log(`Generated ${rules.length} rules`);

// Check memory usage
chrome.runtime.getBackgroundPage(bg => {
  console.log(performance.memory);
});
```

---

## Debugging Tools

### Check Extension Logs
1. Go to `chrome://extensions`
2. Find Parental Control
3. Click "Details"
4. Click "Errors" to see console errors
5. Or click "Background page" for live debugging

### Monitor Storage
```javascript
// Check all stored data
chrome.storage.local.get(null, (items) => {
  console.log('Storage:', items);
});

// Check only config
chrome.storage.local.get('config', (result) => {
  console.log('Config:', result.config);
});

// Get storage stats
chrome.storage.local.getBytesInUse(null, (bytes) => {
  console.log(`Using ${bytes / 1024}KB of storage`);
});
```

### Monitor Network (Declarative Net Request)
1. No network tab shows because rules are declarative
2. Check logs to see what's blocked:
```javascript
chrome.storage.local.get('logs', (result) => {
  result.logs.forEach(log => {
    console.log(`${log.timestamp}: ${log.url} (${log.reason})`);
  });
});
```

---

## Known Issues & Workarounds

### Issue: Password not working after update
**Workaround**: 
1. Uninstall extension
2. Reinstall extension
3. Set new password

### Issue: Rules not applying immediately
**Workaround**:
1. Refresh page after setting config
2. Wait up to 1 minute for automatic refresh
3. Check extension status in popup

### Issue: Large domain lists slow down extension
**Workaround**:
1. Split into multiple configurations
2. Use schedules instead of always-blocked
3. Limit to max 5000 domains per list

---

## Regression Testing Checklist

Before each release:

- [ ] Popup displays current status
- [ ] Settings page opens with password protection
- [ ] Can add/remove domains from block list
- [ ] Can create/edit schedules
- [ ] Schedules activate at correct times
- [ ] Always Allowed domains bypass restrictions
- [ ] Blocked sites redirect to blocked.html
- [ ] Logs record blocked attempts
- [ ] Can export/import configuration
- [ ] Rules update on config change
- [ ] Extension survives browser restart
- [ ] No console errors in background page
- [ ] Storage usage within reasonable limits
- [ ] Analytics events are tracked
- [ ] Password hashing works correctly

---

**Last Updated**: February 28, 2026
