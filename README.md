# cordova-plugin-change-app-info

Cordova plugin to change app info (package name, display name, version, icon) from CDN at build time. Stores app configuration in JSON format accessible from web and mobile apps. Supports native gradient splash screens. **Optimized for OutSystems MABS with forced splash color override**.

## Features

✅ **Dynamic App Configuration**
- Change package name/bundle ID at build time
- Set app display name dynamically
- Configure version number and build code
- Download and set app icon from CDN URL (requires sharp or jimp)

✅ **JSON Config Storage** (NEW in v2.9.11)
- Saves app info to `.cordova-app-data/build-config.json`
- Accessible from web apps via `configLoader.load()`
- Accessible from mobile apps via `mobileConfigLoader.load()`
- Tracks build history (last 50 builds)
- **No sqlite needed!** Works on all cloud builds

✅ **Gradient Splash Screens** (NEW in v2.9.11)
- CSS linear-gradient support for native splash screens
- Works on iOS (all device sizes) and Android
- Smooth color transitions, no white flash
- Set via `SPLASH_GRADIENT` preference

✅ **UI Customization**
- **Webview background color**: Eliminate white flash on app launch
- **Native splash screen**: Auto-override OutSystems theme colors
- **Native pre-splash**: No white flash when tapping app icon (iOS)
- **Deep color override**: Replaces ALL color tags in LaunchScreen (not just first)
- **Force override**: Prevents OutSystems from overriding splash colors
- **iOS Background Fix**: Automatic code injection to eliminate color flash during app startup

✅ **Build Success Notification**
- Send HTTP POST notification to API when build completes
- Configurable endpoint and bearer token
- Useful for CI/CD pipelines

## Requirements

- **Cordova**: >= 9.0.0
- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0

### Required Dependencies

✨ **NONE!** All dependencies auto-install on first build.

### Optional Dependencies

- **sharp**: Fast image resizing for CDN icon generation (⭐ **Recommended**)
  - `npm install sharp`
  - Faster and better quality than jimp
  - Requires native compilation (may need build tools)

- **jimp**: Fallback image processor (pure JavaScript)
  - `npm install jimp`
  - Works everywhere, slower than sharp

- **cordova-sqlite-storage**: Runtime SQLite access for app (optional)
  - Only needed if your app needs to access/modify build database at runtime
  - `cordova plugin add cordova-sqlite-storage@6.1.0`

## Installation

### Quick Start (Recommended)

```bash
# 1. Add the plugin
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git

# 2. Build (auto-installs dependencies!)
cordova build android ios
```

✨ The auto-install hook will:
- ✅ Check for optional dependencies (sharp, jimp)
- ✅ Install missing dependencies automatically
- ✅ Display clear status messages
- ✅ Continue build even if optional deps fail

### Manual Setup (if needed)

```bash
# 1. Add the plugin
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git

# 2. Install optional dependencies (recommended)
npm install sharp   # Fast image processor
# OR fallback:
npm install jimp    # Pure JavaScript processor

# 3. Build
cordova build android ios
```

## Configuration

### Basic App Configuration

| Preference | Description | Example |
|------------|-------------|----------|
| `APP_NAME` | App display name | `"MyApp"` |
| `VERSION_NUMBER` | Version string | `"1.0.0"` |
| `VERSION_CODE` | Build number | `"1"` |
| `CDN_ICON` | Icon URL (1024x1024 PNG) | `"https://cdn.com/icon.png"` |
| `ENVIRONMENT` | Environment name | `"production"` |

### Gradient Splash Screen (NEW)

```xml
<!-- config.xml -->
<preference name="SPLASH_GRADIENT" value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
```

**Supported Gradients**:
- `linear-gradient(angle, color1, color2, ...)`
- `linear-gradient(to right, #color1, #color2)`
- `linear-gradient(45deg, rgb(r,g,b), rgb(r,g,b))`

**Works On**:
- ✅ iOS (iPhone + iPad)
- ✅ Android (all versions)
- ❌ Web (fallback to solid color)

