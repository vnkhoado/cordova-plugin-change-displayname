# Testing Guide - Splash Screen & App Name Fix

## 🎯 Overview

Hướng dẫn test chi tiết các fix cho:
1. **Splash screen không tự động ẩn**
2. **App name không hiển thị đúng**

---

## 🛠️ Setup

### 1. Update Plugin

```bash
# Remove old version
cordova plugin remove cordova-plugin-change-app-info

# Add fixed version
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git

# Clean build
cordova clean
```

### 2. Verify Config

Check your `config.json` hoặc `config.xml`:

```json
{
  "preferences": {
    "global": [
      {
        "name": "APP_NAME",
        "value": "NexTalent"  // ✓ Set app name
      },
      {
        "name": "AutoHideSplashScreen",
        "value": "false"  // ✓ Let plugin handle splash removal
      },
      {
        "name": "SplashScreenDelay",
        "value": "10000"  // ✓ Max delay before timeout
      }
    ]
  }
}
```

---

## 📱 Test 1: Splash Screen Removal

### Build & Install

```bash
# Build Android
cordova build android

# Install to device
adb install -r platforms/android/app/build/outputs/apk/debug/app-debug.apk

# Or run directly
cordova run android
```

### Monitor Logs

Mở terminal riêng và chạy:

```bash
adb logcat -s SplashScreenManager:D chromium:I
```

### Expected Success Output

```
SplashScreenManager: === Starting splash removal ===
SplashScreenManager: Strategy 1: Trying SplashScreen.hide() via reflection...
SplashScreenManager: ✗ Strategy 1: cordova-plugin-splashscreen not available
SplashScreenManager: Strategy 2: Searching for splash views in hierarchy...
SplashScreenManager:   Checking view: FrameLayout id=content tag=
SplashScreenManager:   Checking view: LinearLayout id=splash_screen tag=
SplashScreenManager:   Found potential splash view: splash_screen
SplashScreenManager:   ✓ Removed splash view from parent
SplashScreenManager: ✓ Strategy 2: Splash views removed from hierarchy
SplashScreenManager: Strategy 3: Looking for OutSystems-specific splash...
SplashScreenManager:   Found OutSystems splash: outsystems_splash
SplashScreenManager:   ✓ Removed OutSystems splash
SplashScreenManager: ✓ Strategy 3: OutSystems splash removed
SplashScreenManager: Strategy 4: Applying fade out with visibility control...
SplashScreenManager:   Fade animation started
SplashScreenManager: ✓ Strategy 4: Fade animation applied
SplashScreenManager:   Fade animation completed - setting visibility to GONE
SplashScreenManager:   Hidden child view: splash_logo
SplashScreenManager: Strategy 5: Trying dialog dismissal...
SplashScreenManager: ✓ Strategy 5: Content view made visible
SplashScreenManager: Splash removal completed: 4 strategies succeeded
SplashScreenManager: === Splash removal completed ===
```

### Visual Verification

1. **Launch app**
2. **Observe splash screen:**
   - Should show briefly (2-3 seconds)
   - Should fade out smoothly
   - Should NOT stick on screen
3. **Main screen should appear** immediately after fade

### Failure Indicators

❌ **FAIL** nếu:
- Splash screen vẫn hiện sau 5+ seconds
- Log shows: `Splash removal completed: 0 strategies succeeded`
- App freezes with splash visible

---

## 🏷️ Test 2: App Name Display

### Check Build Output

```bash
# Verify strings.xml generated correctly
cat platforms/android/app/src/main/res/values/strings.xml
```

**Expected:**
```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">NexTalent</string>
    <!-- other strings -->
</resources>
```

### Visual Verification

1. **Launcher Icon:**
   - Open app drawer
   - Check icon label = "NexTalent" (not old name)

2. **Recent Apps:**
   - Open recent apps (square button)
   - App name in overview = "NexTalent"

3. **Settings > Apps:**
   - Go to Settings > Apps
   - Find your app
   - Name should be "NexTalent"

### Troubleshooting App Name

Nếu app name vẫn SAI:

```bash
# 1. Force clean
cordova clean

# 2. Remove platform entirely
cordova platform remove android

# 3. Re-add platform
cordova platform add android

# 4. Rebuild
cordova build android

# 5. Check strings.xml again
grep -A 1 "app_name" platforms/android/app/src/main/res/values/strings.xml
```

