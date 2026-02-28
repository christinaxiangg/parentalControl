# Parental Control Extension - Installation & Setup Guide

## Overview

This is a Chrome extension (Manifest V3) for parental control that provides:
- **Website Blocking**: Block specific domains
- **Time-Based Access Control**: Set restricted and allowed hours
- **Content Filtering**: Optional keyword-based filtering
- **Password Protection**: Secure settings with a master password
- **Activity Logging**: Optional log of blocked attempts
- **Local Privacy**: All data stays on the device, nothing is transmitted

## Installation

### For Manual Testing/Development

1. **Open Extension Management**
   - Go to `chrome://extensions/` in your Chrome address bar
   - Make sure "Developer mode" is enabled (toggle in top right)

2. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to this extension folder and select it
   - The extension should now appear in your extensions list

3. **Initial Setup**
   - The extension will automatically open the settings page on first install
   - Set a master password to protect your settings
   - Configure your block list, schedules, and preferences

### For Distribution

Package the extension files as a `.crx` file:
1. Go to `chrome://extensions/`
2. More tools → Create extension package...
3. Select this folder as the source
4. Click "Create package"

## Project Structure

```
parentalControl/
├── manifest.json           # Extension metadata and configuration
├── background.js           # Service worker with main logic
├── popup.html/js          # Quick access popup
├── options.html/js        # Full settings page
├── blocked.html           # Block page shown to users
├── logs.html              # Activity log viewer
├── content.js             # Content script for keyword filtering
├── rulesEngine.js         # Rule generation and scheduling logic
├── storageManager.js      # Storage and password management
├── README.md              # This file
└── icons/                 # Extension icons (recommended)
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## Configuration

### Blocking Rules

**Block List**
- Add domains to block (e.g., facebook.com, youtube.com)
- All subdomains are automatically blocked
- Example: Blocking "youtube.com" also blocks "m.youtube.com", "www.youtube.com", etc.

**Always Allowed List**
- Add domains that remain accessible during restricted hours
- Useful for educational resources or essential services

### Time-Based Schedules

Create recurring schedules to automatically switch between modes:

**Restricted Mode**
- Only domains in the Always Allowed list are accessible
- All other sites (including block list) are blocked
- Useful for: bedtime hours, study time, etc.

**Allowed Mode**  
- Normal browsing
- Sites in block list are blocked
- Always Allowed list is ignored
- Example schedule: Full access during school hours

**Features**
- Set start and end times (supports overnight schedules like 20:00-07:00)
- Select specific days of the week
- Multiple schedules can coexist

### Password Protection

**Master Password**
- Required to access settings
- On first install, you'll create your password
- Minimum 4 characters
- Stored as SHA-256 hash only (never plaintext)
- **No password recovery**: To reset, uninstall and reinstall the extension

**Security Notes**
- Password is hashed locally using Web Crypto API
- Settings cannot be accessed without the correct password
- Child users cannot change configuration

### Optional Features

**Keyword Filtering**
- Enable to scan page content for blocked keywords
- Pages containing keywords are blocked
- One keyword per line
- Content is scanned locally, never sent externally
- Performance impact: minimal

**Activity Logging**
- Optional tracking of blocked attempts
- Each log entry includes: URL, timestamp, reason
- Useful for monitoring
- Logs stored locally, can be exported as CSV
- Configurable size limit (default 1000 entries)

## Usage

### For Parents/Administrators

1. **Open Settings**
   - Click extension icon → Settings
   - Or right-click extension → Options

2. **Configure Restrictions**
   - Add domains to block
   - Set time-based schedules if desired
   - Add always-allowed sites

3. **Set Password**
   - Go to Security section
   - Create a strong master password
   - Click "Update Password"

4. **Monitor Activity** (if logging enabled)
   - Click "View Logs" from popup
   - See all blocked attempts
   - Export logs as CSV

### For Children

- Click extension icon to see current status
- Blocked sites show a "Access Blocked" page
- Cannot access settings without password
- Cannot remove the extension while restrictions are active (if policy-enforced)

## How It Works

### Block Detection

The extension uses Chrome's **declarativeNetRequest API** to:
1. Intercept network requests
2. Check against configured rules
3. Redirect blocked requests to blocked.html
4. All filtering happens locally and transparently

### Time-Based Control

- Evaluates current time and date
- Automatically applies correct rules
- Updates rules on:
  - Browser startup
  - When configuration changes
  - Every 60 seconds for time changes
- Uses device's local time (not synced)

### Content Filtering

- Optional keyword scanning via content script
- Only enabled if you turn it on
- Scans visible page text
- Never transmits content externally
- Runs on page load before full page render

## Permissions Explained

| Permission | Purpose | Why Needed |
|-----------|---------|-----------|
| `storage` | Save configuration locally | Must persist settings |
| `declarativeNetRequest` | Block websites | Core blocking functionality |
| `host_permissions` | Access all sites | Required to enforce blocking |
| `scripting` | Run content script | For keyword filtering (optional) |

## Troubleshooting

### Extension Not Working

1. Check if extension is enabled in `chrome://extensions/`
2. Verify the website domain you're trying to block (check the URL bar)
3. Clear browser cache if recently added blocks aren't working
4. No password set? First install should ask you to set one

