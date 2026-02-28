# Security Documentation - Parental Control Extension

## Security Architecture Overview

This document outlines the security measures, threat model, and mitigation strategies for the Parental Control extension.

---

## 1. Threat Model

### Potential Threats

#### 1.1 Cross-Site Scripting (XSS)
**Threat**: Attacker injects malicious code through configuration inputs
- Domain names containing script tags
- Keyword filters with malicious payloads
- Log entries with injected HTML

**Mitigation**:
- ✅ All HTML output escaped using SecurityHelper.escapeHtml()
- ✅ Input validation with ConfigValidator
- ✅ Content Security Policy (CSP) in manifest
- ✅ No innerHTML usage - only textContent

#### 1.2 Message Injection
**Threat**: Malicious content script sends fake messages to background

**Mitigation**:
- ✅ Sender validation: SecurityHelper.isValidMessageSender()
- ✅ Origin checking: Only chrome-extension:// allowed
- ✅ Message structure validation
- ✅ Rate limiting: 100 messages/min per sender
- ✅ Message signing support (foundation laid)

#### 1.3 Storage Attacks
**Threat**: User data corruption or overflow

**Mitigation**:
- ✅ Storage quota monitoring
- ✅ Graceful overflow handling
- ✅ Old log auto-cleanup
- ✅ Configuration validation before save
- ✅ Error handling on all storage operations

#### 1.4 Configuration Tampering
**Threat**: Invalid or malicious configuration accepted

**Mitigation**:
- ✅ Comprehensive ConfigValidator
- ✅ Type checking on all fields
- ✅ Array bounds validation
- ✅ Schedule conflict detection
- ✅ Duplicate entry prevention

#### 1.5 Denial of Service (DoS)
**Threat**: Large inputs crash extension

**Mitigation**:
- ✅ Rule count limits (30,000 max)
- ✅ Domain list limits (10,000 max)
- ✅ Keyword limit (1,000 max)
- ✅ Log entry limits (configurable, max 100,000)
- ✅ Text scanning limited to 100KB

#### 1.6 Privilege Escalation
**Threat**: Child user gains admin access

**Mitigation**:
- ✅ SHA-256 password hashing
- ✅ Settings page requires password
- ✅ No password recovery option (by design)
- ✅ Message validation prevents unauthorized actions

#### 1.7 Data Exfiltration
**Threat**: User data sent to external server

**Mitigation**:
- ✅ Zero external network calls
- ✅ Content Security Policy blocks external resources
- ✅ No analytics server integration
- ✅ All storage purely local
- ✅ Analytics locally only

---

## 2. Security Controls

### 2.1 Input Validation

#### Domain Validation
```javascript
// Regex: /^([a-z0-9-]+\.)+[a-z0-9]{2,}$/i
// Prevents: SQL injection, special chars, malformed domains
// Example Valid: google.com, mail.example.co.uk
// Example Invalid: <script>, example, 127.0.0.1
```

#### Time Format Validation
```javascript
// Regex: /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
// Validates 24-hour format strictly
// Prevents: Invalid schedules, parsing errors
```

#### Password Validation
```javascript
// Requirements: 4-128 characters
// No character restrictions (allows symbols, unicode)
// No common password list (intentional - flexibility)
```

#### Keyword Validation
```javascript
// Removes: < > (HTML-like characters)
// Validates: Max 1000 keywords per config
// Prevents: ReDoS attacks via regex
```

### 2.2 Output Encoding

#### HTML Escaping
```javascript
// SecurityHelper.escapeHtml(text)
// Maps: & < > " ' to HTML entities
// Used in: UI rendering, log display
// Protection: Prevents stored XSS
```

#### URL Sanitization
```javascript
// SecurityHelper.sanitizeUrl(url)
// Validates: URL format, protocol (http/https only)
// Prevents: javascript: protocol attacks
// Used in: Logging, display
```

### 2.3 Authentication & Authorization

#### Password Security
- **Hashing**: SHA-256 via Web Crypto API
- **Storage**: Hash only, never plaintext
- **Verification**: Hash comparison
- **Salt**: N/A (single user, local only)
- **Iteration**: Single pass (fast for single-user system)

