# cordova-plugin-change-app-info

Cordova plugin to change app info (package name, display name, version, icon) from CDN at build time. Creates pre-built READ-ONLY SQLite database with build info. Supports webview background color customization. **Optimized for OutSystems MABS with forced splash color override**.

## Features

✅ **Dynamic App Configuration**
- Change package name/bundle ID at build time
- Set app display name dynamically
- Configure version number and build code
- Download and set app icon from CDN URL (requires sharp or jimp)

✅ **Build Info Database (READ-ONLY)**
- Pre-built SQLite database with build information
- Accessible via JavaScript API
- Contains: app name, version, environment, API hostname, build timestamp
- **READ-ONLY**: No runtime modifications, secure and fast

✅ **UI Customization**
- **Webview background color**: Eliminate white flash on app launch
- **Native splash screen**: Auto-override OutSystems theme colors
- **Native pre-splash color**: No white flash when tapping app icon (iOS)
- **Deep color override**: Replaces ALL color tags in LaunchScreen (not just first)
- **Force override**: Prevents OutSystems from overriding splash colors
- **iOS Background Fix**: Automatic code injection to eliminate color flash during app startup

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
        "name": "BackgroundColor",
        "value": "#001833"
      },
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      },
      {
        "name": "AndroidWindowSplashScreenBackground",
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

# For CDN icon generation (REQUIRED if using CDN_ICON)
npm install sharp
# OR fallback to jimp (slower, pure JS)
npm install jimp
```

### Image Processing Library

**CDN icon generation requires either sharp or jimp**:

#### Option 1: Sharp (Recommended ⭐)
```bash
npm install sharp
```
- **Pros**: Very fast, better quality, native performance
- **Cons**: Requires native compilation (may fail on some build servers)

#### Option 2: Jimp (Fallback)
```bash
npm install jimp
```
- **Pros**: Pure JavaScript, works everywhere
- **Cons**: Slower than sharp

#### Auto-install
The plugin includes sharp and jimp as `optionalDependencies`, so they will be automatically installed when you add the plugin. However, for build servers, you may need to explicitly install:

```bash
# In your project's package.json
{
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

## Configuration

### App Configuration

| Preference | Description | Example |
|------------|-------------|---------||
| `APP_NAME` | App display name | `"MyApp"` |
| `VERSION_NUMBER` | Version string | `"1.0.0"` |
| `VERSION_CODE` | Build number | `"1"` |
| `CDN_ICON` | Icon URL (1024x1024 PNG) | `"https://cdn.com/icon.png"` |
| `ENVIRONMENT` | Environment name | `"production"` |
| `API_HOSTNAME` | API hostname (auto-set by OutSystems) | `"api.myapp.com"` |

### UI Customization

#### Splash Screen Color Override (OutSystems Compatible)

**Important for OutSystems**: Set ALL three preferences to ensure override works:

| Preference | Description | Example |
|------------|-------------|---------||
| `BackgroundColor` | Legacy Cordova splash color | `"#001833"` |
| `SplashScreenBackgroundColor` | Standard splash color | `"#001833"` |
| `AndroidWindowSplashScreenBackground` | Android 12+ splash | `"#001833"` |

**How it works**:
1. `after_prepare` hook: Initial splash color setup
2. OutSystems: May inject theme colors during build
3. `before_compile` hook: **Deep scan** - replaces ALL color tags in storyboard (not just first)
4. **iOS Background Fix**: Automatically injects code into AppDelegate and MainViewController
5. **Native pre-splash**: Creates Color Assets for immediate color on tap
6. Result: Your color preference wins everywhere! 🎉

**NEW in v2.9.8**: No white flash when tapping app icon! The native pre-splash color is now properly applied before any storyboard loads.

#### Additional Splash Preferences (Optional)

| Preference | Description | Example |
|------------|-------------|---------||
| `SplashScreenDelay` | Splash duration (ms) | `"3000"` |
| `FadeSplashScreen` | Enable fade effect | `"true"` |
| `FadeSplashScreenDuration` | Fade duration (ms) | `"300"` |
| `AutoHideSplashScreen` | Auto hide splash | `"true"` |

#### Webview Background

| Preference | Description | Example |
|------------|-------------|---------||
| `WEBVIEW_BACKGROUND_COLOR` | Pre-render webview background | `"#001833"` |

**Best Practice**: Match all colors for smooth transition:
```json
{
  "name": "BackgroundColor",
  "value": "#001833"
},
{
  "name": "SplashScreenBackgroundColor",
  "value": "#001833"
},
{
  "name": "AndroidWindowSplashScreenBackground",
  "value": "#001833"
},
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#001833"
}
```

### Build Notification (Optional)

| Preference | Description | Example |
|------------|-------------|---------||
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

## Troubleshooting

### CDN Icons Not Generated

**Symptom**: Build logs show "No image processor available"

**Solution**:
```bash
# Install sharp (recommended)
npm install sharp

# OR install jimp (fallback)
npm install jimp

# Then rebuild
cordova platform remove ios android
cordova platform add ios android
cordova build
```

**For build servers**, add to your project's `package.json`:
```json
{
  "dependencies": {
    "sharp": "^0.33.0"
  }
}
```

Then in your build pipeline:
```bash
npm install
cordova build
```

### White Flash on App Launch (iOS)

**Fixed in v2.9.8!** The plugin now creates proper Color Assets for native pre-splash.

If you still see white flash:
1. Ensure you're using latest version
2. Clean and rebuild: `rm -rf platforms/ios && cordova platform add ios`
3. Check build logs for "Created SplashBackgroundColor.colorset"

### Splash Color Not Changing (OutSystems)

1. Set **ALL THREE** color preferences:
   - `BackgroundColor`
   - `SplashScreenBackgroundColor`  
   - `AndroidWindowSplashScreenBackground`

2. Use same color value for all three

3. Check build logs for "Force override" messages

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
        "name": "BackgroundColor",
        "value": "#001833"
      },
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      },
      {
        "name": "AndroidWindowSplashScreenBackground",
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

### v2.9.8 (2025-12-16) 🎉 NATIVE PRE-SPLASH FIX
- **NEW**: Native pre-splash color support - No white flash when tapping app icon!
- **FEATURE**: Auto-creates Color Assets (SplashBackgroundColor.colorset) with RGB values
- **FEATURE**: Proper UILaunchScreen configuration in Info.plist
- **IMPROVED**: Sharp and jimp added to optionalDependencies for auto-install
- **IMPROVED**: Better icon generation with validation and error handling
- **IMPROVED**: Seamless color transition: Tap → Native splash → Storyboard → App
- iOS 14+ UILaunchScreen API fully supported

### v2.9.7 (2025-12-16) 🚀 MAJOR IMPROVEMENTS
- **FIXED**: iOS app name not updating (CFBundleDisplayName + CFBundleName)
- **FIXED**: iOS splash color not applying to all storyboard elements
- **FIXED**: Android icon generation with better error handling
- **NEW**: Clean old icons before generating new ones
- **NEW**: Verify each generated icon file
- **IMPROVED**: Download validation with timeout handling
- **IMPROVED**: Better progress feedback and logging
- **IMPROVED**: Support for both iPhone and iPad icons (18 sizes)
- **IMPROVED**: Android icons with proper verification (6 densities)

### v2.9.6 (2025-12-16) 🎯 iOS BACKGROUND FIX
- **NEW**: Automatic iOS background color fix injection
- **FIXED**: Eliminates "old color flashing" issue during iOS app startup
- **FEATURE**: Auto-injects Swift code into AppDelegate.swift
- **FEATURE**: Auto-injects Objective-C code into MainViewController.m
- **IMPROVED**: Sets window backgroundColor in willFinishLaunchingWithOptions (earliest possible)
- **IMPROVED**: Recursively applies background color to all subviews
- **SMART**: Automatically updates color if already injected
- No more white/old color flash before splash screen appears!

### v2.8.2 (2024-12-15) 🔥 CRITICAL FIX
- **FIXED**: iOS splash screen showing old color even on fresh devices
- **NEW**: Deep scan ALL color tags in LaunchScreen.storyboard (not just first)
- **IMPROVED**: Replace systemColor, named colors, and ALL nested subview colors
- **IMPROVED**: Comprehensive logging shows exactly what colors were found and replaced
- This fixes the issue where OutSystems injects colors into nested subviews

### v2.8.1 (2024-12-15) 🎉
- **NEW**: Added `forceOverrideSplashColor` hook at `before_compile` stage
- **FIX**: Prevents OutSystems from overriding splash colors with theme values
- **IMPROVED**: Dual-stage color override strategy:
  - Stage 1 (`after_prepare`): Initial setup via `customizeSplashScreen.js`
  - Stage 2 (`before_compile`): Force override via `forceOverrideSplashColor.js`
- Now works reliably with OutSystems theme system!

### v2.8.0 (2024-12-15)
- Added integrated splash screen color override hook
- Auto-handles OutSystems theme conflicts
- Updated customizeSplashScreen.js with better OutSystems detection

### v2.7.3 (2024-12-13)
- **BREAKING**: Removed custom splash screen hook
- **Recommended**: Use Cordova native `SplashScreenBackgroundColor` preference instead
- Updated documentation for splash screen configuration
- Better OutSystems compatibility

## Requirements

- Cordova >= 9.0.0
- cordova-sqlite-storage >= 6.1.0
- Node.js >= 14.0.0
- **For CDN icon generation**: sharp ^0.33.0 OR jimp ^0.22.0

## License

MIT

## Author

vnkhoado

## Repository

https://github.com/vnkhoado/cordova-plugin-change-app-info