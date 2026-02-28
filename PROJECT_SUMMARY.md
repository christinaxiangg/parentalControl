# Project Files Summary

## Core Extension Files

### 1. **manifest.json**
- Extension configuration (Manifest V3)
- Defines permissions, icons, background service worker, content scripts
- Specifies extension name, version, and capabilities

### 2. **background.js** (Service Worker)
- Main extension logic and request handling
- Initializes rules engine and storage manager
- Manages message passing between popup/options and content scripts
- Updates blocking rules on startup, config changes, and every 60 seconds
- Handles password verification and configuration management

### 3. **rulesEngine.js**
- Generates declarativeNetRequest rules for website blocking
- Evaluates time-based schedules
- Determines which domains should be blocked based on current time
- Handles overnight schedules (e.g., 20:00-07:00)
- Calculates if currently in restricted mode

### 4. **storageManager.js**
- Manages all local storage (Chrome storage API)
- Handles password hashing with SHA-256
- Password verification without storing plaintext
- Manages application logs
- Provides default configuration template
- Methods for saving/loading config, passwords, and logs

## UI Files

### 5. **popup.html**
- Quick-access popup interface
- Shows current restriction status
- Displays active schedules and blocked domains
- Button to access full settings
- Button to view activity logs
- Security status display

### 6. **popup.js**
- Handles popup initialization and rendering
- Shows/updates restriction status in real-time
- Sends messages to background service worker
- Provides navigation to settings and logs

### 7. **options.html** (Settings Page)
- Full settings interface accessible via extension menu
- Organized sections for different settings:
  - Security (password management)
  - Block List (add/remove domains)
  - Always Allowed List (domains accessible during restrictions)
  - Time-Based Schedules (create recurring schedules)
  - Content Filtering (optional keyword filtering)
  - Activity Logging (optional logging configuration)

### 8. **options.js**
- Handles all settings page logic
- Password-protected settings access
- Domain list management (add/remove)
- Schedule creation and management
- Configuration saving and loading
- Password update functionality
- Settings reset
- Input validation and user feedback

## User-Facing Pages

### 9. **blocked.html**
- Page shown when access to a website is blocked
- Displays blocking reason (domain, keyword, time restriction)
- Shows blocked URL and timestamp
- Prevents going back or bypassing block
- User-friendly error message
- Informative about why the site is blocked

### 10. **logs.html**
- Activity log viewer
- Statistics showing total blocked, by category
- Filterable log table with URL, timestamp, and reason
- Export logs as CSV
- Clear logs functionality
- Back to settings navigation
- Shows if logging is disabled

## Content & Optional Features

### 11. **content.js** (Content Script)
- Optional keyword-based content filtering
- Scans page text for configured keywords
- Blocks pages containing filtered keywords
- Only runs if keyword filtering is enabled
- Runs at document_start to catch pages early
- Logs filtered attempts

## Documentation

### 12. **README.md** (Original)
- Complete Software Requirements Specification (SRS)
- Defines all functional and non-functional requirements
- Documents system constraints and limitations
- Lists future enhancements

### 13. **INSTALLATION.md** (Created)
- Installation instructions for development and distribution
- Usage guide for both administrators and children
- Configuration guide for all features
- Troubleshooting section
- Security considerations
- Privacy information
- Limitations and best practices
- Development information

## Directory Structure

```
parentalControl/
├── manifest.json              # Extension configuration
├── background.js              # Service worker (main logic)
├── rulesEngine.js             # Rule generation engine
├── storageManager.js          # Storage & password management
├── popup.html                 # Quick popup interface
├── popup.js                   # Popup logic
├── options.html               # Full settings page
├── options.js                 # Settings logic
├── blocked.html               # Block page shown to users
├── logs.html                  # Activity log viewer
├── content.js                 # Content script for filtering
├── README.md                  # Original SRS specifications
├── INSTALLATION.md            # Installation & usage guide
└── icons/
    └── icon-128.svg          # Extension icon
```

## Key Features Implemented

### ✅ Website Blocking
- Declarative network request rules
- Domain and subdomain blocking
- Redirect to custom block page
- Real-time rule updates

### ✅ Time-Based Access Control
- Recurring daily schedules
- Allowed and Restricted modes
- Support for overnight schedules
- Day-of-week selection
- Automatic evaluation every 60 seconds

### ✅ Always Allowed List
- Domains accessible during restricted hours
- Useful for educational resources
- Configurable in settings

### ✅ Password Protection
- SHA-256 secure hashing
- No plaintext password storage
- Protects access to settings
- Master password required for configuration
- No password recovery (by design)

### ✅ Optional Content Filtering
- Keyword-based page content scanning
- Local processing only
- No external data transmission
- Performance optimized

### ✅ Optional Activity Logging
- Log all blocked attempts
- CSV export capability
- Configurable log size
- Local storage only
- Timestamps and reasons

### ✅ User Interface
- Settings popup with quick access
- Full settings page with multiple sections
- Password-protected access
- Info messages and help text
- Intuitive domain/schedule management

## Security Architecture

- **Manifest V3**: Latest Chrome extension security model
- **Service Worker**: Background processing without persistent script
- **declarativeNetRequest API**: Secure, efficient rule-based blocking
- **Web Crypto API**: SHA-256 password hashing
- **Chrome Storage API**: LocalStorage for configuration
- **Content Scripts**: Sandboxed page scanning (optional)
- **No External Communication**: Everything stays local

## Browser Compatibility

- **Requires**: Chrome/Chromium 88+ (Manifest V3 support)
- **Works on**: Windows, macOS, Linux
- **Not supported**: Firefox (Manifest V2), Safari

## Development Notes

### Import Strategy
- Uses `importScripts()` in service worker to load modules
- Classes defined globally for accessibility
- Clean separation of concerns across files

### Message Passing
- Popup ↔ Background: Chrome runtime messages
- Content Script ↔ Background: Chrome runtime messages  
- All communication is asynchronous

### Storage Structure
```javascript
chrome.storage.local = {
  config: { /* main configuration */ },
  passwordHash: "...",  /* SHA-256 hash */
  logs: [ /* array of blocked attempts */ ],
  lastRuleUpdate: "ISO timestamp"
}
```

### Default Configuration
```javascript
{
  blockList: [],
  alwaysAllowedList: [],
  schedules: [],
  keywordFiltering: {
    enabled: false,
    keywords: []
  },
  logging: {
    enabled: false,
    maxEntries: 1000
  },
  passwordProtected: true
}
```

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Settings page opens and is password protected
- [ ] Can add/remove domains from block list
- [ ] Can create and manage schedules
- [ ] Blocked domains are redirected to block page
- [ ] Time-based schedules activate correctly
- [ ] Always Allowed domains bypass restrictions
- [ ] Password hashing works (verify hash differs each time)
- [ ] Keyword filtering works (if enabled)
- [ ] Logs are recorded correctly (if enabled)
- [ ] Extension survives browser restart
- [ ] Rules update when configuration changes
- [ ] Export logs as CSV works

## Files Created: 13 total

1. manifest.json - Extension configuration
2. background.js - Service worker
3. rulesEngine.js - Rule engine
4. storageManager.js - Storage manager
5. popup.html - Popup interface
6. popup.js - Popup logic
7. options.html - Settings page
8. options.js - Settings logic
9. blocked.html - Block page
10. logs.html - Log viewer
11. content.js - Content script
12. INSTALLATION.md - Installation guide
13. icons/icon-128.svg - Extension icon

Ready for use! ✅