#### Access Control
- **Settings Page**: Password required on first access
- **Admin Operations**: Implicit - whoever has password
- **Child Isolation**: Can browse but cannot change settings

### 2.4 Data Protection

#### Configuration Backup
```javascript
// Export format:
{
  "version": "2.0",
  "timestamp": "ISO-8601",
  "config": { /* full config */ },
  "note": "Password not included - set new one on import"
}
```

#### Storage Limits
- **Config**: ~50KB typical
- **Logs**: Configurable max (default 1000 entries, ~500KB)
- **Analytics**: 5000 events max
- **Total**: Designed to fit in 10MB quota easily

---

## 3. Code Security Practices

### 3.1 Content Security Policy

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:"
}
```

**Explanation**:
- `script-src 'self'`: Only extension scripts, no eval()
- `object-src 'self'`: No plugins
- `style-src 'self' 'unsafe-inline'`: Extension styles (safe for inline)
- `img-src`: Local and data URIs only

### 3.2 Memory Safety

#### Secure Cleanup
```javascript
// Clear sensitive data
function logout() {
  currentPassword = null;
  sensitiveData = undefined;
}

// Cache cleanup
cacheManager.delete('password_hash');
```

#### Bounds Checking
```javascript
// Array limits enforced
if (config.blockList.length >= 10000) {
  throw new Error('Block list full');
}
```

### 3.3 Dependency Management

**Current Dependencies**: None
- Pure JavaScript implementation
- Chrome extension APIs only
- Web Crypto API for hashing
- Standard ES6+ features

**Security Benefit**: No supply chain attacks possible

---

## 4. Manifest V3 Security

### 4.1 Permissions Minimization

| Permission | Purpose | Why Needed | Risk Level |
|-----------|---------|-----------|-----------|
| `storage` | Local config | Configuration persistence | Low |
| `declarativeNetRequest` | Network blocking | Core blocking feature | Low |
| `host_permissions` (all_urls) | Rule application | Must apply to all sites | Medium |
| `scripting` | Content injection | Keyword filtering | Medium |

**Principle**: Request minimum necessary permissions

### 4.2 Content Script Sandboxing

- **Isolated world**: Content scripts have separate context
- **DOM access only**: Cannot access page JavaScript
- **Message passing**: Structured communication channel
- **Origin validation**: Only messages from extension accepted

### 4.3 Service Worker Security

- **Persistent script removed**: Can't eavesdrop continuously
- **Message-based**: Stateless design reduces bugs
- **Quota limits**: Storage automatically managed
- **Permissions**: CSP applied to extension pages

---

## 5. Network Security

### 5.1 No External Communication

**Design Principle**: Zero external network calls
- No analytics server
- No update checking
- No telemetry
- No "phone home" functionality

**Implementation**:
- CSP blocks external resources
- No `fetch()` or `XMLHttpRequest` to external URLs
- Analytics local-only

### 5.2 HTTPS-Only

When extension performs any network action (future):
- Force HTTPS only
- Certificate pinning (future)
- Timeout on slow connections

---

## 6. Encryption & Hashing

### 6.1 Password Hashing

```javascript
async hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return hexString;
}
```

**Algorithm**: SHA-256 (256-bits)
**Performance**: ~1-5ms per hash
**Security**: Cryptographically secure

**Future Improvements**:
- HMAC-SHA256 with salt
- Argon2 hashing (when available in Web Crypto)
- Key derivation for sensitive data

### 6.2 Data at Rest

- **Config**: Plaintext in Chrome storage (browser-protected)
- **Password Hash**: Hashed with SHA-256
- **Logs**: Plaintext (non-sensitive)
- **Analytics**: Plaintext, local only

**Threat**: If device compromised, all data accessible
**Mitigation**: Browser-level encryption (Chrome User Data Encryption)

---

## 7. Error Handling Security

### 7.1 Error Disclosure

**Principle**: Avoid information leakage in error messages

```javascript
// Good: Generic error
sendResponse({ error: 'Configuration error' });
// Bad: Specific errors could leak info
sendResponse({ error: 'Password hash mismatch at byte 5' });
```

### 7.2 Error Logging

- Errors logged locally only
- Stack traces in development console
- Production: Generic messages to users
- Analytics: Anonymous error tracking

---

## 8. Testing for Security

### 8.1 Security Test Cases

**XSS Tests**:
- Inject script tags in domains
- Inject event handlers in keywords
- HTML in logs

**Injection Tests**:
- SQL-like syntax in domains
- Code injection in schedules
- Buffer overflow with large inputs

**Authentication Tests**:
- Wrong password rejected
- Timing attack resistance
- Rate limiting on wrong password

**Authorization Tests**:
- Settings locked without password
- Operations fail without auth
- Admin actions logged

### 8.2 Manual Security Review

- [ ] Code review for privilege escalation
- [ ] Manual XSS testing with payloads
- [ ] Fuzzing with random inputs
- [ ] Memory leak detection
- [ ] Extension permissions audit

---

## 9. Incident Response

### 9.1 If Security Issue Found

1. **Quantify**: Determine scope and impact
2. **Develop Fix**: Create security patch
3. **Test**: Thorough testing before release
4. **Release**: Auto-update via Chrome Web Store
5. **Document**: Post-mortem in SECURITY_UPDATES.md

### 9.2 Security Update Process

- Users auto-updated within 24-48 hours
- Forces update if critical
- Transparent changelog
- No silent security fixes

---

## 10. Best Practices for Users

### 10.1 Installation Security

- Install from Chrome Web Store only
- Check extension permissions
- Verify publisher (Parental Control Extension)
- Review source code on GitHub

### 10.2 Configuration Security

- Set strong, unique password (8+ characters)
- Regularly review block list
- Monitor activity logs
- Test restrictions to ensure working

### 10.3 Storage Security

- Use encrypted hard drive
- Enable device password
- Keep browser updated and extended
- Periodically backup configuration

---

## 11. Known Security Limitations

### 11.1 What This Extension Cannot Prevent

- ❌ Other browsers (use OS parental controls)
- ❌ VPN/Proxy bypass (network-level control needed)
- ❌ Extension removal by tech-savvy user
- ❌ OS-level access (use OS controls)
- ❌ Device theft (use device encryption)

### 11.2 Recommendations for Defense in Depth

1. **OS-Level**: Windows/Mac parental controls
2. **Router-Level**: Parental controls on gateway
3. **Device-Level**: This extension
4. **Behavioral**: Regular monitoring and conversation

---

## 12. Security Roadmap

### Near-term (Next Release)
- [ ] HMAC-SHA256 password hashing
- [ ] Audit with security firm
- [ ] Automated security tests
- [ ] Security policy document

### Mid-term (Next 2 Releases)
- [ ] Two-factor authentication
- [ ] Encrypted configuration export
- [ ] Security event alerts
- [ ] Detailed permission explanations

### Long-term
- [ ] Hardware security key support
- [ ] Multi-user profiles with different passwords
- [ ] Advanced behavioral analysis
- [ ] Integration with OS security APIs

---

## 13. Security Disclosure

### Responsible Disclosure

If you find a security issue:
1. **Do not** publicly disclose
2. Email: security@example.com (placeholder)
3. Include: Description, steps to reproduce, impact
4. Allow: 90 days for patch before public disclosure

### Historical Vulnerabilities

**As of February 28, 2026**: No known public vulnerabilities

---

## 14. Compliance & Standards

### Applicable Standards
- **OWASP Top 10**: Mitigated for relevant items (client-side)
- **NIST Cybersecurity**: Some controls implemented
- **Chrome Web Store Policies**: Fully compliant

### Privacy Standards
- **GDPR**: N/A (no personal data collected)
- **CCPA**: N/A (no data sold)
- **Privacy Shield**: N/A (no external data transfer)

---

## References

- [OWASP: Client-Side Security](https://owasp.org/www-project-cheat-sheets/)
- [Chrome Extensions Security](https://developer.chrome.com/docs/extensions/mv3/security/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

**Document Version**: 2.0
**Last Updated**: February 28, 2026
**Status**: APPROVED FOR PRODUCTION

---

> "Security is a process, not a product." - Bruce Schneier
