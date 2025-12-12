# Changelog

All notable changes to this project will be documented in this file.

## [2.7.0] - 2025-12-12

### ⚠️ BREAKING CHANGES

- **Removed all runtime write operations** - Database is now READ-ONLY
- Removed `AppBuildInfo.updateUserData()` function
- Removed `AppBuildInfo.getUserData()` function
- Removed `AppBuildInfo.deleteUserData()` function
- Removed `AppBuildInfo.updateSettings()` function
- Removed `AppBuildInfo.getSetting()` function
- Removed `user_data` database table
- Removed `app_settings` database table

### 🆕 Added

- Database now opens in READ-ONLY mode for enhanced security
- New simplified API focused on reading build information
- Added `AppBuildInfo.getBuildTimestamp()` method
- Added `AppBuildInfo.getApiConfig()` method
- Added `AppBuildInfo.isProduction()` method
- Comprehensive SECURITY.md documentation

### ✨ Changed

- Simplified database schema to single `build_info` table
- Reduced API surface area for better security
- Updated all documentation for read-only approach
- Improved error messages for removed functions

### 🔒 Security

- Eliminated SQL injection risks from user input
- Removed data tampering possibilities
- No runtime data modification allowed
- Smaller attack surface

### 📚 Documentation

- Added comprehensive migration guide
- Updated README with read-only examples
- Enhanced SECURITY.md with read-only model
- Added OUTSYSTEMS_GUIDE.md for OutSystems integration

### 🔄 Migration Guide

If you were using write operations:

```javascript
// ❌ Old (v2.6.0) - No longer works
AppBuildInfo.updateUserData('key', 'value', callback);

// ✅ New (v2.7.0) - Use alternative storage
localStorage.setItem('key', 'value');
// or use cordova-plugin-nativestorage
// or use cordova-plugin-secure-storage for sensitive data
```

---

## [2.6.0] - 2025-12-12

### 🆕 Added

- **Direct SQLite database creation at build time** instead of runtime injection
- Pre-built database bundled with app for instant access
- Enhanced security features:
  - Namespace protection with `Object.freeze()`
  - Input validation for all user inputs
  - Safe logging respecting environment
  - Immutable data returns
- New API: `window.AppBuildInfo` (namespaced, protected)
- Support for user data storage (`updateUserData`, `getUserData`)
- Support for app settings storage
- Install history tracking

### ✨ Changed

- Rewrote `hooks/injectBuildInfo.js` for direct database creation
- Changed from runtime JavaScript injection to build-time database generation
- Improved performance - no database creation overhead at startup
- Better reliability - build info available immediately

### 🔒 Security

- Added comprehensive input validation
- Implemented namespace protection
- Added safe logging for production environments
- Protected API from tampering with `Object.freeze()`

### 📚 Documentation

- Added SQLITE_DIRECT_BUILD.md explaining new approach
- Added SECURITY.md with security best practices
- Updated README with new API examples

### 🐛 Deprecated

- `window.APP_BUILD_INFO` (use `AppBuildInfo.getData()` instead)
- `window.updateAppUserData()` (use `AppBuildInfo.updateUserData()` instead)
- `window.getAppUserData()` (use `AppBuildInfo.getUserData()` instead)

---

## [2.5.0] - 2024-XX-XX

### 🆕 Added

- Runtime JavaScript injection for build info
- localStorage fallback when SQLite unavailable
- User data persistence across app updates
- Build notification API support

### ✨ Changed

- Improved icon generation for iOS
- Enhanced CDN asset replacement
- Better OutSystems MABS compatibility

---

## [2.0.0] - 2024-XX-XX

### 🆕 Added

- Initial release with CDN icon support
- Dynamic app name and version changes
- OutSystems MABS integration
- Icon generation for multiple sizes (iOS & Android)

### ✨ Features

- Change app display name at build time
- Download and generate icons from CDN
- Support for iOS xcassets and Android mipmap
- Clean build cache for iOS

---

## Version Compatibility

| Version | Cordova | iOS | Android | Node.js | OutSystems |
|---------|---------|-----|---------|---------|------------|
| 2.7.0   | 9.0+    | 11+ | 5.0+    | 14+     | 11.x       |
| 2.6.0   | 9.0+    | 11+ | 5.0+    | 14+     | 11.x       |
| 2.5.0   | 9.0+    | 11+ | 5.0+    | 12+     | 11.x       |
| 2.0.0   | 9.0+    | 11+ | 5.0+    | 12+     | 11.x       |

---

## Upgrade Guide

### From 2.6.0 to 2.7.0

**Breaking Changes**: All write operations removed.

**Action Required**:
1. Remove all calls to `updateUserData()`, `getUserData()`, `updateSettings()`, etc.
2. Use alternative storage solutions for user data:
   - `localStorage` for simple key-value pairs
   - `cordova-plugin-nativestorage` for native storage
   - `cordova-plugin-secure-storage` for sensitive data
3. Update code to use new read-only API

### From 2.5.0 to 2.6.0

**Breaking Changes**: None, but deprecated APIs.

**Action Recommended**:
1. Update `window.APP_BUILD_INFO` to `AppBuildInfo.getData()`
2. Use new namespaced API for better security
3. Add event listener for `buildInfoReady` event

---

## Support

- **Issues**: https://github.com/vnkhoado/cordova-plugin-change-app-info/issues
- **Documentation**: See README.md and SECURITY.md
- **OutSystems**: See OUTSYSTEMS_GUIDE.md

---

**Semantic Versioning**: This project follows [Semantic Versioning](https://semver.org/).

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes