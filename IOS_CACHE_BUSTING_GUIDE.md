# iOS App Name & Icon Caching Issue - Complete Fix

## 🔴 Problem

When you change the app name or icon in config.xml and rebuild:

```
❌ App still shows old name: "My One Mount" (instead of "NexTalent")
❌ App still shows old icon
✅ Build completes successfully
```

This happens because:
1. **Xcode build cache** is not cleared
2. **DerivedData** folder contains old app metadata
3. **Device cache** still has old app icon and name
4. **Info.plist** changes might not be fully applied

---

## ✅ Solution 1: Clean Build (Recommended for Development)

### Complete Clean Build Script

```bash
#!/bin/bash

# 1. Remove old platforms
echo "🗑️  Removing old iOS build..."
rm -rf platforms/ios

# 2. Clean Cordova
echo "🧹 Cleaning Cordova..."
cordova clean ios

# 3. Clean Xcode build folder
echo "🧹 Cleaning Xcode DerivedData..."
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 4. Remove app from device/simulator
echo "📱 Uninstalling old app..."
# For simulator:
simctl uninstall booted com.your.app.id
# For device: manually delete from Settings > General > iPhone Storage

# 5. Fresh prepare
echo "🔨 Fresh prepare iOS..."
cordova prepare ios

# 6. Build
echo "🏗️  Building iOS..."
cordova build ios

echo "✅ Build complete!"
```

### Or Do It Manually

```bash
# Step 1: Remove iOS platform
rm -rf platforms/ios

# Step 2: Clean Cordova
cordova clean ios

# Step 3: Clear Xcode cache
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Step 4: Rebuild from scratch
cordova prepare ios
cordova build ios

# Step 5: Uninstall app from device/simulator
# Go to Settings > General > iPhone Storage > Select app > Delete

# Step 6: Reinstall
cordova run ios --device
# Or for simulator:
cordova run ios
```

---

## ✅ Solution 2: Advanced - Modify Xcode Project Directly

If you need to preserve the build but force app name/icon update:

### A. Update Info.plist Directly

```bash
#!/bin/bash

PROJECT_ROOT="$(pwd)"
INFO_PLIST="platforms/ios/NexTalent/NexTalent-Info.plist"
APP_NAME="NexTalent"

# Update app name in Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleName $APP_NAME" "$INFO_PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $APP_NAME" "$INFO_PLIST"

echo "✅ Updated Info.plist with new app name: $APP_NAME"
```

### B. Update Assets.xcassets for Icon

```bash
#!/bin/bash

INDEX_FILE="platforms/ios/NexTalent/Images.xcassets/AppIcon.appiconset/Contents.json"

echo "🔄 Clearing icon cache..."

# Remove old icon cache
rm -rf "platforms/ios/NexTalent/Images.xcassets/AppIcon.appiconset/"

# Regenerate icons (plugin will do this on next build)
cordova plugin remove cordova-plugin-change-app-info
cordova plugin add plugins/cordova-plugin-change-app-info

echo "✅ Icon cache cleared, will regenerate on next build"
```

---

## ✅ Solution 3: Use Xcode Build Settings Override

Add this to `config.xml` to force override:

```xml
<!-- config.xml -->
<platform name="ios">
    <edit-config file="*-Info.plist" mode="merge" target="CFBundleDisplayName">
        <string>NexTalent</string>
    </edit-config>
    <edit-config file="*-Info.plist" mode="merge" target="CFBundleName">
        <string>NexTalent</string>
    </edit-config>
</platform>
```

Then rebuild:

```bash
cordova prepare ios
cordova build ios
```

---

## ✅ Solution 4: Plugin-Level Cache Busting Hook

Add this hook to plugin.xml:

```xml
<!-- In plugin.xml, add to iOS platform section -->
<platform name="ios">
    <!-- Clear cache before any modifications -->
    <hook type="before_prepare" src="hooks/ios-cache-clear.js" />
    
    <!-- Existing hooks... -->
</platform>
```

Create file: `hooks/ios-cache-clear.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function clearIOSCache(context) {
  const root = context.opts.projectRoot;
  const iosPlatformPath = path.join(root, 'platforms/ios');
  
  if (!fs.existsSync(iosPlatformPath)) {
    console.log('📱 iOS platform not found, skipping cache clear');
    return;
  }
  
  console.log('\n🧹 Clearing iOS build cache...');
  
  try {
    // Remove DerivedData
    console.log('  🗑️  Removing DerivedData cache...');
    execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/*', { 
      stdio: 'pipe' 
    });
    console.log('  ✅ DerivedData cleared');
    
    // Remove build folder from platforms
    const buildPath = path.join(iosPlatformPath, 'build');
    if (fs.existsSync(buildPath)) {
      console.log('  🗑️  Removing local build folder...');
      execSync(`rm -rf "${buildPath}"`);
      console.log('  ✅ Build folder cleared');
    }
    
    // Clear icon cache
    const iconPath = path.join(
      iosPlatformPath,
      'NexTalent/Images.xcassets/AppIcon.appiconset/'
    );
    if (fs.existsSync(iconPath)) {
      console.log('  🗑️  Clearing icon cache...');
      execSync(`rm -rf "${iconPath}"`);
      console.log('  ✅ Icon cache cleared');
    }
    
    console.log('\n✅ Cache cleared successfully!\n');
    
  } catch (error) {
    console.log('⚠️  Warning: Some cache operations failed (non-fatal)');
    console.log('  This is expected on Windows or if paths are different');
  }
}

module.exports = function(context) {
  clearIOSCache(context);
};
```

