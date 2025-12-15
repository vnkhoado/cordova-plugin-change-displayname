# Troubleshooting - Splash Screen Background Color

Hướng dẫn debug khi màu splash screen không thay đổi trong OutSystems.

---

## ❓ Câu hỏi debug

### 1. Config hiện tại của bạn?

**Hãy cho tôi xem config JSON**:
```json
{
  "preferences": {
    "global": [
      {
        "name": "SplashScreenBackgroundColor",
        "value": "???"
      }
    ]
  }
}
```

### 2. Màu splash hiện tại?

- ⬜ Trắng (#FFFFFF)
- 🟦 Xanh primary của OutSystems theme
- ⬛ Đen (#000000)
- 🎨 Màu khác: _____

### 3. Đã rebuild chưa?

- ☐ Đã publish module
- ☐ Đã generate new native build
- ☐ Đã install fresh APK
- ☐ Đã uninstall app cũ trước khi install

### 4. Platform nào?

- ☐ Android
- ☐ iOS
- ☐ Cả hai

---

## 🔍 Kiểm tra từng bước

### Bước 1: Verify Config Syntax

**✅ ĐÚNG**:
```json
{
  "preferences": {
    "global": [
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      }
    ]
  }
}
```

**❌ SAI** (các lỗi thường gặp):
```json
// Sai tên parameter
{
  "name": "SPLASH_BACKGROUND_COLOR",  // ❌ Wrong name
  "value": "#001833"
}

// Thiếu dấu #
{
  "name": "SplashScreenBackgroundColor",
  "value": "001833"  // ❌ Missing #
}

// Format sai
{
  "name": "SplashScreenBackgroundColor",
  "value": "rgb(0, 24, 51)"  // ❌ Must be hex
}
```

---

### Bước 2: Check Build Logs

**Tìm trong MABS logs**:

```
[Config] SplashScreenBackgroundColor: #001833
```

**Nếu KHÔNG thấy** → Config chưa apply!

**Solutions**:
1. Check JSON syntax
2. Republish module
3. Clear browser cache
4. Rebuild

---

### Bước 3: Test với màu rõ ràng

**Thử với màu đỏ chói**:
```json
{
  "name": "SplashScreenBackgroundColor",
  "value": "#FF0000"
}
```

**Rebuild → Test**:
- ✅ Thấy đỏ → Config đang work, chỉ cần đổi lại màu đúng
- ❌ Vẫn không đổi → Có vấn đề khác

---

### Bước 4: Check OutSystems Theme Override

**OutSystems có thể override splash color trong**:

#### **4.1. Module Theme**

```
Service Studio → Module → Themes → [Your Theme]
```

Check có CSS splash screen không:
```css
.splash-screen,
#splash {
  background-color: ??? /* Check màu này */
}
```

#### **4.2. Extensibility Configurations (Resources)**

```json
{
  "resources": {
    "android": {
      "values": {
        "colors.xml": {
          "colorPrimary": "#SomeColor"  // ← Có thể override splash
        }
      }
    }
  }
}
```

---

## 🛠️ Solutions

### Solution 1: Force Override với Multiple Preferences

**Config đầy đủ**:
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
        "name": "SplashMaintainAspectRatio",
        "value": "true"
      },
      {
        "name": "SplashShowOnlyFirstTime",
        "value": "false"
      }
    ]
  }
}
```

---

### Solution 2: Override OutSystems Theme Colors

**Trong Extensibility Configurations**:
```json
{
  "preferences": {
    "global": [
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      }
    ]
  },
  "resources": {
    "android": {
      "values": {
        "colors.xml": {
          "colorPrimary": "#001833",
          "colorPrimaryDark": "#001833"
        }
      }
    }
  }
}
```

---

### Solution 3: Custom Splash Screen Plugin

**Thêm cordova-plugin-splashscreen**:

```json
{
  "dependencies": [
    {
      "plugin": {
        "url": "cordova-plugin-splashscreen@6.0.0"
      }
    }
  ],
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
        "name": "FadeSplashScreen",
        "value": "true"
      },
      {
        "name": "AutoHideSplashScreen",
        "value": "true"
      }
    ]
  }
}
```

---

### Solution 4: Manual Theme Override

**Nếu OutSystems theme đang override**:

**Service Studio → Module → Theme CSS**:

```css
/* Force splash background */
body.splash-active,
.splash-screen,
#splash {
  background-color: #001833 !important;
}

/* For older OutSystems */
.view-transition {
  background-color: #001833 !important;
}
```

---

## 📊 Debug Checklist

```
☐ 1. Config syntax đúng?
    ☐ "SplashScreenBackgroundColor" (đúng tên)
    ☐ "#RRGGBB" format (6 ký tự hex)
    ☐ Có dấu # ở đầu

