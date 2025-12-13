# cordova-plugin-change-app-info

Cordova plugin to change app info (package name, display name, version, icon) from CDN at build time. Creates pre-built READ-ONLY SQLite database with build info. Supports webview background color customization. **Optimized for OutSystems MABS**.

## Features

✅ **Dynamic App Configuration**
- Change package name/bundle ID at build time
- Set app display name dynamically
- Configure version number and build code
- Download and set app icon from CDN URL

✅ **Build Info Database (READ-ONLY)**
- Pre-built SQLite database with build information
- Accessible via JavaScript API
- Contains: app name, version, environment, API hostname, build timestamp
- **READ-ONLY**: No runtime modifications, secure and fast

✅ **UI Customization**
- **Webview background color**: Eliminate white flash on app launch
- **Native splash screen**: Use Cordova native preferences (recommended)

✅ **Build Success Notification**
- Send HTTP POST notification to API when build completes
- Configurable endpoint and bearer token
- Useful for CI/CD pipelines

## Installation

### OutSystems (MABS)

Add to **Extensibility Configurations**:

```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#master"
  },
  "preferences": {
    "global": [
      {
        "name": "APP_NAME",
        "value": "MyApp"
      },
      {
        "name": "VERSION_NUMBER",
        "value": "1.0.0"
      },
      {
        "name": "VERSION_CODE",
        "value": "1"
      },
      {
        "name": "CDN_ICON",
        "value": "https://cdn.com/icon-1024.png"
      },
      {
        "name": "ENVIRONMENT",
        "value": "production"
      },
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      },
      {
        "name": "WEBVIEW_BACKGROUND_COLOR",
        "value": "#001833"
      }
    ]
  },
  "dependencies": [
    {
      "plugin": {
        "url": "cordova-sqlite-storage@6.1.0"
      }
    }
  ]
}
```

### Cordova CLI

```bash
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git
```

## Configuration

### App Configuration

| Preference | Description | Example |
|------------|-------------|----------|
| `APP_NAME` | App display name | `"MyApp"` |
| `VERSION_NUMBER` | Version string | `"1.0.0"` |
| `VERSION_CODE` | Build number | `"1"` |
| `CDN_ICON` | Icon URL (1024x1024 PNG) | `"https://cdn.com/icon.png"` |
| `ENVIRONMENT` | Environment name | `"production"` |
| `API_HOSTNAME` | API hostname (auto-set by OutSystems) | `"api.myapp.com"` |

### UI Customization

#### Native Splash Screen (RECOMMENDED)

Use **Cordova native preferences** for splash screen customization:

| Preference | Description | Example |
|------------|-------------|----------|
| `SplashScreenBackgroundColor` | Splash background color | `"#001833"` |
| `SplashScreenDelay` | Splash duration (ms) | `"3000"` |
| `FadeSplashScreen` | Enable fade effect | `"true"` |
| `FadeSplashScreenDuration` | Fade duration (ms) | `"300"` |
| `AutoHideSplashScreen` | Auto hide splash | `"true"` |

#### Webview Background

| Preference | Description | Example |
|------------|-------------|----------|
| `WEBVIEW_BACKGROUND_COLOR` | Pre-render webview background | `"#001833"` |

**Best Practice**: Match splash and webview colors for smooth transition:
```json
{
  "name": "SplashScreenBackgroundColor",
  "value": "#001833"
},
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#001833"
}
```

### Build Notification (Optional)

| Preference | Description | Example |
|------------|-------------|----------|
| `ENABLE_BUILD_NOTIFICATION` | Enable notification | `"true"` |
| `BUILD_SUCCESS_API_URL` | API endpoint | `"https://api.com/build"` |
| `BUILD_API_BEARER_TOKEN` | Bearer token | `"your-token"` |

## JavaScript API

### Accessing Build Info

#### Method 1: waitForReady() - RECOMMENDED ⭐

```javascript
// Promise-based, handles race conditions
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    console.log('App:', info.appName);
    console.log('Version:', info.versionNumber);
    console.log('Environment:', info.environment);
    console.log('API:', info.apiHostname);
  })
  .catch(function(error) {
    console.error('Build info not available:', error);
  });
```

#### Method 2: Event Listener

```javascript
// Listen for ready event
document.addEventListener('buildInfoReady', function(event) {
  var info = event.detail;
  console.log('Build info ready:', info);
});
```

#### Method 3: Direct Access

