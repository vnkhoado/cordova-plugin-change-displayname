# Code Cleanup & Refactoring Notes

## 📝 Summary

This refactoring consolidates duplicate splash screen and color customization code into a single, maintainable hook.

### Changes Made

#### ✅ Enhanced Files

**hooks/utils.js**
- Added `validateHexColor(color)` - Validate hex color format
- Added `normalizeHexColor(color)` - Ensure # prefix and validate
- Exported both functions for reuse across hooks
- Now serves as single source of truth for color utilities

#### ✨ New Files

**hooks/customizeColors.js** (UNIFIED HOOK)
- Single source of truth for all color customization
- Supports both splash screen and webview background colors
- Uses `safeWriteFile()` from utils.js consistently
- Replaces 6 duplicate hooks (see below)

#### ❌ Removed/Deprecated Hooks

The following hooks are **NO LONGER USED** and can be deleted:

1. **customizeSplashScreen.js** - Duplicated in customizeColors.js
2. **forceOverrideSplashColor.js** - Duplicated in customizeColors.js
3. **forceOverrideNativeColors.js** - Duplicated in customizeColors.js
4. **scanAndReplaceColor.js** - Duplicate functionality
5. **native-gradient-splash.js** - Duplicate functionality
6. **forceMBASSplashColor.js** - Duplicate functionality

**Note:** These files remain in the repository for reference but are NOT referenced in plugin.xml anymore.

#### 🔄 Updated Files

**plugin.xml**
- Removed all references to the 6 duplicate hooks
- Added single `customizeColors.js` hook in after_prepare phase
- Added clear phase comments (CLEANUP, PREPARE, CUSTOMIZE, INJECT, BUILD)
- Updated description to reflect removed splash screen toggle feature
- Removed outdated SplashScreenManager notes

## 🎯 What Was Removed

### Splash Screen Toggle (NOT WORKING ANYWAY)
- SplashScreenManager class (Android)
- Splash screen hide/show functionality
- Associated native code features

**Reason:** This feature was not functioning properly and is not part of core functionality.

### Duplicate Code
Reduced ~9KB of duplicate color transformation code into a single 10KB unified hook.

## 📋 Supported Configuration (config.xml)

```xml
<preference name="SplashScreenBackgroundColor" value="#FFFFFF" />
<preference name="WEBVIEW_BACKGROUND_COLOR" value="#FFFFFF" />
```

Or:

```xml
<preference name="AndroidWindowSplashScreenBackground" value="#FFFFFF" />
<preference name="WebviewBackgroundColor" value="#FFFFFF" />
```

## 🔍 Hook Execution Flow (Android)

```
cordova build android
├─ CLEANUP PHASE (before_prepare)
│  ├─ downloadCDNResources.js
│  ├─ auto-copy-config-files.js
│  ├─ auto-install-deps.js
│  └─ backupAppInfo.js
├─ PREPARE PHASE (after_prepare)
│  ├─ removeConflictingStringsXml.js
│  ├─ changeAppInfo.js ← Update app name/version
│  ├─ generateIcons.js
│  └─ injectBuildInfo.js
├─ CUSTOMIZE PHASE (after_prepare)
│  ├─ customizeColors.js ← UNIFIED COLOR HOOK
│  └─ customizeWebview.js
├─ INJECT PHASE (after_prepare)
│  ├─ injectAppReadyManager.js
│  └─ inject-css-native-code.js
└─ BUILD PHASE (after_build)
   └─ sendBuildSuccess.js
```

## 🔍 Hook Execution Flow (iOS)

```
cordova build ios
├─ CLEANUP PHASE (before_prepare)
│  ├─ downloadCDNResources.js
│  ├─ auto-copy-config-files.js
│  ├─ auto-install-deps.js
│  └─ ios-cache-clear.js
├─ PREPARE PHASE (after_prepare)
│  ├─ ios/unified-prepare-standalone.js
│  └─ ios/inject-gradient-splash.js
├─ CUSTOMIZE PHASE (after_prepare)
│  └─ customizeColors.js ← UNIFIED COLOR HOOK
├─ INJECT PHASE (after_prepare)
│  ├─ inject-css-native-code.js
│  └─ injectAppReadyManager.js
├─ COMPILE PHASE (before_compile)
│  └─ ios/force-metadata-override.js
└─ BUILD PHASE
   ├─ ios/unified-build.js (before_build)
   └─ sendBuildSuccess.js (after_build)
```

## ✨ Benefits

1. **Reduced Complexity** - 6 hooks → 1 unified hook
2. **Better Maintainability** - Single source of truth for colors
3. **Code Reuse** - Leverages utils.js consistently
4. **Clear Phase Structure** - Hook execution phases are now clearly documented
5. **Easier Debugging** - Fewer hooks to trace through

## 🚨 Migration Notes

### For Plugin Users

**Color preferences remain the same:**
```xml
<!-- Still works -->
<preference name="SplashScreenBackgroundColor" value="#FFFFFF" />
<preference name="WEBVIEW_BACKGROUND_COLOR" value="#FFFFFF" />
```

### Breaking Changes

**REMOVED:** Splash screen toggle feature
- SplashScreenManager.hide() is no longer available
- This was a non-core feature and was not working reliably

### Testing Checklist

- [ ] Android build completes without errors
- [ ] iOS build completes without errors
- [ ] Splash screen colors apply correctly
- [ ] Webview background colors apply correctly
- [ ] App name and version update as expected
- [ ] Icons generate correctly
- [ ] No console errors from hooks

## 📚 Related Documentation

- See `hooks/utils.js` for all utility functions
- See `hooks/customizeColors.js` for color customization logic
- See `plugin.xml` for hook execution order
