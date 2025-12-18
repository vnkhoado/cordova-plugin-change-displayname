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

✅ **Auto-Copy Build Config** (NEW in v2.9.12)
- Automatically copies config files to `www/` directory
- Prevents Cordova from deleting essential files during prepare
- Runs before all other hooks in build pipeline
- Works seamlessly - no configuration needed!

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

## How Auto-Copy Hook Works

### Problem Solved

Cordova's `prepare` step automatically deletes all files from `platforms/www/` that don't exist in the project's `www/` directory. This caused `build-config.json` to be deleted BEFORE the `injectBuildInfo` hook could update it.

**Build Flow (Before Fix)**:
```
cordova build
├─ Merge www/ files to platforms/www/
├─ Delete files not in www/ ← build-config.json deleted here ✗
├─ Run after_prepare hooks
│  └─ injectBuildInfo tries to update it ✗ (already deleted)
```

### Solution

The new `auto-copy-config-files.js` hook runs in the `before_prepare` phase and copies essential files into `www/`. This makes them "source files" so Cordova won't delete them.

**Build Flow (After Fix)**:
```
cordova build
├─ Run before_prepare hooks
│  └─ auto-copy-config-files copies templates to www/ ✓
├─ Merge www/ files to platforms/www/
├─ Delete files not in www/ (build-config.json stays since it's in www/) ✓
├─ Run after_prepare hooks
│  └─ injectBuildInfo updates build-config.json ✓ (file exists)
```

### What The Hook Does

✅ Creates `www/.cordova-app-data/` directory
✅ Creates `www/.cordova-app-data/build-config.json` template
✅ Creates `www/.cordova-app-data/build-history.json` template
✅ Copies `config-loader.js` to `www/js/`
✅ Copies `config-loader-mobile.js` to `www/js/`
✅ Warns if script tag missing from index.html

### Build Log Output

You'll see output like this during `cordova build`:

```
════════════════════════════════════════════════════════════════
  AUTO-COPY CONFIG FILES - Preserving source files
════════════════════════════════════════════════════════════════

✅ Created directory: www/.cordova-app-data
✅ Created directory: www/js
✅ Created: www/.cordova-app-data/build-config.json
✅ Created: www/.cordova-app-data/build-history.json
✅ Copied: www/js/config-loader.js
✅ Copied: www/js/config-loader-mobile.js
✅ Script tag found in index.html

════════════════════════════════════════════════════════════════
✅ Auto-copy completed! Files preserved for injectBuildInfo
════════════════════════════════════════════════════════════════
```

### No Configuration Needed

The hook is **automatically registered** for both Android and iOS platforms. It runs with every `cordova build` and `cordova prepare` automatically.

No additional setup required! Just build as usual:

```bash
cordova build android
# Hook runs automatically ✓
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

### Build Config Not Created

**Symptom**: `build-config.json` file not found in app

**Solution**: This is now fixed by the auto-copy hook! If still having issues:

```bash
# 1. Check files in www/
ls -la www/.cordova-app-data/
ls -la www/js/config-loader*.js

# 2. Check build log for auto-copy messages
cordova build android --verbose 2>&1 | grep -i "auto-copy"

# 3. Clean and rebuild
cordova clean
cordova platform remove android
cordova platform add android
cordova build android --verbose
```

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

### v2.9.12 (2025-12-18) ✨ AUTO-COPY HOOK
- **NEW**: Auto-copy hook - prevents build config deletion during prepare
- **FEATURE**: Runs before_prepare - copies files before Cordova deletes them
- **FIXED**: build-config.json no longer deleted
- **IMPROVED**: No user setup needed - automatic!
- **DOCS**: Added troubleshooting and how-it-works section

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
