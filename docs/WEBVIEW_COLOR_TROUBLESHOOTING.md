# Troubleshooting - Webview Background Color không hoạt động

Hướng dẫn debug khi màu background không thay đổi.

---

## ✅ Checklist kiểm tra

### 1. **Kiểm tra config có đúng không?**

**OutSystems Extensibility Configurations**:
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

**Lỗi thường gặp**:
- ❌ `"WEBVIEW_BACKGROUND_COLOR"` (sai tên parameter)
- ❌ `"#FFFFF"` (thiếu 1 ký tự)
- ❌ `"FFFFFF"` (thiếu dấu #)
- ❌ `"white"` (phải dùng hex)

**Đúng**:
- ✅ `"WEBVIEW_BACKGROUND_COLOR"` (đúng tên)
- ✅ `"#FFFFFF"` (6 ký tự hex)
- ✅ `"#000000"` (cho màu đen)

---

### 2. **Đã publish module chưa?**

```
Service Studio
  ├─ Properties (F4)
  ├─ Extensibility Configurations
  ├─ Paste JSON
  ├─ Apply
  └─ 🔴 PUBLISH MODULE ← Quan trọng!
```

**Nếu chưa publish** → Config không apply!

---

### 3. **Đã generate NATIVE BUILD chưa?**

⚠️ **Plugin CHỈ hoạt động với native build, KHÔNG hoạt động trong browser!**

**Cần làm**:
```
Service Center
  └─ Generate Android/iOS build
      ├─ Wait for build complete
      ├─ Download APK/IPA
      └─ Install on device
```

**Không hoạt động**:
- ❌ Browser preview
- ❌ Service Studio preview
- ❌ PWA

**Hoạt động**:
- ✅ Native build (APK/IPA)
- ✅ Installed on device/emulator

---

### 4. **Kiểm tra build logs**

**Tìm trong MABS build logs**:

```bash
# Tìm dòng này:
══════════════════════════════════════════════
  CUSTOMIZE WEBVIEW BACKGROUND COLOR
══════════════════════════════════════════════
Color: #FFFFFF

📱 Processing android...
   ✓ Android webview background set to #FFFFFF

📱 Processing ios...
   ✓ iOS webview background set to #FFFFFF

══════════════════════════════════════════════
✅ Webview customization completed!
══════════════════════════════════════════════
```

**Nếu KHÔNG thấy** → Hook không chạy!

---

### 5. **Kiểm tra plugin version**

**Config**:
```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#master"
  }
}
```

**Hoặc dùng tag cụ thể**:
```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#v2.7.1"
  }
}
```

⚠️ Version `v2.7.0` chưa có tính năng này, phải dùng `v2.7.1` trở lên!

---

## 🔍 Debug chi tiết

### Debug bước 1: Kiểm tra hook có chạy không?

**Tìm trong build logs**:
```bash
# Search cho:
CUSTOMIZE WEBVIEW BACKGROUND COLOR

# Nếu tìm thấy:
✅ Hook đã chạy

# Nếu KHÔNG tìm thấy:
❌ Hook không chạy → Check config
```

---

### Debug bước 2: Kiểm tra code đã inject chưa?

**Android**:
```bash
# Sau khi build, check file:
cd platforms/android/app/src/main/java

# Tìm MainActivity.java
find . -name "MainActivity.java"

# Check nội dung:
grep -A 5 "CUSTOM_WEBVIEW_BACKGROUND" [path-to-MainActivity.java]

# Expected output:
// CUSTOM_WEBVIEW_BACKGROUND
// Set webview background color
getWindow().getDecorView().setBackgroundColor(Color.parseColor("#FFFFFF"));
```

**Nếu thấy code** → ✅ Inject thành công  
**Nếu KHÔNG thấy** → ❌ Inject thất bại

---

**iOS**:
```bash
# Check AppDelegate.m
cd platforms/ios/[YourAppName]/Classes

grep -A 3 "CUSTOM_WEBVIEW_BACKGROUND" AppDelegate.m

# Expected output:
// CUSTOM_WEBVIEW_BACKGROUND
// Set webview background color
self.window.backgroundColor = [UIColor colorWithRed:1.000f green:1.000f blue:1.000f alpha:1.0f];
```

---

### Debug bước 3: Kiểm tra file path

**Vấn đề**: Hook không tìm thấy MainActivity.java hoặc AppDelegate.m

**Kiểm tra**:
```javascript
// Hook tìm ở:

// Android (OutSystems):
platforms/android/app/src/main/java/io/outsystems/android/MainActivity.java

// Android (Standard Cordova):
platforms/android/app/src/main/java/[package]/MainActivity.java

// iOS:
platforms/ios/[AppName]/Classes/AppDelegate.m
```

**Nếu file không ở đúng vị trí** → Hook skip injection

---

## 🔧 Các vấn đề thường gặp

### Issue 1: "⚠️ MainActivity.java not found"

**Nguyên nhân**: 
- OutSystems dùng custom package structure
- File không ở đường dẫn mặc định

**Giải pháp**: Plugin có fallback search
```javascript
// Hook tự động tìm trong toàn bộ project
findMainActivity(appPath);
```

**Nếu vẫn lỗi**:
1. Check build logs xem file ở đâu
2. Báo lại path để tôi update hook

---

### Issue 2: "⚠️ onCreate method not found"

**Nguyên nhân**: 
- MainActivity có cấu trúc khác
- Không có `onCreate()` hoặc `super.onCreate()`

**Giải pháp**:
1. Check MainActivity.java structure
2. Có thể cần custom regex pattern

**Debug**:
```bash
# Open MainActivity.java
# Look for:
@Override
public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // ...
}
```

---

### Issue 3: Màu vẫn trắng sau khi inject

**Nguyên nhân**:
1. App cache chưa clear
2. Old build vẫn installed
3. CSS override lại màu

**Giải pháp**:

**1. Uninstall app hoàn toàn**:
```bash
# Android
adb uninstall [package.name]

# Or manually:
Settings → Apps → [Your App] → Uninstall
```

**2. Clean build**:
```bash
# OutSystems: Generate new build
# Cordova CLI:
cordova clean
cordova build android
```

**3. Install fresh build**:
```bash
adb install -r app-debug.apk
```

**4. Check CSS không override**:
```css
/* Nếu CSS có: */
body {
  background: white !important; /* ← Có thể override native color */
}

/* Remove !important hoặc dùng màu khớp với native */
```

---

### Issue 4: Android OK, iOS vẫn trắng (hoặc ngược lại)

**Nguyên nhân**: Platform-specific issue

**Debug**:

**Android**:
```bash
# Check logcat
adb logcat | grep -i "background\|color"

# Look for errors
```

**iOS**:
```bash
# Check Xcode console
# Look for:
# - AppDelegate errors
# - Color parsing errors
```

**Kiểm tra code inject**:
```bash
# Android:
grep "CUSTOM_WEBVIEW_BACKGROUND" platforms/android/.../MainActivity.java

# iOS:
grep "CUSTOM_WEBVIEW_BACKGROUND" platforms/ios/.../AppDelegate.m
```

---

## 🧪 Test Cases

### Test 1: Basic Color

**Config**:
```json
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#FF0000"
}
```

**Expected**: Màu đỏ chói (dễ nhận biết)

**Result**:
- ✅ Thấy màu đỏ → Plugin hoạt động!
- ❌ Vẫn trắng → Debug tiếp

---

### Test 2: Black Color

**Config**:
```json
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#000000"
}
```

**Expected**: Màu đen

---

### Test 3: Custom Brand Color

**Config**:
```json
{
  "name": "WEBVIEW_BACKGROUND_COLOR",
  "value": "#001833"
}
```

**Expected**: Màu xanh đậm (như gradient của bạn)

---

## 📝 Complete Debug Checklist

```
☐ 1. Config có đúng format?
    ☐ WEBVIEW_BACKGROUND_COLOR (đúng tên)
    ☐ #RRGGBB format (6 ký tự hex)
    ☐ Có dấu # ở đầu

☐ 2. Đã publish module?
    ☐ Service Studio → Publish
    ☐ No errors

☐ 3. Đã generate native build?
    ☐ Service Center → Generate
    ☐ Build thành công
    ☐ Downloaded APK/IPA

☐ 4. Hook có chạy trong build logs?
    ☐ Thấy "CUSTOMIZE WEBVIEW BACKGROUND COLOR"
    ☐ Thấy "✓ Android/iOS webview background set"

☐ 5. Code đã inject?
    ☐ Check MainActivity.java (Android)
    ☐ Check AppDelegate.m (iOS)
    ☐ Thấy marker "CUSTOM_WEBVIEW_BACKGROUND"

☐ 6. Đã uninstall app cũ?
    ☐ Uninstall hoàn toàn
    ☐ Install fresh build

☐ 7. Test với màu rõ ràng?
    ☐ Test #FF0000 (đỏ)
    ☐ Test #000000 (đen)
    ☐ Dễ nhận biết

☐ 8. CSS không override?
    ☐ Check body background
    ☐ Remove !important
```

---

## 💬 Report Issue

Nếu đã thử tất cả vẫn không được, hãy cung cấp:

**1. Build Logs**:
```
[Paste build logs here]
Tìm phần:
- CUSTOMIZE WEBVIEW BACKGROUND COLOR
- Hook execution
```

**2. Config**:
```json
{
  // Paste your config here
}
```

**3. Platform**:
- [ ] Android
- [ ] iOS
- [ ] Both

**4. OutSystems Version**:
- MABS version: ?
- Plugin version: ?

**5. Screenshots**:
- App hiện màu gì?
- Expected màu gì?

---

## 🚀 Quick Fix

Nếu vội, dùng workaround:

**CSS fallback**:
```css
/* Add to your app CSS */
html, body {
  background-color: #001833;
  margin: 0;
  padding: 0;
}

/* Load CSS inline in index.html */
<style>
  html, body { background: #001833; }
</style>
```

⚠️ Vẫn có flash nhỏ, nhưng ít hơn trắng hoàn toàn.

---

**Hãy cho tôi biết kết quả của checklist để debug tiếp! 🔍**