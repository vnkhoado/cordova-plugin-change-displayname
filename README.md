# cordova-plugin-change-app-info

Cordova plugin to change app info (display name, version, icon) from CDN at build time. Stores app configuration in JSON format accessible from web and mobile apps. **Optimized for OutSystems MABS**.

## Features

✅ **Dynamic App Configuration**
- Set app display name dynamically
- Configure version number and build code
- Download and set app icon from CDN URL (requires sharp or jimp)

✅ **JSON Config Storage**
- Saves app info to `.cordova-app-data/build-config.json`
- Accessible from web apps via `configLoader.load()`
- Accessible from mobile apps via `mobileConfigLoader.load()`
- Tracks build history (last 50 builds)
- **No sqlite needed!** Works on all cloud builds

✅ **UI Customization**
- **Splash screen color**: Custom background color for native splash screen
- **Webview background color**: Eliminate white flash on app launch
- **Works with OutSystems MABS**: Properly overrides theme colors

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

### Splash Screen Color

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
4. Result: Your color preference wins everywhere!

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
    
    <!-- Splash Screen Color -->
    <preference name="BackgroundColor" value="#001833" />
    <preference name="SplashScreenBackgroundColor" value="#001833" />
    <preference name="AndroidWindowSplashScreenBackground" value="#001833" />
    <preference name="SplashScreenDelay" value="3000" />
    
    <!-- Webview -->
    <preference name="WEBVIEW_BACKGROUND_COLOR" value="#001833" />
    
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
  }
}
```

## Troubleshooting

### Build Config Not Created

**Symptom**: `build-config.json` file not found in app

**Solution**: Clean and rebuild:

```bash
# 1. Clean build artifacts
cordova clean

# 2. Remove and re-add platforms
cordova platform remove android
cordova platform add android

# 3. Build with verbose output
cordova build android --verbose
```

### Splash Color Not Applied

**Android**:
```bash
# Verify colors.xml
grep "splash_background" platforms/android/app/src/main/res/values/colors.xml

# Rebuild
cordova platform remove android
cordova platform add android
cordova build android
```

**iOS**:
```bash
# Check LaunchScreen
find platforms/ios -name "LaunchScreen.storyboard"

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
- Verify `SplashScreenBackgroundColor` preference is set
- Check `colors.xml` has `splash_background` color

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

### v2.9.12+ (2025-12-20) 🚀 CLEANUP & REFACTOR
- **REFACTORED**: Consolidated 6 duplicate splash color hooks into unified `customizeColors.js`
- **REMOVED**: Splash screen toggle feature (was not working)
- **CLEANED**: Removed obsolete documentation files
- **IMPROVED**: Better code organization and maintainability
- **DOCS**: Updated with simplified, cleaner examples

## License

MIT

## Author

vnkhoado

## Repository

https://github.com/vnkhoado/cordova-plugin-change-app-info
