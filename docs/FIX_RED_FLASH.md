# Fix Red Flash After Splash Screen

Enhanced Cordova hook to fix red/purple flash after splash screen on Android.

## Problem

When launching a Cordova Android app with dark theme (`#001833`), there's a noticeable red/purple flash between the splash screen and the main app. This happens because:

1. The Android system default window background (often red/purple) is shown briefly
2. The WebView takes time to initialize and render
3. The app's CSS is loaded after the window is already visible

## Solution

This hook (`hooks/fix-red-flash-enhanced.js`) implements **two complementary solutions** that work together:

### 1️⃣ MainActivity.java Patch (Code-level)

- **What**: Injects background color setting code into `MainActivity.java`
- **When**: BEFORE `super.onCreate()` is called
- **Why**: Ensures the window background is set before any view hierarchy is created
- **How**: 
  ```java
  @Override
  public void onCreate(Bundle savedInstanceState) {
      // FIX_RED_FLASH_ENHANCED: Set BEFORE super.onCreate()
      try {
          int bgColor = Color.parseColor("#001833");
          getWindow().setBackgroundDrawable(new ColorDrawable(bgColor));
          getWindow().getDecorView().setBackgroundColor(bgColor);
      } catch (Exception e) {
          android.util.Log.e("FixRedFlash", "Failed to set background: " + e.getMessage());
      }
      
      super.onCreate(savedInstanceState);
      // ...
  }
  ```

### 2️⃣ Theme-based Background (OS-level)

- **What**: Adds `android:windowBackground` to the activity theme
- **When**: Applied by Android OS when creating the activity window
- **Why**: Provides the earliest possible background color
- **How**: Updates both `AndroidManifest.xml` and `styles.xml`
  ```xml
  <!-- AndroidManifest.xml -->
  <activity android:name="MainActivity"
            android:theme="@style/AppTheme.NoActionBar.FullScreen">
  
  <!-- styles.xml -->
  <style name="AppTheme.NoActionBar.FullScreen">
      <item name="android:windowBackground">#001833</item>
  </style>
  ```

## Installation

### Option 1: Use from this plugin

If you're already using `cordova-plugin-change-app-info`, the hook is available at:
```
hooks/fix-red-flash-enhanced.js
```

### Option 2: Standalone installation

1. **Copy the hook file:**
   ```bash
   mkdir -p hooks
   curl -o hooks/fix-red-flash-enhanced.js https://raw.githubusercontent.com/vnkhoado/cordova-plugin-change-app-info/update-cordova-template-files/hooks/fix-red-flash-enhanced.js
   ```

2. **Register in config.xml:**
   ```xml
   <platform name="android">
       <hook type="after_prepare" src="hooks/fix-red-flash-enhanced.js" />
   </platform>
   ```

3. **Rebuild your app:**
   ```bash
   cordova clean android
   cordova prepare android
   cordova build android
   ```

## Configuration

### Customize Background Color

Edit the hook file and change the `BACKGROUND_COLOR` constant:

```javascript
const BACKGROUND_COLOR = '#001833'; // Change to your app's background color
```

**Important**: The color should match your app's main background color to ensure a seamless transition.

## How It Works

### Timeline Comparison

**Before (with flash):**
```
Activity start → super.onCreate() → View created → Background set ❌
                 ↑ Red/purple flash happens here
```

**After (no flash):**
```
Activity start → Theme applied ✅ → Our code runs ✅ → super.onCreate() → View created
```

### What the Hook Does

The hook runs during the `after_prepare` phase and:

1. **Patches MainActivity.java**
   - Searches for `MainActivity.java` in the Android platform directory
   - Adds required imports (`Color`, `ColorDrawable`)
   - Injects background-setting code BEFORE `super.onCreate()`
   - Marks the code with `FIX_RED_FLASH_ENHANCED` to prevent duplicate patches

2. **Updates AndroidManifest.xml**
   - Finds the MainActivity declaration
   - Sets or updates the `android:theme` attribute
   - Uses `@style/AppTheme.NoActionBar.FullScreen` as the default theme name

3. **Updates styles.xml**
   - Locates or creates the theme style
   - Adds/updates `android:windowBackground` item with the specified color
   - Creates the style if it doesn't exist

## Technical Details

### Files Modified

The hook modifies these files in your Cordova project:

- `platforms/android/app/src/main/java/.../MainActivity.java`
- `platforms/android/app/src/main/AndroidManifest.xml`
- `platforms/android/app/src/main/res/values/styles.xml`

