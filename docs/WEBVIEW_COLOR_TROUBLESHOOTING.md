# Troubleshooting - Webview Background Color

## Quick Checklist

- [ ] Config correct? (`WEBVIEW_BACKGROUND_COLOR`)
- [ ] Color format? (`#RRGGBB` hex format)
- [ ] Module published?
- [ ] NEW native build generated? (Not browser preview)
- [ ] Old app uninstalled?
- [ ] Fresh build installed?

---

## Common Issues

### Issue 1: Setting not applied

**Cause**: One of:
1. Browser preview (settings only work in native build)
2. Module not published
3. New build not generated
4. Config syntax error

**Fix**:
1. Generate native build (MABS), not preview
2. Publish module in Service Studio
3. Uninstall old app completely
4. Validate JSON: https://jsonlint.com/

---

### Issue 2: Still white after setting

**Cause**: CSS override or app caching

**Fix**:
```bash
# 1. Uninstall app completely
# Android: adb uninstall com.app.name

# 2. Clean install
cordova clean
cordova build

# 3. Remove !important from CSS
# Check app CSS for:
# body { background: white !important; } ❌ Remove !
```

---

### Issue 3: Works on Android, not iOS (or vice versa)

**Cause**: Platform-specific code path not updated

**Fix**: Both platforms should work with same config. If not:
1. Check MABS build logs for errors
2. Rebuild both platforms fresh
3. Verify hook is running

---

## Configuration

### Basic Setup

```json
{
  "preferences": {
    "global": [
      {
        "name": "WEBVIEW_BACKGROUND_COLOR",
        "value": "#FFFFFF"
      }
    ]
  }
}
```

### With Splash Color

```json
{
  "preferences": {
    "global": [
      {
        "name": "SplashScreenBackgroundColor",
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

---

## Test Cases

### Test 1: Bright Red (Easy to verify)

```json
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#FF0000"
}
```

**Expected**: Bright red background

**Result**:
- ✅ Red → Setting works, now use your color
- ❌ White → Config not applying

---

### Test 2: Black

```json
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#000000"
}
```

---

### Test 3: Your Brand Color

```json
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#001833"
}
```

---

## Complete Working Config

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
      },
      {
        "name": "SplashScreenDelay",
        "value": "3000"
      }
    ]
  }
}
```

---

## For Gradient Splash Screens

Use `SPLASH_GRADIENT` instead of solid color:

```json
{
  "name": "SPLASH_GRADIENT",
  "value": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
}
```

See: [GRADIENT_IMPLEMENTATION.md](GRADIENT_IMPLEMENTATION.md)

---

## For Splash Color Issues

See: [SPLASH_SCREEN_TROUBLESHOOTING.md](SPLASH_SCREEN_TROUBLESHOOTING.md)

---

## For Complete Documentation

See: [README.md](../README.md)

---

## Debug Checklist

```
☐ Config syntax correct?
  ☐ WEBVIEW_BACKGROUND_COLOR (exact name)
  ☐ #RRGGBB format (6 hex characters)
  ☐ Has # prefix

☐ Published?
  ☐ Service Studio → Publish
  ☐ No errors

☐ Native build?
  ☐ NOT browser preview
  ☐ Service Center → Generate
  ☐ Downloaded APK/IPA

☐ Clean install?
  ☐ Uninstalled old app
  ☐ Installed fresh build

☐ Test color?
  ☐ Tried #FF0000 (red)
  ☐ Verified it works

☐ No CSS override?
  ☐ No !important in CSS
  ☐ No conflicting body styles
```

---

**Still having issues?**

Provide:
1. Your config JSON
2. MABS build logs
3. Platform (Android/iOS)
4. Current background color
5. Expected background color