---

## ✅ Solution 5: Simulator vs Device Differences

### For Simulator

```bash
# Uninstall from simulator
xcrun simctl uninstall booted com.your.bundle.id

# Clear simulator cache
xcrun simctl erase all

# Rebuild
cordova prepare ios
cordova build ios --device
cordova run ios --emulator
```

### For Real Device

```bash
# Build for device
cordova build ios --device --release

# Or with team ID
cordova build ios --device --codeSignIdentity="iPhone Developer" --provisioningProfile="UUID"

# Then:
# 1. Settings > General > iPhone Storage
# 2. Find "NexTalent" and delete
# 3. Reinstall via Xcode
# 4. Run app again
```

---

## 📋 Troubleshooting Checklist

- [ ] Did you clean `platforms/ios` folder?
- [ ] Did you run `cordova clean ios`?
- [ ] Did you remove DerivedData? (`rm -rf ~/Library/Developer/Xcode/DerivedData/*`)
- [ ] Did you uninstall app from device/simulator?
- [ ] Is the new app name in `config.xml` under `<name>` tag?
- [ ] Is the new app name in preferences `<preference name="APP_NAME" value="NexTalent" />`?
- [ ] Did you check `platforms/ios/*/Resources` for old icons?
- [ ] Did you verify `Info.plist` has new app name?

---

## 🔍 Verify Changes

After rebuild, verify the changes:

```bash
# Check Info.plist
cat platforms/ios/NexTalent/NexTalent-Info.plist | grep -A2 CFBundleName

# Should show:
# <key>CFBundleName</key>
# <string>NexTalent</string>

# Check icon path
ls -la platforms/ios/NexTalent/Images.xcassets/AppIcon.appiconset/

# Should show updated icons
```

---

## 🚀 Recommended Workflow

### For Development (During Testing)

```bash
# Script: build-clean.sh
#!/bin/bash
set -e

echo "🧹 Full clean build for iOS..."

# 1. Stop any running processes
killall -9 "Xcode" 2>/dev/null || true

# 2. Remove old build artifacts
rm -rf platforms/ios
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 3. Clean and rebuild
cordova clean ios
cordova prepare ios
cordova build ios

echo "✅ Clean build complete!"
echo "📱 Remember to uninstall old app from device/simulator"
```

Usage:
```bash
chmod +x build-clean.sh
./build-clean.sh
```

### For MABS Cloud Builds

MBAMS automatically cleans between builds, so this shouldn't be an issue on cloud.

If it is:
1. Clear build cache in MABS console
2. Force rebuild with `--no-cache` flag
3. Verify `config.xml` is committed with new app name

---

## 🎯 Quick Commands

```bash
# Complete fresh build
rm -rf platforms/ios && cordova clean ios && rm -rf ~/Library/Developer/Xcode/DerivedData/* && cordova prepare ios && cordova build ios

# Quick clean (if just icon changed)
rm -rf platforms/ios/NexTalent/Images.xcassets/AppIcon.appiconset/ && cordova prepare ios && cordova build ios

# Uninstall from simulator
xcrun simctl uninstall booted com.yourcompany.nextalent

# Full device reinstall
xcrun simctl uninstall booted com.yourcompany.nextalent && cordova run ios
```

---

## 📞 If Problem Persists

1. **Check bundle ID** - Verify it hasn't changed
2. **Check app name in 3 places:**
   - `config.xml` > `<name>` tag
   - `config.xml` > `<preference name="APP_NAME">` 
   - `platforms/ios/NexTalent/NexTalent-Info.plist` > `CFBundleDisplayName`
3. **Check icon** - Verify new icons are in `platforms/ios/NexTalent/Images.xcassets/AppIcon.appiconset/`
4. **Check provisioning profile** - Might be tied to bundle ID
5. **Reinstall completely** - Delete app, do clean build, reinstall

---

## 📚 Related Docs

- [iOS Build Fix](./IOS_BUILD_FIX.md)
- [iOS Icon Debug](./IOS_ICON_DEBUG.md)
- [Installation Guide](./INSTALLATION_GUIDE.md)