**Note**: These are generated files, so the modifications are re-applied on each build.

### Dependencies

- `xmldom` package (included in most Cordova projects by default)
- Cordova Android platform 9.0.0 or higher (recommended)

## Troubleshooting

### Hook doesn't run

**Symptoms**: No log output from the hook during build

**Solutions**:
1. Verify the hook is registered in `config.xml`
2. Check the path is correct (relative to project root)
3. Ensure the hook file is executable:
   ```bash
   chmod +x hooks/fix-red-flash-enhanced.js
   ```

### Build errors after applying hook

**Symptoms**: Java compilation errors

**Solutions**:
1. Check Cordova Android platform version:
   ```bash
   cordova platform ls
   ```
2. Update to latest if needed:
   ```bash
   cordova platform rm android
   cordova platform add android@latest
   ```

### Flash still appears

**Symptoms**: Red/purple flash is still visible

**Solutions**:
1. **Verify background color matches**: The `BACKGROUND_COLOR` in the hook should match your app's CSS background
2. **Check build logs**: Look for error messages from the hook
3. **Clean build**:
   ```bash
   cordova clean android
   rm -rf platforms/android
   cordova platform add android
   cordova build android
   ```
4. **Verify patch was applied**: Check `MainActivity.java` for `FIX_RED_FLASH_ENHANCED` comment
5. **Check styles.xml**: Verify `android:windowBackground` was added

### Hook runs but changes are not visible

**Symptoms**: Hook logs success but MainActivity.java doesn't have the injected code

**Solutions**:
1. The platforms directory might be overwritten. Ensure the hook runs after platform files are generated.
2. Try using `after_prepare` hook type instead of `before_build`

## Testing

### Visual Test

1. Build and install the app
2. Force close the app completely
3. Launch the app from the home screen
4. Watch the transition from splash screen to main content
5. **Expected**: Smooth transition with consistent dark background
6. **Not expected**: Any flash of red, purple, or white color

### Log Verification

Check the build logs for hook execution:

```bash
cordova build android --verbose
```

Look for these lines:
```
🔧 FIX RED FLASH AFTER SPLASH SCREEN (Enhanced)
🎨 Background color: #001833
✅ MainActivity patched successfully!
✅ styles.xml updated
✅ Enhanced red flash fix completed!
```

### Runtime Verification

Use `adb logcat` to check for the fix at runtime:

```bash
adb logcat | grep -i "FixRedFlash\|MainActivity"
```

You should NOT see any error messages from the FixRedFlash tag.

## Example config.xml

```xml
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.example.app" version="1.0.0">
    <name>MyApp</name>
    
    <platform name="android">
        <!-- Add this hook -->
        <hook type="after_prepare" src="hooks/fix-red-flash-enhanced.js" />
        
        <!-- Splash screen configuration -->
        <preference name="SplashScreenDelay" value="3000" />
        <preference name="FadeSplashScreen" value="true" />
        <preference name="FadeSplashScreenDuration" value="300" />
        <preference name="SplashShowOnlyFirstTime" value="false" />
        <preference name="SplashScreen" value="screen" />
        <preference name="AutoHideSplashScreen" value="true" />
    </platform>
</widget>
```

## Why Two Solutions?

You might wonder why we need both solutions. Here's why:

1. **Defense in Depth**: If one solution fails (e.g., theme not applied correctly), the other still works
2. **Timing Coverage**: Theme applies earliest (OS level), code applies next (before onCreate), providing complete coverage
3. **Compatibility**: Different Android versions and device manufacturers might behave differently; having both ensures maximum compatibility
4. **Edge Cases**: Some Cordova plugins or custom code might override one solution but not the other

## Performance Impact

**Negligible**. The hook:
- Runs only during build time (not at runtime)
- Adds ~50 lines of Java code that executes once during activity creation
- Uses native Android APIs that are highly optimized
- Actually *improves* perceived performance by eliminating the flash

## Compatibility

### Tested With:
- Cordova Android 10.x, 11.x, 12.x
- Android 7.0 (API 24) through Android 14 (API 34)
- OutSystems mobile apps
- Various device manufacturers (Samsung, Google Pixel, Xiaomi, etc.)

### Known Issues:
- None reported

## Credits

Created for OutSystems mobile apps with dark theme requirements.

## Related Documentation

- [Android Activity Lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle)
- [Android Themes and Styles](https://developer.android.com/guide/topics/ui/look-and-feel/themes)
- [Cordova Hooks Guide](https://cordova.apache.org/docs/en/latest/guide/appdev/hooks/)

## License

MIT
