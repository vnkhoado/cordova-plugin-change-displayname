# Troubleshooting - Splash Screen Background Color

## Quick Checklist

- [ ] Config syntax correct? (`SplashScreenBackgroundColor`)
- [ ] Color format correct? (`#RRGGBB`, 6 hex characters)
- [ ] Module published?
- [ ] New native build generated? (Not browser preview)
- [ ] Old app uninstalled and fresh build installed?
- [ ] Set ALL THREE preferences? (global, Android, iOS)

---

## Common Issues

### Issue 1: Splash still OutSystems theme color

**Cause**: OutSystems theme override

**Fix**: Set all three preferences
```json
{
  "preferences": {
    "global": [
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      },
      {
        "name": "AndroidWindowSplashScreenBackground",
        "value": "#001833"
      },
      {
        "name": "BackgroundColor",
        "value": "#001833"
      }
    ]
  }
}
```

---

### Issue 2: Config not applying

**Causes**:
1. JSON syntax error
2. Module not published
3. Build not regenerated
4. Wrong preference name

**Debug**:
```bash
# 1. Validate JSON
# Use: https://jsonlint.com/

# 2. Check MABS logs for:
# "SplashScreenBackgroundColor"

# 3. Verify preference name
# Correct: SplashScreenBackgroundColor
# Wrong: SPLASH_BACKGROUND_COLOR (❌)
#        SplashColor (❌)
```

---

### Issue 3: Different colors Android vs iOS

**Cause**: Platform-specific override

**Fix**:
```json
{
  "preferences": {
    "global": [
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      }
    ],
    "android": [
      {
        "name": "AndroidWindowSplashScreenBackground",
        "value": "#001833"
      }
    ]
  }
}
```

---

### Issue 4: White flash on startup

**Cause**: Timing issue between splash and webview

**Fix**:
```json
{
  "preferences": {
    "global": [
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      },
      {
        "name": "SplashScreenDelay",
        "value": "3000"
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

## Test with Obvious Color

**Use bright red to verify**:
```json
{
  "name": "SplashScreenBackgroundColor",
  "value": "#FF0000"
}
```

**Expected**: Bright red splash screen

**If no change**: Config not applying

**If works**: Now set to your color

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
        "name": "SplashScreenDelay",
        "value": "3000"
      },
      {
        "name": "FadeSplashScreen",
        "value": "true"
      },
      {
        "name": "AutoHideSplashScreen",
        "value": "true"
      },
      {
        "name": "WEBVIEW_BACKGROUND_COLOR",
        "value": "#001833"
      }
    ],
    "android": [
      {
        "name": "AndroidWindowSplashScreenBackground",
        "value": "#001833"
      }
    ]
  }
}
```

---

## For Gradient Splash Screens

**Use SPLASH_GRADIENT preference instead**:

```json
{
  "name": "SPLASH_GRADIENT",
  "value": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
}
```

See: [GRADIENT_IMPLEMENTATION.md](GRADIENT_IMPLEMENTATION.md)

---

## For Webview Color Issues

See: [WEBVIEW_COLOR_TROUBLESHOOTING.md](WEBVIEW_COLOR_TROUBLESHOOTING.md)

---

## For Complete Documentation

See: [README.md](../README.md#splash-screen-color-override-outsystems)

---

## Still Not Working?

Provide:
1. Your config JSON
2. Build logs (search for "SplashScreen")
3. Platform (Android/iOS)
4. Current splash color
5. Expected splash color
