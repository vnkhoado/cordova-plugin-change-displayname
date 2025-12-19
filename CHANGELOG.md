# Changelog

## [Unreleased] - 2025-12-19

### Fixed - Splash Screen Issues

#### Problem
- Splash screen không bị remove thực sự mặc dù log hiển thị "Splash removed successfully"
- Code cũ chỉ fade animation nhưng không thực sự xóa splash screen khỏi view hierarchy
- OutSystems MABS có splash screen mechanism riêng không tương thích với cordova-plugin-splashscreen tiêu chuẩn

#### Solution
Cải thiện `SplashScreenManager.java` với 5 chiến lược remove splash:

1. **Strategy 1**: cordova-plugin-splashscreen reflection (nếu có)
2. **Strategy 2**: Tìm và remove splash views từ ViewGroup hierarchy
   - Scan toàn bộ view tree tìm views có id/tag chứa "splash", "loading"
   - Remove khỏi parent ViewGroup
   - Set visibility = GONE
3. **Strategy 3**: OutSystems-specific splash detection
   - Tìm các IDs đặc thù: `outsystems_splash`, `os_splash`, `splash_screen`
4. **Strategy 4**: Fade animation + visibility control
   - Fade out animation
   - Set visibility = GONE sau khi animation hoàn thành
   - Scan và hide tất cả child views có liên quan đến splash
5. **Strategy 5**: Content view visibility control

#### Testing
```bash
# 1. Update plugin
cordova plugin remove cordova-plugin-change-app-info
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git

# 2. Clean build
cordova clean
cordova build android

# 3. Check logs
adb logcat | grep SplashScreenManager
```

#### Expected Log Output
```
SplashScreenManager: === Starting splash removal ===
SplashScreenManager: Strategy 1: Trying SplashScreen.hide()...
SplashScreenManager: Strategy 2: Searching for splash views in hierarchy...
SplashScreenManager: ✓ Strategy 2: Splash views removed from hierarchy
SplashScreenManager: Strategy 3: Looking for OutSystems-specific splash...
SplashScreenManager: Strategy 4: Applying fade out with visibility control...
SplashScreenManager: ✓ Strategy 4: Fade animation applied
SplashScreenManager: Splash removal completed: 3 strategies succeeded
```

### App Name Issue

#### Problem
App name không hiển thị đúng như config `APP_NAME: "NexTalent"`

#### Verification Steps

1. **Kiểm tra config đã được apply:**
```bash
# Check strings.xml
cat platforms/android/app/src/main/res/values/strings.xml
# Should contain: <string name="app_name">NexTalent</string>
```

2. **Verify trong app:**
- Launcher icon label
- Recent apps screen
- Settings > Apps

3. **Force rebuild nếu cần:**
```bash
cordova clean
cordova platform remove android
cordova platform add android
cordova build android
```

### Configuration Example

```json
{
  "preferences": {
    "global": [
      {
        "name": "APP_NAME",
        "value": "NexTalent"
      },
      {
        "name": "AutoHideSplashScreen",
        "value": "false"
      },
      {
        "name": "SplashScreenDelay",
        "value": "10000"
      }
    ]
  }
}
```

### Breaking Changes
Không có

### Technical Details

#### SplashScreenManager Improvements
- Import thêm: `ViewGroup`, `ImageView`, `LinearLayout`, `FrameLayout`
- Thêm methods:
  - `recursivelyRemoveSplashViews()`: Scan view hierarchy
  - `getViewIdName()`: Get readable view ID
  - `tryRemoveSplashFromViewHierarchy()`: Physical removal strategy
  - `tryRemoveOutSystemsSplash()`: OutSystems-specific detection
  - `tryFadeOutAndHide()`: Improved fade with visibility control
- Logging improvements: Detailed strategy execution logs
- Multiple strategy execution: All strategies run, count successes

### Known Issues
- OutSystems MABS có thể cache splash screen, cần clean build
- Một số Android versions có thể cần delay trước khi remove splash

### Workaround for Persistent Splash

Nếu splash vẫn hiện sau fix, thêm code này vào JavaScript:

```javascript
// In CustomAppReady.js or similar
setTimeout(() => {
  // Extra force hide
  if (navigator.splashscreen && navigator.splashscreen.hide) {
    navigator.splashscreen.hide();
  }
  
  // Remove splash HTML elements
  const splashElements = document.querySelectorAll('[id*="splash"], [class*="splash"]');
  splashElements.forEach(el => el.style.display = 'none');
}, 500);
```

### References
- Issue: Splash screen không tự động ẩn mặc dù log success
- Related: OutSystems MABS compatibility
- Commit: [9501e9c](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/9501e9c4f82700283824a176b578ea65620c5d42)