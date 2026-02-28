# parentalControl
chrome extension for parental control




Software Requirements Specification (SRS)
Parental Control Extension for Google Chrome

Version: 2.0
Date: 2026-02-28

1. Purpose

The purpose of this extension is to enable a Parent/Guardian to manage and restrict access to websites within a Google Chrome browser profile. The system provides configurable website filtering, time-based access control, optional content filtering, and protected administrative settings.

The extension is intended to supplement, not replace, operating system-level or network-level parental control solutions.

2. Scope

The system is a client-side browser extension operating locally within Chrome using Manifest V3 architecture.

Core capabilities:

Domain-based website blocking

Time-based access scheduling

Optional keyword-based content filtering

Password-protected configuration

Local logging (optional)

The system does not provide cross-browser enforcement, device-wide control, or remote management.

3. User Roles
3.1 Administrator (Parent/Guardian)

Installs and configures the extension.

Sets block rules and schedules.

Manages password and settings.

Views logs (if enabled).

3.2 End User (Child)

Browses under configured restrictions.

Cannot access settings without authentication.

4. Functional Requirements
4.1 Website Blocking

FR1.1 The system shall allow the Administrator to maintain a domain-based block list.

FR1.2 The system shall block access to any domain or subdomain matching entries in the block list.

FR1.3 Blocking shall be implemented using the declarativeNetRequest API.

FR1.4 When a site is blocked, the system shall redirect the user to a customizable local block page.

FR1.5 Block rules shall update automatically when configuration changes.

4.2 Time-Based Access Control

FR2.1 The system shall allow the Administrator to define recurring daily schedules.

FR2.2 Each schedule shall include:

Start time

End time

Mode (Allowed or Restricted)

FR2.3 During Restricted hours:

All websites shall be blocked except those in the Always Allowed list.

FR2.4 The system shall automatically evaluate schedules using the local system time.

FR2.5 The system shall support overnight schedules (e.g., 20:00–07:00).

FR2.6 Rule updates shall occur automatically on:

Browser startup

Configuration changes

Periodic time checks

4.3 Always Allowed List

FR3.1 The system shall provide an Administrator-defined Always Allowed domain list.

FR3.2 Domains in this list shall remain accessible during Restricted hours.

4.4 Optional Keyword Filtering

FR4.1 The system may provide optional content-based filtering.

FR4.2 When enabled, the system shall scan visible page text using a content script.

FR4.3 If a keyword match is detected, the page shall be blocked.

FR4.4 Keyword filtering shall only operate when explicitly enabled.

FR4.5 Keyword scanning shall not transmit page content externally.

4.5 Settings Protection

FR5.1 The system shall require a master password for access to configuration settings.

FR5.2 During first installation, the Administrator shall create a master password.

FR5.3 The system shall store only a cryptographic hash of the password (not plaintext).

FR5.4 Password verification shall use secure hashing (e.g., SHA-256 via Web Crypto API).

FR5.5 The system shall not provide a password recovery mechanism.

FR5.6 Resetting the extension shall require uninstalling and reinstalling it, which will erase stored configuration data.

4.6 Logging (Optional)

FR6.1 The system may maintain a local log of blocked attempts.

FR6.2 Each log entry shall include:

Blocked URL

Timestamp (local time)

Reason for blocking

FR6.3 Logs shall be stored locally using browser storage.

FR6.4 Logs shall not include page content.

FR6.5 Logging shall be configurable (enabled/disabled).

4.7 User Interface

FR7.1 The system shall provide a settings interface accessible via the extension UI.

FR7.2 The interface shall allow management of:

Block list

Always Allowed list

Schedules

Keyword filtering

Logging

Password settings

FR7.3 Common tasks shall require minimal steps and be designed for non-technical users.

5. Non-Functional Requirements
5.1 Security (NFR-S)

The extension shall follow Manifest V3 standards.

The extension shall use declarativeNetRequest for rule enforcement.

The system shall request only minimum necessary permissions.

No data shall be transmitted externally by default.

All configuration data shall remain stored locally.

5.2 Performance (NFR-P)

The extension shall not introduce noticeable page load delay.

Blocking logic shall operate asynchronously.

Rule evaluation shall not block the UI thread.

5.3 Reliability (NFR-R)

Rules shall persist across browser restarts.

The system shall reinitialize automatically on startup.

Configuration changes shall take effect without requiring browser restart.

5.4 Usability (NFR-U)

The interface shall be intuitive.

Common administrative actions shall be achievable in three or fewer steps.

5.5 Maintainability (NFR-M)

The codebase shall follow modular architecture:

Background service worker

Rules engine module

UI module

Optional content scripts

The rules engine shall be independently testable.

6. Permissions Required

The extension shall request only the following permissions, with justification:

6.1 declarativeNetRequest

Required for secure, rule-based network request blocking.

6.2 storage

Required to persist configuration data locally.

6.3 Host Permissions (If Required)

Limited to enabling rule-based filtering. Scope shall be minimized.

6.4 scripting (Conditional)

Required only if keyword filtering is enabled.

7. System Constraints

The extension operates only within Chromium-based browsers supporting Manifest V3.

The system does not prevent manual uninstallation unless deployed in a managed device environment.

The system does not provide operating system-level enforcement.

8. Assumptions

The child primarily uses the browser where the extension is installed.

The Administrator has installation privileges on the device.

The system device time is accurate.

9. Limitations

The extension cannot control other browsers.

The extension cannot prevent OS-level access without external enforcement mechanisms.

Removal of the extension will remove all locally stored configuration.

10. Future Enhancements (Out of Current Scope)

Remote management dashboard.

Multi-profile support.

Advanced rule engine with regex-based filtering.

Enterprise-managed deployment policies.

Reporting analytics dashboard.

This version is:

Technically aligned with Manifest V3.

Security-conscious.

Realistic about browser capabilities.

Clear enough for implementation.

Structured like a professional engineering document.