```javascript
// Check if ready first
if (window.AppBuildInfo.isReady()) {
  var info = window.AppBuildInfo.getData();
  console.log('Version:', info.versionNumber);
}
```

### Available Data

```javascript
{
  appName: "MyApp",
  versionNumber: "1.0.0",
  versionCode: "1",
  packageName: "com.myapp",
  platform: "android",
  buildTime: "2024-01-01T12:00:00.000Z",
  buildTimestamp: 1704110400000,
  apiHostname: "api.myapp.com",
  environment: "production",
  storageType: "sqlite-readonly"
}
```

### Helper Methods

```javascript
// Check if ready
window.AppBuildInfo.isReady(); // boolean

// Get build timestamp
window.AppBuildInfo.getBuildTimestamp(); // number

// Get API hostname
window.AppBuildInfo.getApiHostname(); // string

// Check if production
window.AppBuildInfo.isProduction(); // boolean
```

## OutSystems Integration

### OnApplicationReady Example

**Client Action: InitBuildInfo**

```javascript
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    $parameters.Success = true;
    $parameters.AppName = info.appName;
    $parameters.Version = info.versionNumber;
    $parameters.Environment = info.environment;
    $parameters.ApiHostname = info.apiHostname;
    $resolve();
  })
  .catch(function(error) {
    $parameters.Success = false;
    $parameters.ErrorMessage = error.message;
    $resolve();
  });
```

**Flow**:
```
OnApplicationReady
  └─ InitBuildInfo
      ├─ If Success
      │   ├─ Session.AppName = InitBuildInfo.AppName
      │   ├─ Session.Version = InitBuildInfo.Version
      │   └─ Session.Environment = InitBuildInfo.Environment
      └─ Else
          └─ Handle error
```

## Complete Example

```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#master"
  },
  "preferences": {
    "global": [
      {
        "name": "APP_NAME",
        "value": "MyApp"
      },
      {
        "name": "VERSION_NUMBER",
        "value": "1.0.0"
      },
      {
        "name": "VERSION_CODE",
        "value": "100"
      },
      {
        "name": "CDN_ICON",
        "value": "https://cdn.myapp.com/icon-1024.png"
      },
      {
        "name": "ENVIRONMENT",
        "value": "production"
      },
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      },
      {
        "name": "SplashScreenDelay",
        "value": "3000"
      },
      {
        "name": "FadeSplashScreen",
        "value": "true"
      },
      {
        "name": "FadeSplashScreenDuration",
        "value": "300"
      },
      {
        "name": "WEBVIEW_BACKGROUND_COLOR",
        "value": "#001833"
      },
      {
        "name": "ENABLE_BUILD_NOTIFICATION",
        "value": "true"
      },
      {
        "name": "BUILD_SUCCESS_API_URL",
        "value": "https://api.myapp.com/webhook/build-success"
      },
      {
        "name": "BUILD_API_BEARER_TOKEN",
        "value": "your-secret-token"
      }
    ]
  },
  "dependencies": [
    {
      "plugin": {
        "url": "cordova-sqlite-storage@6.1.0"
      }
    }
  ]
}
```

## Documentation

- [OutSystems OnApplicationReady Integration](docs/OUTSYSTEMS_ONAPPLICATIONREADY.md)
- [Webview Color Troubleshooting](docs/WEBVIEW_COLOR_TROUBLESHOOTING.md)
- [Complete Config Examples](examples/)

## Changelog

### v2.7.3 (2024-12-13)
- **BREAKING**: Removed custom splash screen hook
- **Recommended**: Use Cordova native `SplashScreenBackgroundColor` preference instead
- Updated documentation for splash screen configuration
- Better OutSystems compatibility

### v2.7.2 (2024-12-13)
- Added custom splash screen background color hook
- Support for both Android and iOS splash customization

### v2.7.1 (2024-12-12)
- Added webview background color customization
- Fixed race condition in buildInfoReady event
- Added `waitForReady()` promise-based API

### v2.7.0 (2024-12-10)
- Migrated to READ-ONLY pre-built SQLite database
- Improved performance (no runtime database writes)
- Simplified codebase
- Better security (read-only data)

## Requirements

- Cordova >= 9.0.0
- cordova-sqlite-storage >= 6.1.0
- Node.js >= 12.0.0
- For icon generation: sharp or jimp (auto-installed)

## License

MIT

## Author

vnkhoado

## Repository

https://github.com/vnkhoado/cordova-plugin-change-app-info