### Can't Access Settings

1. The settings are password-protected
2. Enter your master password when prompted
3. Forgot password? You must:
   - Go to `chrome://extensions/`
   - Remove the extension
   - Reload the page
   - Re-add the extension
   - Set a new password
4. This erases all existing configuration

### Schedules Not Working

1. Ensure days of week are selected
2. Check that times are in 24-hour format (HH:MM)
3. Overnight schedules: end time must be less than start time (e.g., 22:00-06:00)
4. Verify browser is respecting system time

### Keyword Filtering Not Working

1. Enable keyword filtering in Settings
2. Add keywords you want to block (one per line)
3. The feature only blocks new page loads, not already-loaded pages
4. Be specific with keywords to avoid false positives

## Security Considerations

### What This Extension Does

✅ Blocks configured domains locally  
✅ Restricts access during scheduled hours  
✅ Filters optional keywords in pages  
✅ Logs blocked attempts locally  
✅ Protects settings with password  

### What This Extension DOES NOT Do

❌ Prevent technical users from removing it  
❌ Monitor other browsers or devices  
❌ Track user behavior externally  
❌ Prevent OS-level access to blocked content  
❌ Work across multiple user accounts (Chrome only)  
❌ Prevent other extensions from interfering  

### Best Practices

1. **Use a Strong Password**: At least 8 characters, mix of uppercase/lowercase/numbers
2. **Avoid Using Your Own Password**: Use something unique for the extension
3. **Monitor Activity**: Check logs regularly to see blocked attempts
4. **Combine with OS Controls**: Use Windows/Mac parental controls as well
5. **Keep Informed**: Stay aware of what sites children are visiting

## Data Privacy

- **All data is stored locally** in browser storage
- **No external transmission** of any data
- **No analytics or tracking** enabled by default
- **Uninstalling removes everything** - including all passwords and logs
- **Logs contain only URLs and timestamps**, no page content

## Limitations

- Only works in the browser where installed
- Cannot prevent:
  - Uninstalling the extension (child could remove it)
  - Using a different browser
  - VPN/proxy services to bypass
  - Guest mode or incognito browsing
  - If admin privileges are available on the computer

- Works best when combined with:
  - Operating system parental controls
  - Network-level filtering
  - Router-based parental controls
  - Regular monitoring and conversation

## Development

### File Descriptions

- **manifest.json**: Extension configuration (Manifest V3)
- **background.js**: Service worker handling main logic and messaging
- **rulesEngine.js**: Generates blocking rules and checks schedules
- **storageManager.js**: Manages configuration, password hashing, logging
- **popup.html/js**: Extension popup UI showing current status
- **options.html/js**: Full settings interface
- **content.js**: Page content scanning for keyword filtering
- **blocked.html**: The page shown when access is blocked
- **logs.html**: Activity log viewer interface

### Key Technologies

- **Manifest V3**: Latest Chrome extension architecture
- **declarativeNetRequest API**: Efficient network request blocking
- **Web Crypto API**: SHA-256 password hashing
- **Chrome Storage API**: Local data persistence
- **Content Scripts**: Optional keyword filtering

### Testing Recommendations

1. Test blocking with various domain patterns
2. Verify schedule switching at correct times
3. Test password protection works
4. Verify logs are recorded correctly
5. Test on different Chrome profiles
6. Confirm nothing breaks on browser restart

## Future Enhancement Ideas

- Remote management dashboard
- Multiple user profiles
- Advanced regex-based filtering
- Google Safe Browsing integration
- Breach notification alerts
- Usage statistics and reports
- Custom themes
- Multi-device sync

## Support & Issues

If you encounter issues:

1. **Check Chrome version**: Must support Manifest V3
2. **Verify extension installed**: Check chrome://extensions/
3. **Check error logs**: Open DevTools for extension (Details → Errors)
4. **Clear storage**: If configuration corrupted, uninstall and reinstall
5. **Disable conflicting extensions**: Other security extensions might interfere

## License

This extension is provided as-is for parental control purposes.

---

**Version**: 2.0  
**Last Updated**: February 28, 2026  
**Manifest Version**: 3