☐ 2. Đã publish module?
    ☐ Service Studio → Publish
    ☐ No errors

☐ 3. Đã generate new build?
    ☐ Service Center → Generate
    ☐ Build completed
    ☐ Downloaded new APK/IPA

☐ 4. Clean install?
    ☐ Uninstall old app completely
    ☐ Install fresh build
    ☐ Clear app data/cache

☐ 5. Test với màu rõ ràng?
    ☐ Test #FF0000 (đỏ)
    ☐ Dễ nhận biết

☐ 6. Check build logs?
    ☐ Thấy SplashScreenBackgroundColor
    ☐ Correct value

☐ 7. Check theme override?
    ☐ Module theme CSS
    ☐ Extensibility configurations
    ☐ No conflicts
```

---

## 🎯 Common Issues & Fixes

### Issue 1: "Vẫn là màu primary của OutSystems"

**Nguyên nhân**: OutSystems theme override

**Fix**:
```json
{
  "resources": {
    "android": {
      "values": {
        "colors.xml": {
          "colorPrimary": "#001833",
          "colorPrimaryDark": "#001833",
          "colorAccent": "#001833"
        }
      }
    }
  }
}
```

---

### Issue 2: "Màu khác nhau giữa Android và iOS"

**Nguyên nhân**: Platform-specific config

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
    ],
    "ios": [
      {
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      }
    ]
  }
}
```

---

### Issue 3: "Config không apply"

**Nguyên nhân**: JSON syntax error

**Fix**:
1. Validate JSON: https://jsonlint.com/
2. Check comma placement
3. Check quotes (must be double ")
4. Check brackets matching

---

### Issue 4: "Splash bị white flash"

**Nguyên nhân**: Timing issue

**Fix - Add delays**:
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
        "name": "FadeSplashScreenDuration",
        "value": "500"
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

## 🧪 Test Cases

### Test 1: Red Splash (để verify)

```json
{
  "name": "SplashScreenBackgroundColor",
  "value": "#FF0000"
}
```

**Expected**: Màu đỏ chói  
**If fail**: Config không work, check syntax

### Test 2: Black Splash

```json
{
  "name": "SplashScreenBackgroundColor",
  "value": "#000000"
}
```

**Expected**: Màu đen  
**If fail**: Theme override issue

### Test 3: Your Color

```json
{
  "name": "SplashScreenBackgroundColor",
  "value": "#001833"
}
```

**Expected**: Dark blue  
**If fail**: Specific color issue

---

## 💡 Alternative Approach

### Workaround: CSS-only (Temporary)

**Trong Module Theme CSS**:

```css
/* Fallback splash color */
html,
body {
  background-color: #001833;
}

/* Loading screen */
.view-loading,
.splash-screen {
  background-color: #001833 !important;
}

/* OutSystems specific */
.screen-container {
  background-color: #001833;
}
```

⚠️ **Note**: Vẫn có flash nhỏ, nhưng tốt hơn trắng hoàn toàn.

---

## 📝 Report Template

**Nếu vẫn không work, gửi cho tôi**:

```
1. Config JSON (full):
[Paste your config]

2. Build logs (search "Splash"):
[Paste logs]

3. Current splash color:
[Describe color]

4. Platform:
☐ Android
☐ iOS

5. OutSystems version:
MABS: ???
Plugin: ???

6. Tested with #FF0000?
☐ Yes - worked
☐ Yes - didn't work
☐ No

7. Screenshots:
[Attach if possible]
```

---

## 🚀 Recommended Final Config

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
        "name": "SplashScreenBackgroundColor",
        "value": "#001833"
      },
      {
        "name": "AndroidWindowSplashScreenBackground",
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
        "name": "FadeSplashScreenDuration",
        "value": "500"
      },
      {
        "name": "AutoHideSplashScreen",
        "value": "true"
      },
      {
        "name": "WEBVIEW_BACKGROUND_COLOR",
        "value": "#001833"
      }
    ]
  },
  "resources": {
    "android": {
      "values": {
        "colors.xml": {
          "colorPrimary": "#001833",
          "colorPrimaryDark": "#001833"
        }
      }
    }
  },
  "dependencies": [
    {
      "plugin": {
        "url": "cordova-sqlite-storage@6.1.0"
      }
    },
    {
      "plugin": {
        "url": "cordova-plugin-splashscreen@6.0.0"
      }
    }
  ]
}
```

---

**Hãy thử từng solution và cho tôi biết kết quả! 🔍**