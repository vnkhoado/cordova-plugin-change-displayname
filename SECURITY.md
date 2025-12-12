# Security Documentation

## Overview

Version 2.6.0 introduces comprehensive security improvements to protect your app's build information and user data.

---

## 🔒 Security Features

### 1. Namespace Protection

**Problem (v2.5.0 and earlier)**:
```javascript
// ❌ Global variables vulnerable to tampering
window.APP_BUILD_INFO = { ... };  // Can be overwritten
window.updateAppUserData = function() {};  // Can be replaced
```

**Solution (v2.6.0+)**:
```javascript
// ✅ Protected namespace
window.AppBuildInfo = {
  getData: function() { ... },
  updateUserData: function() { ... }
};

Object.freeze(window.AppBuildInfo);  // Cannot be modified
```

**Benefits**:
- Prevents malicious code from overwriting functions
- Protects against XSS attacks
- Returns immutable copies of data
- Third-party libraries cannot tamper with API

### 2. Input Validation

**Problem**: No validation of user input could lead to:
- SQL injection (if queries were not parameterized)
- DoS attacks via oversized data
- Invalid characters in keys

**Solution**:
```javascript
// Key validation
var MAX_KEY_LENGTH = 255;
var KEY_PATTERN = /^[a-zA-Z0-9_.-]+$/;  // Only safe characters

function validateKey(key) {
  if (typeof key !== 'string') {
    throw new Error('Key must be a string');
  }
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) {
    throw new Error('Key length must be between 1 and ' + MAX_KEY_LENGTH);
  }
  if (!KEY_PATTERN.test(key)) {
    throw new Error('Key contains invalid characters');
  }
  return true;
}

// Value size validation
var MAX_VALUE_SIZE = 10000; // 10KB limit

function validateValue(value) {
  var jsonValue = JSON.stringify(value);
  if (jsonValue.length > MAX_VALUE_SIZE) {
    throw new Error('Value size exceeds limit');
  }
  return jsonValue;
}
```

**Protections**:
- ✅ Prevents oversized data from filling database
- ✅ Blocks invalid characters that could cause issues
- ✅ Ensures data can be serialized to JSON
- ✅ Limits key length to prevent memory issues

### 3. Safe Logging

**Problem**: Sensitive information logged in production:
```javascript
// ❌ Logs API credentials in production
console.log('API Hostname:', buildInfo.apiHostname);
console.log('Environment:', buildInfo.environment);
```

**Solution**:
```javascript
var IS_PRODUCTION = (environment === 'production');

function safeLog(message, data) {
  if (!IS_PRODUCTION) {
    console.log(message, data);
  }
  // Production: no logging
}

function safeError(message, error) {
  if (!IS_PRODUCTION) {
    console.error(message, error);  // Full error details
  } else {
    console.error(message);  // Message only, no stack trace
  }
}
```

**Benefits**:
- ✅ No sensitive data in production logs
- ✅ Detailed debugging in development
- ✅ Prevents log scraping attacks
- ✅ Complies with data protection regulations

### 4. Immutable Data Returns

**Problem**: Data could be modified after retrieval:
```javascript
// ❌ Mutable reference
var info = window.APP_BUILD_INFO;
info.apiHostname = 'hacked.com';  // Modifies original!
```

**Solution**:
```javascript
getData: function() {
  // Return frozen copy - cannot be modified
  return Object.freeze(Object.assign({}, buildInfoCache));
}
```

**Protection**:
- ✅ Prevents accidental or malicious data modification
- ✅ Ensures data integrity
- ✅ Catches programming errors early

### 5. Parameterized Queries

**Already implemented** in all versions, but worth highlighting:

```javascript
// ✅ Safe - uses parameterized query
tx.executeSql(
  'SELECT value FROM user_data WHERE key = ?',
  [key],  // Parameters are escaped
  successCallback
);

// ❌ NEVER do this (not in our code):
tx.executeSql(
  'SELECT value FROM user_data WHERE key = "' + key + '"',  // SQL injection risk!
  []
);
```

**Protection**: ✅ Prevents SQL injection attacks

---

## 🛡️ Security Best Practices

### For App Developers

#### 1. Use the New Namespace API

```javascript
// ✅ RECOMMENDED - New API
document.addEventListener('buildInfoReady', function(event) {
  var buildInfo = window.AppBuildInfo.getData();
  console.log('Version:', buildInfo.versionNumber);
});

// ⚠️ DEPRECATED - Legacy API (will be removed in v3.0.0)
var info = window.APP_BUILD_INFO;
```

#### 2. Always Validate in Your Code Too

```javascript
// Don't rely solely on plugin validation
function saveUserPreference(key, value) {
  // Your own validation
  if (!key || typeof key !== 'string') {
    return Promise.reject(new Error('Invalid key'));
  }
  
  return new Promise(function(resolve, reject) {
    window.AppBuildInfo.updateUserData(key, value, function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
}
```

#### 3. Handle Errors Properly

```javascript
window.AppBuildInfo.updateUserData('userId', userId, function(err) {
  if (err) {
    // Handle validation errors
    if (err.message.includes('invalid characters')) {
      alert('User ID contains invalid characters');
    } else if (err.message.includes('too large')) {
      alert('User ID is too long');
    } else {
      alert('Failed to save user data');
    }
    return;
  }
  
  console.log('User data saved successfully');
});
```

#### 4. Don't Store Sensitive Data