### Splash Screen Color Override (OutSystems)

**For OutSystems apps**, set ALL THREE:

```xml
<preference name="BackgroundColor" value="#001833" />
<preference name="SplashScreenBackgroundColor" value="#001833" />
<preference name="AndroidWindowSplashScreenBackground" value="#001833" />
```

**How it works**:
1. `after_prepare`: Initial splash color setup
2. OutSystems: May inject theme colors during build
3. `before_compile`: **Force override** - replaces ALL color tags
4. **iOS Background Fix**: Auto-injects code into AppDelegate and MainViewController
5. Result: Your color preference wins everywhere!

### Webview Background

```xml
<preference name="WEBVIEW_BACKGROUND_COLOR" value="#001833" />
```

**Best Practice** - Match all colors for smooth transition:
```xml
<preference name="BackgroundColor" value="#001833" />
<preference name="SplashScreenBackgroundColor" value="#001833" />
<preference name="AndroidWindowSplashScreenBackground" value="#001833" />
<preference name="WEBVIEW_BACKGROUND_COLOR" value="#001833" />
```

## Reading Config from App

### Web App

```html
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
</head>
<body>
    <h1 id="appName">Loading...</h1>
    
    <script src="js/config-loader.js"></script>
    <script>
        configLoader.load().then(config => {
            if (config) {
                document.getElementById('appName').textContent = config.appName;
                console.log('App:', config.appName);
                console.log('Version:', config.appVersion);
                console.log('ID:', config.appId);
            }
        });
    </script>
</body>
</html>
```

### Mobile App (iOS/Android)

```html
<!DOCTYPE html>
<html>
<body>
    <h1 id="appName">Loading...</h1>
    
    <!-- 1. Include cordova.js FIRST -->
    <script src="cordova.js"></script>
    
    <!-- 2. Include mobile config loader -->
    <script src="js/config-loader-mobile.js"></script>
    
    <!-- 3. Wait for deviceready -->
    <script>
        document.addEventListener('deviceready', async () => {
            const config = await mobileConfigLoader.load();
            if (config) {
                document.getElementById('appName').textContent = config.appName;
                console.log('Version:', config.appVersion);
            }
        });
    </script>
</body>
</html>
```

### Config API

**Web App**:
```javascript
const config = await configLoader.load();
const appName = await configLoader.get('appName', 'Default');
const metadata = await configLoader.getMetadata();
const history = await configLoader.loadHistory(10);
await configLoader.logConfig();
await configLoader.displayTable();
```

**Mobile App**:
```javascript
const config = await mobileConfigLoader.load();
const appName = await mobileConfigLoader.get('appName', 'Default');
const metadata = await mobileConfigLoader.getMetadata();
const platform = mobileConfigLoader.getPlatform(); // 'ios', 'android', or 'web'
const history = await mobileConfigLoader.loadHistory(10);
await mobileConfigLoader.logConfig();
await mobileConfigLoader.displayTable();
```

## Complete Example

```xml
<!-- config.xml -->
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.example.app" version="1.0.0">
    <name>MyApp</name>
    <description>My App</description>
    <author email="dev@example.com" href="http://example.com">Developer</author>
    
    <!-- App Configuration -->
    <preference name="APP_NAME" value="MyApp" />
    <preference name="VERSION_NUMBER" value="1.0.0" />
    <preference name="VERSION_CODE" value="100" />
    <preference name="CDN_ICON" value="https://cdn.example.com/icon-1024.png" />
    <preference name="ENVIRONMENT" value="production" />
    
    <!-- Splash Screen - Gradient -->
    <preference name="SPLASH_GRADIENT" value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
    
    <!-- Splash Screen - Fallback Color (for web, web preview) -->
    <preference name="BackgroundColor" value="#667eea" />
    <preference name="SplashScreenBackgroundColor" value="#667eea" />
    <preference name="AndroidWindowSplashScreenBackground" value="#667eea" />
    <preference name="SplashScreenDelay" value="3000" />
    
    <!-- Webview -->
    <preference name="WEBVIEW_BACKGROUND_COLOR" value="#667eea" />
    
    <!-- Plugin -->
    <plugin name="cordova-plugin-change-app-info" spec="https://github.com/vnkhoado/cordova-plugin-change-app-info.git" />
</widget>
```

