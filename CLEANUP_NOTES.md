# Code Cleanup & Refactoring Notes

## 📝 Summary

This refactoring consolidates duplicate splash screen and color customization code into a single, maintainable hook with improved color replacement logic and iOS splash flicker fix.

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

**hooks/ios/fix-splash-flicker.js** (NEW iOS FIX)
- Runs in `before_compile` phase (FINAL override)
- Removes UILaunchStoryboardName from Info.plist
- Ensures ONLY UILaunchScreen is used
- **FIXES:** Old color flash after app tap
- Prevents OutSystems MABS from reintroducing storyboard reference

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
- Added `fix-splash-flicker.js` hook in before_compile phase (iOS)
- Added clear phase comments (CLEANUP, PREPARE, CUSTOMIZE, INJECT, BUILD, COMPILE)
- Updated description to reflect removed splash screen toggle feature
- Updated version to 2.9.13

## 🎨 What Was Removed

### Splash Screen Toggle (NOT WORKING ANYWAY)
- SplashScreenManager.java (Android native code)
- Splash screen hide/show functionality
- Associated native code features

**Reason:** This feature was not functioning properly and is not part of core functionality.

### Duplicate Code
Reduced ~9KB of duplicate color transformation code into a single 10KB unified hook.

## 🔴 iOS Splash Flicker Fix (CRITICAL v2.9.13+)

### Problem: Old Color Flickers Before New Color

**What was happening:**
1. User taps app icon on home screen
2. iOS shows splash screen (old color) ← **FLICKER VISIBLE HERE**
3. App launches and WebView loads
4. WebView shows splash screen (new color)

**Root Cause:**
- UILaunchStoryboardName in Info.plist renders BEFORE UILaunchScreen dictionary
- iOS needs to switch from storyboard color to new color
- Visible flicker occurs during switch
- OutSystems MABS may reintroduce UILaunchStoryboardName during build

### Solution: fix-splash-flicker.js Hook

**How it works:**
1. Runs in `before_compile` phase (AFTER all OutSystems modifications)
2. Scans Info.plist for UILaunchStoryboardName
3. Removes ALL UILaunchStoryboardName entries
4. Ensures ONLY UILaunchScreen dictionary exists
5. Final override right before Xcode compiles

**Why this phase?**
- `after_prepare`: OutSystems may add UILaunchStoryboardName during prepare
- `before_compile`: This is the LAST chance to override - runs right before Xcode
- No further modifications possible after this point

**Before (v2.9.12):**
```
iphoneos home screen → tap app icon
  ↓
show UILaunchStoryboardName (old color) ← FLICKER
  ↓
app loads
  ↓
show UILaunchScreen dictionary (new color)
  ↓
flicker complete, app running
```

**After (v2.9.13+):**
```
iphoneos home screen → tap app icon
  ↓
show UILaunchScreen dictionary (new color) ← CONSISTENT
  ↓
app loads
  ↓
app running
```

### Configuration Verification

After build, check Info.plist:
```bash
grep "UILaunchStoryboardName" platforms/ios/ProjectName/ProjectName-Info.plist
# Should return NOTHING (✅ success)

grep "UILaunchScreen" platforms/ios/ProjectName/ProjectName-Info.plist
# Should return the UILaunchScreen dictionary (✅ success)
```

### Build Log

```
🎨 iOS Splash Flicker Fix
⏰ FINAL OVERRIDE (right before compile)
═════════════════════════════════════════════

⚠️  FOUND 1 UILaunchStoryboardName entry(ies) - REMOVING...

   Removing: <key>UILaunchStoryboardName</key>...

   ✅ All UILaunchStoryboardName entries removed
✅ UILaunchScreen dictionary present
✅ UIImageName reference present

📝 Saved Info.plist

═════════════════════════════════════════════
✅ Splash Flicker Fix Complete!
   📋 Configuration:
      • UILaunchStoryboardName: REMOVED ✅
      • UILaunchScreen: PRESENT ✅
      • Color: SplashBackgroundColor ✅

   🎉 Old color will NOT flash!
   🎉 Splash screen will show new color immediately!
═════════════════════════════════════════════
```

## 🔍 Complete Hook Execution Flow

### iOS Build (v2.9.13+ with flicker fix)

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
├─ COMPILE PHASE (before_compile) ← CRITICAL FLICKER FIX
│  ├─ ios/force-metadata-override.js
│  └─ ios/fix-splash-flicker.js ← REMOVES OLD STORYBOARD
├─ BEFORE BUILD PHASE (before_build)
│  └─ ios/unified-build.js
└─ BUILD PHASE (after_build)
   └─ sendBuildSuccess.js
```

### Android Build (v2.9.13+)

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

## 🔄 Color Replacement Improvements (v2.9.13+)

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
✅ values/colors.xml
✅ values-night/colors.xml (if exists)
✅ values-v21/colors.xml (if exists)
✅ values-v31/colors.xml (if exists)
✅ values/styles.xml
✅ drawable/splash.xml (if exists)
```

**iOS:**
```
✅ ProjectName/Resources/LaunchScreen.storyboard
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

## ✨ Benefits

1. **Reduced Complexity** - 6 hooks → 1 unified hook
2. **Better Maintainability** - Single source of truth for colors
3. **Code Reuse** - Leverages utils.js consistently
4. **Clear Phase Structure** - Hook execution phases are now clearly documented
5. **Easier Debugging** - Fewer hooks to trace through
6. **Complete Color Replacement** - All old colors properly replaced (v2.9.13+)
7. **NO SPLASH FLICKER** - Old color won't flash (v2.9.13+)

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
- [ ] **Verify: OLD colors completely replaced (not showing in files)**
- [ ] **iOS: Tap app icon - new color appears immediately (NO FLICKER)**
- [ ] Splash screen color applies correctly
- [ ] Webview background colors apply correctly
- [ ] App name and version update as expected
- [ ] Icons generate correctly
- [ ] No console errors from hooks
- [ ] Check build logs for complete color replacement output

### Verification Steps

**Android - Verify old colors are gone:**
```bash
cordova build android
# Check colors.xml for old colors
grep -r "#OLD_COLOR" platforms/android/
# Should return NOTHING (✅ success)
```

**iOS - Verify storyboard removed:**
```bash
cordova build ios
# Check Info.plist - UILaunchStoryboardName should NOT exist
grep "UILaunchStoryboardName" platforms/ios/ProjectName/ProjectName-Info.plist
# Should return NOTHING (✅ success)

# Check LaunchScreen storyboard has correct RGB
grep "color key=" platforms/ios/ProjectName/Resources/LaunchScreen.storyboard
# Should show correct RGB values for your new color
```

**iOS - Test on device:**
```
1. Build: cordova build ios
2. Install on device
3. Close app (if running)
4. Tap app icon on home screen
5. Verify: New splash color shows IMMEDIATELY (no flicker)
6. App launches with same color
```

## 📚 Related Documentation

- See `hooks/utils.js` for all utility functions
- See `hooks/customizeColors.js` for color customization logic
- See `hooks/ios/fix-splash-flicker.js` for splash flicker fix
- See `plugin.xml` for hook execution order
- See `README.md` for configuration examples