---

## 🔍 Debug Mode: Detailed Logging

Nếu vẫn gặp vấn đề, bật debug logging:

### Enable All Logs

```bash
adb logcat -c  # Clear logs
adb logcat | grep -E "(SplashScreenManager|chromium|AppReadyManager|CustomAppReady)"
```

### Key Events Timeline

```
[Time] [AppReadyManager] Initializing splash manager...
[Time] [CustomAppReady] Initializing...
[Time] [CustomAppReady] Screen rendered
[Time] [CustomAppReady] Calling window.appReady()
[Time] [AppReadyManager] App ready! Calling native SplashScreenManager.removeSplash()...
[Time] SplashScreenManager: === Starting splash removal ===
[Time] SplashScreenManager: Splash removal completed: N strategies succeeded
[Time] [AppReadyManager] Splash removed: Splash removed successfully
```

---

## ⚙️ Advanced Testing

### Test Different Config Scenarios

#### Scenario 1: AutoHideSplashScreen = true

```json
{
  "name": "AutoHideSplashScreen",
  "value": "true"  // Test native auto-hide
}
```

**Expected:** Splash disappears automatically after `SplashScreenDelay`

#### Scenario 2: No APP_NAME set

```json
// Remove APP_NAME preference entirely
```

**Expected:** 
- Hook logs: `App Name: không thay đổi`
- Default name from root config.xml used

#### Scenario 3: Short SplashScreenDelay

```json
{
  "name": "SplashScreenDelay",
  "value": "3000"  // 3 seconds only
}
```

**Expected:** Timeout fires earlier, forces splash removal

---

## 🐛 Common Issues & Solutions

### Issue 1: Splash Vẫn Hiện

**Symptoms:**
```
Log: Splash removal completed: 0 strategies succeeded
```

**Solution:**
1. Check if OutSystems MABS uses custom splash mechanism
2. Add manual JavaScript fallback:

```javascript
// Add to CustomAppReady.js
setTimeout(() => {
  const splashElements = document.querySelectorAll('[id*="splash"], [class*="splash"]');
  splashElements.forEach(el => {
    el.style.display = 'none';
    el.style.visibility = 'hidden';
  });
  
  // Force body visible
  document.body.style.visibility = 'visible';
}, 500);
```

### Issue 2: App Name Không Thay Đổi

**Symptoms:**
- strings.xml chứa old name
- Hoặc không có `app_name` entry

**Solution:**
```bash
# Manual verification
echo "Check strings.xml:"
cat platforms/android/app/src/main/res/values/strings.xml

# If wrong, check hook execution
cordova build android --verbose 2>&1 | grep "CHANGE APP INFO"
```

### Issue 3: Multiple Splash Screens

**Symptoms:** 2 splash screens appear (native + custom)

**Solution:** Remove duplicate splash plugins:
```bash
cordova plugin list | grep splash
# If cordova-plugin-splashscreen exists:
cordova plugin remove cordova-plugin-splashscreen
```

---

## ✅ Success Criteria

### Splash Screen
- [ ] Splash shows for 2-5 seconds
- [ ] Smooth fade out animation
- [ ] Main screen appears immediately after
- [ ] No frozen splash screen
- [ ] Log shows 2+ strategies succeeded

### App Name
- [ ] Launcher icon has correct name
- [ ] Recent apps shows correct name
- [ ] Settings > Apps shows correct name
- [ ] strings.xml contains `<string name="app_name">YourAppName</string>`

---

## 📞 Support

Nếu vẫn gặp vấn đề:

1. **Collect logs:**
   ```bash
   adb logcat > logcat.txt
   # Reproduce issue
   # Ctrl+C to stop
   ```

2. **Share diagnostic info:**
   - Android version
   - Cordova version (`cordova -v`)
   - Plugin version
   - Full logcat.txt
   - Config excerpt

3. **Create issue:** [GitHub Issues](https://github.com/vnkhoado/cordova-plugin-change-app-info/issues)

---

## 📚 Additional Resources

- [CHANGELOG.md](CHANGELOG.md) - Các thay đổi chi tiết
- [README.md](README.md) - Tài liệu plugin
- [Commit 9501e9c](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/9501e9c4f82700283824a176b578ea65620c5d42) - Fix commit