## OutSystems Integration

### Extensibility Configurations

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
        "value": "https://cdn.example.com/icon-1024.png"
      },
      {
        "name": "ENVIRONMENT",
        "value": "production"
      },
      {
        "name": "SPLASH_GRADIENT",
        "value": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
      },
      {
        "name": "BackgroundColor",
        "value": "#667eea"
      },
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#667eea"
      },
      {
        "name": "AndroidWindowSplashScreenBackground",
        "value": "#667eea"
      },
      {
        "name": "WEBVIEW_BACKGROUND_COLOR",
        "value": "#667eea"
      }
    ]
  }
}
```

## Troubleshooting

### Gradient Splash Not Showing

**Android**:
```bash
# Check drawable folder
find platforms/android -name "splash_gradient_bg.xml"

# Rebuild
cordova platform remove android
cordova platform add android
cordova build android
```

**iOS**:
```bash
# Check splash images
find platforms/ios -name "splash*.png" | wc -l
# Should be 5+ images

# Rebuild
cordova platform remove ios
cordova platform add ios
cordova build ios
```

### Config Not Found

**Web App**:
```javascript
const config = await configLoader.load();
if (!config) {
    console.log('Config not found - using defaults');
    useDefaultConfig();
}
```

**Mobile App**:
```javascript
document.addEventListener('deviceready', async () => {
    const config = await mobileConfigLoader.load();
    if (!config) {
        console.log('Config not found');
    }
});
```

### White Flash on Startup

**iOS**:
- Ensure all color preferences set to same value
- Rebuild: `cordova platform remove ios && cordova platform add ios`

**Android**:
- Check `SPLASH_GRADIENT` preference is set
- Verify drawable XML generated

## Changelog

### v2.9.11 (2025-12-17) ✨ JSON CONFIG + GRADIENT SPLASH
- **NEW**: JSON config storage - replaces sqlite (works everywhere!)
- **NEW**: Web config loader - read config in browser apps
- **NEW**: Mobile config loader - read config in iOS/Android apps
- **NEW**: Gradient splash screen support (CSS linear-gradient)
- **NEW**: Build history tracking (JSON format)
- **FIXED**: iOS Contents.json (now includes all 5 splash sizes)
- **FIXED**: iOS async/await for image generation
- **FIXED**: Android drawable path (values → drawable)
- **FIXED**: Remove ImageView reference in splash layout
- **REMOVED**: sqlite3 dependency - no longer needed

### v2.9.10 (2025-12-17) ✨ AUTO-INSTALL
- **NEW**: Auto-install optional dependencies on first build
- **NEW**: Auto-check for sharp and jimp
- **IMPROVED**: Clear status messages

### v2.9.8 (2025-12-16) 🎉 NATIVE PRE-SPLASH
- **NEW**: Native pre-splash color - no white flash on tap!
- **FEATURE**: Auto-creates Color Assets
- **IMPROVED**: Proper UILaunchScreen configuration

### v2.9.7 (2025-12-16) 🚀 MAJOR IMPROVEMENTS  
- **FIXED**: iOS app name not updating
- **FIXED**: iOS splash color on all elements
- **FIXED**: Android icon generation with validation

### v2.9.6 (2025-12-16) 🎯 iOS BACKGROUND FIX
- **NEW**: Auto-inject AppDelegate color fix
- **FEATURE**: Eliminate color flash during startup
- **IMPROVED**: Swift and Objective-C support

## License

MIT

## Author

vnkhoado

## Repository

https://github.com/vnkhoado/cordova-plugin-change-app-info
