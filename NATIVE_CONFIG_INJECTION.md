# Native Config Injection Guide

## Overview

The plugin now injects build configuration directly into the WebView using native code (Java/Swift), eliminating the need for JavaScript config loaders and file system access.

## How It Works

### Build Time

1. **Hook `injectBuildInfo.js`** creates two JSON files:
   - `www/.cordova-app-data/build-config.json` - Full config with nested structure
   - **`www/cordova-build-config.json`** - Flat config for native plugins (NEW)

### Runtime

2. **Native plugins** (CSSInjector.java / CSSInjector.swift) automatically:
   - Read `cordova-build-config.json` from assets/bundle
   - Inject config into `window.CORDOVA_BUILD_CONFIG` and `window.AppConfig`
   - Dispatch `cordova-config-ready` event
   - This happens on WebView initialization (no JavaScript loader needed)

## Usage in Your App

### Option 1: Direct Access (Recommended)

```javascript
document.addEventListener('deviceready', () => {
    const config = window.CORDOVA_BUILD_CONFIG || window.AppConfig;
    
    console.log('App Name:', config.appName);
    console.log('Version:', config.appVersion);
    console.log('API Hostname:', config.apiHostname);
    console.log('Environment:', config.environment);
    console.log('Platform:', config.platform);
    console.log('Build Date:', config.buildDate);
});
```

### Option 2: Listen to Event

```javascript
window.addEventListener('cordova-config-ready', (event) => {
    const config = event.detail;
    console.log('Config ready:', config);
});
```

### Option 3: Get Config via Plugin

```javascript
cordova.exec(
    (config) => {
        console.log('Config from plugin:', config);
    },
    (error) => {
        console.error('Failed to get config:', error);
    },
    'CSSInjector',
    'getConfig',
    []
);
```

## Config Structure

```json
{
  "appName": "My App",
  "appId": "com.example.app",
  "appVersion": "1.0.0",
  "versionCode": "1",
  "appDescription": "My awesome app",
  "platform": "android",
  "author": "Your Name",
  "buildDate": "2025-12-25T11:00:00.000Z",
  "buildTimestamp": 1735128000000,
  "environment": "production",
  "apiHostname": "https://api.example.com",
  "cdnIcon": "https://cdn.example.com/icon.png",
  "backgroundColor": "#FFFFFF"
}
```

## Configuration Sources (Priority Order)

The hook reads config from multiple sources with this priority:

1. **Environment Variables** (MABS builds)
   - `APP_NAME`, `VERSION_NUMBER`, `API_HOSTNAME`, etc.

2. **Cordova Preferences** (config.xml)
   - `<preference name="APP_NAME" value="My App" />`
   - `<preference name="hostname" value="https://api.example.com" />`
   - `<preference name="DefaultHostname" value="..." />` (OutSystems)

3. **Default Values**
   - Falls back to `config.xml` name/version or hardcoded defaults

## Benefits

✅ **No JavaScript file loading** - Config is available immediately after `deviceready`

✅ **No file system permissions** - Native code has direct access to assets

✅ **More reliable** - No race conditions with file loading

✅ **Better performance** - Config loaded once at plugin initialization

✅ **Cleaner code** - No need for `config-loader-mobile.js` and related files

## Migration from Old Approach

### Before (File-based Loading)

```javascript
// Old way - required external loader
import mobileConfigLoader from 'js/config-loader-mobile.js';

const config = await mobileConfigLoader.load();
console.log(config.appName);
```

### After (Native Injection)

```javascript
// New way - config already available
document.addEventListener('deviceready', () => {
    const config = window.CORDOVA_BUILD_CONFIG;
    console.log(config.appName);
});
```

## Removed Files

These files are no longer needed and can be removed:

- ❌ `www/js/config-loader-mobile.js`
- ❌ `www/js/config-loader.js`
- ❌ `www/js/AppReadyManager.js`
- ❌ `hooks/auto-copy-config-files.js`
- ❌ `hooks/injectAppReadyManager.js`

## Troubleshooting

### Config is undefined

```javascript
// Make sure to wait for deviceready
document.addEventListener('deviceready', () => {
    if (!window.CORDOVA_BUILD_CONFIG) {
        console.error('Config not available!');
        // Try getting via plugin
        cordova.exec(
            (config) => window.CORDOVA_BUILD_CONFIG = config,
            null,
            'CSSInjector',
            'getConfig',
            []
        );
    }
});
```

### Check logs

**Android:**
```bash
adb logcat | grep CSSInjector
```

**iOS:**
```bash
# Check Xcode console for [CSSInjector] logs
```

You should see:
- `[CSSInjector] Plugin initialized`
- `[CSSInjector] Build config injected: {...}`

### Verify config file exists

Check that `cordova-build-config.json` exists in:
- Android: `platforms/android/app/src/main/assets/www/cordova-build-config.json`
- iOS: `platforms/ios/www/cordova-build-config.json`

## Example: OutSystems Integration

```javascript
// OutSystems module
define("StaffPortalMobile.controller.AppConfig", [], function() {
    return {
        getConfig: function() {
            // Config already injected by native plugin
            return window.CORDOVA_BUILD_CONFIG || {};
        },
        
        getApiHostname: function() {
            const config = window.CORDOVA_BUILD_CONFIG || {};
            return config.apiHostname || '';
        },
        
        getEnvironment: function() {
            const config = window.CORDOVA_BUILD_CONFIG || {};
            return config.environment || 'production';
        }
    };
});
```

## Notes

- Config is injected **after** WebView initialization but **before** page load completes
- Always access config inside `deviceready` event handler
- Config is immutable once injected (read-only)
- Use `window.AppConfig` alias for backward compatibility
