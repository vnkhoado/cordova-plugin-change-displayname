# Code Cleanup & Refactoring Notes

## 📝 Summary

This refactoring consolidates duplicate splash screen and color customization code into a single, maintainable hook with improved color replacement logic.

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
- **IMPROVED:** Complete color replacement with advanced regex patterns
- **FIXED:** Now replaces ALL old colors in all files
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
- Updated version to 2.9.13

## 🎯 What Was Removed

### Splash Screen Toggle (NOT WORKING ANYWAY)
- SplashScreenManager.java (Android native code)
- Splash screen hide/show functionality
- Associated native code features

**Reason:** This feature was not functioning properly and is not part of core functionality.

### Duplicate Code
Reduced ~9KB of duplicate color transformation code into a single 10KB unified hook.

## 🔧 Color Replacement Improvements (v2.9.13+)

### Problem
Old color values were not being completely replaced because:
1. Limited regex patterns only caught specific color formats
2. Multiple color values in different files weren't all being updated
3. Case sensitivity issues (#FFFFFF vs #ffffff)

### Solution: Enhanced customizeColors.js

**New Features:**
1. **Complete Hex Scan** - Scans all hex colors in file and replaces non-target colors
2. **Case Insensitive** - Handles #FFFFFF, #ffffff, #FFF, #fff
3. **Multi-file Support** - Updates all values/colors.xml variants
4. **Deep Color Replacement** - Replaces in:
   - `colors.xml` (all color definitions)
   - `styles.xml` (theme items and color references)
   - `splash.xml` drawable (solid color elements)
   - All `values-*/colors.xml` (variant densities)
   - iOS `LaunchScreen.storyboard`

**Implementation Details:**

```javascript
// Strategy 1: Named colors
<color name="colorPrimary">#OLD_COLOR</color>
↓
<color name="colorPrimary">#NEW_COLOR</color>

// Strategy 2: Hex replacement
All occurrences of #OLDXXX → #NEWXXX (everywhere)

// Strategy 3: Multiple occurrences
Each file is scanned for ALL hex colors
Only non-target colors are replaced
```

### Files Modified by New Hook

**Android:**
```
✓ values/colors.xml
✓ values-night/colors.xml (if exists)
✓ values-v21/colors.xml (if exists)
✓ values-v31/colors.xml (if exists)
✓ values/styles.xml
✓ drawable/splash.xml (if exists)
```

**iOS:**
```
✓ ProjectName/Resources/LaunchScreen.storyboard
```

### Color Replacement Log Output

You'll see detailed output like:
```
🎨 CUSTOMIZE COLORS (Splash + Webview)
════════════════════════════════════════════
Splash Color: #001833

📱 Processing android...
   ✓ Overrode colorPrimary
   ✓ Overrode colorPrimaryDark
   ✓ Added splash_background
   ✓ Replaced 3 occurrence(s) of #003D66
   ✓ Replaced 2 occurrence(s) of #0366d6
   ✓ Updated AppTheme windowBackground
   📝 Saved colors.xml
   📝 Saved styles.xml
   📝 Saved drawable/colors.xml
   ✅ Android splash configured: #001833
```

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
│  ├─ customizeColors.js ← UNIFIED COLOR HOOK (IMPROVED)
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
│  └─ customizeColors.js ← UNIFIED COLOR HOOK (IMPROVED)
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
6. **Complete Color Replacement** - All old colors properly replaced (v2.9.13+)

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
- [ ] **Verify old colors are completely replaced** (v2.9.13+)
- [ ] Webview background colors apply correctly
- [ ] App name and version update as expected
- [ ] Icons generate correctly
- [ ] No console errors from hooks
- [ ] Check build logs for complete color replacement output

### Verification Steps

To verify colors were replaced completely:

**Android:**
```bash
# Check colors.xml for old colors
grep -r "#OLD_COLOR" platforms/android/
# Should return nothing

# Check styles.xml
grep -r "android:color" platforms/android/app/src/main/res/values/styles.xml
# Should show your new color
```

**iOS:**
```bash
# Check LaunchScreen.storyboard
grep "color key=" platforms/ios/ProjectName/Resources/LaunchScreen.storyboard
# Should show correct RGB values for your color
```

## 📚 Related Documentation

- See `hooks/utils.js` for all utility functions
- See `hooks/customizeColors.js` for color customization logic
- See `plugin.xml` for hook execution order
- See `README.md` for configuration examples