```javascript
// ❌ DON'T store sensitive data in user_data
AppBuildInfo.updateUserData('password', userPassword);  // BAD!
AppBuildInfo.updateUserData('creditCard', cardNumber);  // BAD!

// ✅ DO store non-sensitive preferences
AppBuildInfo.updateUserData('theme', 'dark');  // OK
AppBuildInfo.updateUserData('language', 'en');  // OK
AppBuildInfo.updateUserData('userId', userId);  // OK (if not PII)
```

### For Plugin Configuration

#### 1. Use HTTPS for CDN Icons

```json
// ✅ Secure
{
  "name": "CDN_ICON",
  "value": "https://cdn.example.com/icon.png"
}

// ❌ Insecure
{
  "name": "CDN_ICON",
  "value": "http://cdn.example.com/icon.png"  // No encryption!
}
```

#### 2. Rotate API Tokens Regularly

```json
{
  "name": "BUILD_API_BEARER_TOKEN",
  "value": "token-2025-12-01"  // Include date for tracking
}
```

#### 3. Use Environment-Specific Configs

```json
// Development
{
  "name": "ENVIRONMENT",
  "value": "development",  // Enables detailed logging
}

// Production
{
  "name": "ENVIRONMENT",
  "value": "production",  // Disables sensitive logging
}
```

---

## 🚨 Security Considerations

### 1. Database Encryption (Not Implemented)

**Current Status**: Database is **not encrypted** by default.

**Recommendation**: If your app stores sensitive data:

1. Use a different storage mechanism for sensitive data:
   - iOS Keychain (via cordova-plugin-secure-storage)
   - Android KeyStore (via cordova-plugin-secure-storage)

2. OR implement database encryption:
   ```javascript
   // In your own fork/modification
   db = window.sqlitePlugin.openDatabase({
     name: 'app_build_info.db',
     location: 'default',
     key: getDeviceSpecificKey()  // Requires SQLCipher
   });
   ```

**Why not included by default**:
- Build info is not typically sensitive
- SQLCipher adds complexity and size
- User data should use dedicated secure storage

### 2. Physical Device Access

**Risk**: If device is rooted/jailbroken, database can be read directly.

**Mitigations**:
- Don't store passwords or tokens in user_data
- Use secure storage for sensitive data
- Detect root/jailbreak and warn users
- Implement certificate pinning for API calls

### 3. XSS Attacks

**Protection Included**:
- ✅ Namespace is frozen (cannot be overwritten)
- ✅ Data returns are immutable
- ✅ Input validation prevents malicious input

**Additional Protection Needed**:
- ⚠️ Sanitize user input before display
- ⚠️ Use Content Security Policy (CSP)
- ⚠️ Validate all data from external sources

### 4. Third-Party Libraries

**Risk**: Malicious or compromised libraries could:
- Read `window.AppBuildInfo.getData()`
- Call API functions with malicious data

**Mitigations**:
- Audit all third-party libraries
- Use Subresource Integrity (SRI) for CDN scripts
- Monitor for suspicious behavior
- Keep libraries updated

---

## 🔍 Security Audit Checklist

### Before Production Release

- [ ] Environment set to `production` in config
- [ ] No sensitive data logged in production builds
- [ ] API tokens rotated and secured
- [ ] HTTPS used for all CDN resources
- [ ] Third-party libraries audited
- [ ] Content Security Policy configured
- [ ] Certificate pinning implemented (if needed)
- [ ] Root/jailbreak detection enabled (if needed)
- [ ] Sensitive data stored in secure storage (not user_data)
- [ ] Error messages don't leak sensitive info

### Regular Maintenance

- [ ] Review access logs for suspicious activity
- [ ] Rotate API tokens quarterly
- [ ] Update plugin to latest version
- [ ] Audit user_data for unintended sensitive data
- [ ] Review and update validation rules
- [ ] Test security on rooted/jailbroken devices

---

## 📝 API Security Reference

### Safe Methods

```javascript
// All methods include validation and protection
AppBuildInfo.getData()           // Returns immutable copy
AppBuildInfo.isReady()           // Boolean, no risk
AppBuildInfo.updateUserData()    // Validates key & value
AppBuildInfo.getUserData()       // Validates key
AppBuildInfo.deleteUserData()    // Validates key
AppBuildInfo.updateSettings()    // Validates all keys & values
AppBuildInfo.getSetting()        // Validates key
AppBuildInfo.getInstallHistory() // Read-only, no risk
```

### Error Handling

All methods return errors via callback:

```javascript
AppBuildInfo.updateUserData('invalid@key!', value, function(err) {
  if (err) {
    console.error('Validation failed:', err.message);
    // Error examples:
    // - "Key contains invalid characters"
    // - "Value size exceeds limit"
    // - "Key length must be between 1 and 255"
  }
});
```

---

## 🐞 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Email details to: [your-security-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

## 📚 Additional Resources

- [OWASP Mobile Security](https://owasp.org/www-project-mobile-security/)
- [Cordova Security Guide](https://cordova.apache.org/docs/en/latest/guide/appdev/security/)
- [SQLite Security](https://www.sqlite.org/security.html)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

---

## 📄 Changelog

### v2.6.0 - Security Improvements

- ✅ Added namespace protection with `Object.freeze()`
- ✅ Implemented input validation for all user input
- ✅ Added safe logging that respects environment
- ✅ Made data returns immutable
- ✅ Added size limits for keys and values
- ✅ Character validation for keys
- ✅ Legacy API deprecated (will be removed in v3.0.0)

### v2.5.0 and earlier

- ⚠️ Global variables (can be tampered)
- ⚠️ No input validation
- ⚠️ Sensitive logging in production
- ✅ Parameterized queries (SQL injection protected)

---

**Last Updated**: December 12, 2025  
**Plugin Version**: 2.6.0