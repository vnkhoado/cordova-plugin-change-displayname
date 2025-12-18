# Config Loaders

These files provide runtime access to build configuration injected by the plugin.

## Files

### `config-loader.js`
Node.js/server-side configuration loader. Reads `build-config.json` from the file system.

**Usage:**
```javascript
const { getConfig, getPreference } = require('./config-loader');
const appName = getConfig('APP_NAME');
const env = getPreference('ENVIRONMENT');
```

### `config-loader-mobile.js`
Browser/Cordova mobile app configuration loader. Should be included in your app's HTML.

**Installation in `www/index.html`:**
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
    <!-- Include before other scripts -->
    <script src="js/config-loader-mobile.js"></script>
</head>
<body>
    <!-- Your app content -->
</body>
</html>
```

**Usage in your app:**
```javascript
// Access config directly
const appName = window.cordovaAppConfig.APP_NAME;
const apiHost = window.cordovaAppConfig.API_HOSTNAME;

// Or use helper methods
const config = window.CordovaConfigLoader.getConfig();
const pref = window.CordovaConfigLoader.getPreference('ENVIRONMENT');
const buildInfo = window.CordovaConfigLoader.getBuildInfo();

// Listen for config ready event
document.addEventListener('cordova-config-ready', (e) => {
    console.log('Config loaded:', e.detail.config);
});
```

## How It Works

1. **Build Time** (via `auto-copy-config-files.js` hook):
   - These files are copied to `www/js/` directory
   - They become part of your app bundle

2. **Build Time** (via `injectBuildInfo.js` hook):
   - Build configuration is written to `www/.cordova-app-data/build-config.json`
   - This file contains all preferences and metadata from `config.xml`

3. **Runtime** (in your app):
   - `config-loader-mobile.js` loads the build config
   - Configuration is exposed globally via:
     - `window.cordovaAppConfig` - Direct config object
     - `window.CordovaConfigLoader` - Helper methods
   - A `cordova-config-ready` event is dispatched when config is loaded

## Available Configuration

Common configuration keys available:

```javascript
// App Information
window.cordovaAppConfig.APP_NAME           // e.g., "MyApp"
window.cordovaAppConfig.VERSION_NUMBER     // e.g., "1.0.0"
window.cordovaAppConfig.VERSION_CODE       // e.g., "1"

// Runtime Configuration
window.cordovaAppConfig.ENVIRONMENT        // e.g., "production"
window.cordovaAppConfig.API_HOSTNAME       // e.g., "api.myapp.com"
window.cordovaAppConfig.WEBVIEW_BACKGROUND_COLOR // e.g., "#FFFFFF"

// Build Information
window.cordovaAppConfig.timestamp          // ISO 8601 build timestamp
window.cordovaAppConfig.preferences        // All config.xml preferences
window.cordovaAppConfig.metadata           // Additional metadata
```

## Configuration in config.xml

Define preferences in your Cordova app's `config.xml`:

```xml
<preference name="APP_NAME" value="My Application" />
<preference name="VERSION_NUMBER" value="1.0.0" />
<preference name="VERSION_CODE" value="1" />
<preference name="ENVIRONMENT" value="production" />
<preference name="API_HOSTNAME" value="api.myapp.com" />
<preference name="CDN_RESOURCE" value="https://cdn.example.com/styles.css" />
```

## Error Handling

If `build-config.json` cannot be loaded, the loader falls back to default values:

```javascript
{
  APP_NAME: 'MyApp',
  VERSION_NUMBER: '1.0.0',
  VERSION_CODE: '1',
  ENVIRONMENT: 'production',
  API_HOSTNAME: 'api.example.com',
  WEBVIEW_BACKGROUND_COLOR: '#FFFFFF',
  timestamp: (current time),
  preferences: {},
  metadata: {}
}
```

Check browser console for warnings if config fails to load.
