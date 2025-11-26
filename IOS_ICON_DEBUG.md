# iOS Icon Not Changing - Debug Guide

## 🔴 Nếu icon iOS vẫn không đổi sau khi build

### Bước 1: Kiểm tra Build Log

Trong build log OutSystems MABS, tìm section:

```
══════════════════════════════════
        GENERATE ICONS HOOK        
══════════════════════════════════
```

#### ✅ Log ĐÚNG sẽ như thế này:

```
══════════════════════════════════
        GENERATE ICONS HOOK        
══════════════════════════════════
Hook type: after_prepare
Platforms: ios
Project root: /path/to/project

🔍 Checking for CDN_ICON in: /path/to/config.xml
✅ Found CDN_ICON in config.xml: https://your-cdn.com/icon-1024.png
🔗 CDN URL: https://your-cdn.com/icon-1024.png
📥 Downloading icon from: https://your-cdn.com/icon-1024.png
✔ Icon downloaded successfully (456789 bytes)

📱 Processing platform: ios
✅ iOS app folder: YourAppName

🧹 Cleaning iOS build cache...
  ✔ Cleaned: build
  ✔ Cleaned: DerivedData
✅ Cleaned 2 cache folder(s)

📱 Generating iOS icons...
📂 iOS folder: /path/to/platforms/ios/YourAppName
📂 XCAssets folder: /path/to/platforms/ios/YourAppName/Images.xcassets
📂 AppIcon folder: /path/to/platforms/ios/YourAppName/Images.xcassets/AppIcon.appiconset
📁 AppIcon.appiconset folder exists
  ✔ icon-20@2x.png (40x40)
  ✔ icon-20@3x.png (60x60)
  ✔ icon-29@2x.png (58x58)
  ... (total 30 icons)
  ✔ icon-1024.png (1024x1024)
✅ Generated 30 iOS icon sizes
✅ Contents.json created at: /path/to/.../AppIcon.appiconset/Contents.json

🔍 Verifying iOS icons...
✅ All 30 iOS icons verified

🔍 Checking Xcode project: /path/to/platforms/ios/YourAppName.xcodeproj/project.pbxproj
✅ iOS target: YourAppName
🔍 Current AppIcon setting: AppIcon
✅ Updated project.pbxproj: Set ASSETCATALOG_COMPILER_APPICON_NAME = "AppIcon" (8 configurations)
🔄 Touched xcassets to force Xcode refresh

✅ iOS icon generation completed!
📌 IMPORTANT: To see new icon on device:
   1. DELETE app completely from device
   2. REBOOT device (turn off and on)
   3. Install app again

══════════════════════════════════
✅ Icons generation completed!
══════════════════════════════════
```

---

### Bước 2: Nếu thấy lỗi trong log

#### ❌ Lỗi: "CDN_ICON not found"

```
🔍 Checking for CDN_ICON in: /path/to/config.xml
⚠ CDN_ICON preference not found in config.xml
❌ CDN_ICON not found
```

**Nguyên nhân**: Chưa set preference `CDN_ICON`

**Giải pháp**: Thêm vào Extensibility Configurations:

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ICON",
                "value": "https://your-cdn.com/icon-1024.png"
            }
        ]
    }
}
```

---

#### ❌ Lỗi: "Failed to download icon"

```
📥 Downloading icon from: https://your-cdn.com/icon.png
❌ Failed to download icon: status 404
```

**Nguyên nhân**: URL không tồn tại hoặc không accessible

**Kiểm tra**:
```bash
curl -I https://your-cdn.com/icon-1024.png
```

**Kết quả ĐÚNG**:
```
HTTP/1.1 200 OK
Content-Type: image/png
Content-Length: 123456
```

**Kết quả SAI**:
```
HTTP/1.1 404 Not Found
# hoặc
HTTP/1.1 403 Forbidden
```

**Giải pháp**: 
- Upload icon lên CDN public
- Đảm bảo URL đúng
- Icon phải là PNG 1024x1024

---

#### ❌ Lỗi: "iOS platform folder not found"

```
📱 Processing platform: ios
⚠ iOS platform folder not found.
```

**Nguyên nhân**: iOS platform chưa được add trong build

**Giải pháp**: Không cần làm gì nếu build qua OutSystems MABS (tự động xử lý)

---

#### ❌ Lỗi: "No iOS app folder found"

```
⚠ No iOS app folder found.
```

**Nguyên nhân**: Cấu trúc project iOS bị lỗi

**Giải pháp**: 
- Clean build hoàn toàn
- Build lại từ đầu

---

### Bước 3: Nếu log ĐÚNG nhưng icon vẫn không đổi

Đây là do **iOS cache** - KHÔNG PHẢI lỗi plugin!

#### Checklist bắt buộc:

- [ ] **Xóa app hoàn toàn** khỏi thiết bị (không phải hide)
- [ ] **Reboot thiết bị** (tắt nguồn, đợi 10 giây, bật lại)
- [ ] **Cài app MỚI** (không install over cài cũ)

#### Cách kiểm tra đã xóa đúng:

1. Long press app icon
2. Chọn "**Remove App**"
3. **BẮT BUỘC** chọn "**Delete App**" (KHÔNG phải "Remove from Home Screen")
4. Xác nhận xóa
5. Vào Settings → General → iPhone Storage
6. Tìm app → nếu còn thấy thì chưa xóa hết

#### Force Restart thiết bị:

**iPhone 8 trở lên:**
1. Nhấn nhanh Volume Up
2. Nhấn nhanh Volume Down  
3. Giữ Power button cho đến khi thấy logo Apple

**iPhone 7/7+:**
1. Giữ Volume Down + Power
2. Đợi logo Apple xuất hiện

**iPhone 6s trở xuống:**
1. Giữ Home + Power
2. Đợi logo Apple xuất hiện

---

### Bước 4: Verify icon files trong build

Nếu có access vào máy build (hoặc build local):

```bash
# Check icon files tồn tại
ls -la platforms/ios/YourAppName/Images.xcassets/AppIcon.appiconset/

# Kết quả ĐÚNG:
# icon-20@2x.png
# icon-20@3x.png
# icon-29@2x.png
# ...
# icon-1024.png
# Contents.json

# Check Contents.json
cat platforms/ios/YourAppName/Images.xcassets/AppIcon.appiconset/Contents.json
```

**Contents.json ĐÚNG**:
```json
{
  "images": [
    {
      "idiom": "iphone",
      "size": "20x20",
      "scale": "2x",
      "filename": "icon-20@2x.png"
    },
    ...
    {
      "idiom": "ios-marketing",
      "size": "1024x1024",
      "scale": "1x",
      "filename": "icon-1024.png"
    }
  ],
  "info": {
    "version": 1,
    "author": "xcode"
  }
}
```

---

### Bước 5: Test với Simulator (nếu có Mac)

Simulator dễ test hơn thiết bị thật:

```bash
# Build
cordova build ios

# Xóa app khỏi simulator
xcrun simctl uninstall booted com.your.app.bundleid

# Reset simulator
xcrun simctl erase all

# Run lại
cordova run ios
```

Icon sẽ đổi ngay trên simulator (không cần reboot).

---

### Bước 6: Workaround nếu THỰC SỰ không thể reboot

#### Option 1: Reset Home Screen Layout

```
Settings → General → Reset → Reset Home Screen Layout
```

**Lưu ý**: Cách này sẽ sắp xếp lại TẤT CẢ icon.

#### Option 2: Thay đổi Bundle ID

Đổi `PACKAGE_NAME` thành tên khác:

```json
{
    "preferences": {
        "global": [
            {
                "name": "PACKAGE_NAME",
                "value": "com.yourcompany.app.v2"  // Thêm .v2
            }
        ]
    }
}
```

iOS sẽ coi đây là app hoàn toàn mới.

---

## 📊 Icon Requirements

### Icon source từ CDN PHẢI:

- ✅ **Format**: PNG (KHÔNG PHẢI JPG/JPEG)
- ✅ **Size**: 1024x1024 pixels (chính xác)
- ✅ **Ratio**: 1:1 (vuông hoàn hảo)
- ✅ **Background**: Solid color (KHÔNG trong suốt cho iOS)
- ✅ **URL**: HTTPS, public accessible
- ✅ **CORS**: Enabled (nếu cần)

### Test icon:

```bash
# Download icon
curl -o test-icon.png https://your-cdn.com/icon-1024.png

# Check size
file test-icon.png
# Output: PNG image data, 1024 x 1024, 8-bit/color RGBA

# Check dimensions
sips -g pixelWidth -g pixelHeight test-icon.png
# Output:
#   pixelWidth: 1024
#   pixelHeight: 1024
```

---

## ⚠️ Nguyên nhân chính iOS icon không đổi

### 1. iOS Springboard Cache (95% trường hợp)

iOS cache icon trong database của Springboard. Cache này:
- **KHÔNG tự động xóa** khi reinstall app
- **KHÔNG tự động refresh** khi update app
- **CHỈ xóa** khi reboot hoặc reset Home Screen

Đây là **BUG CỦA iOS**, không phải lỗi code!

### 2. Hook không chạy (4% trường hợp)

Kiểm tra build log xem có section `GENERATE ICONS HOOK` không.

Nếu không có → Plugin không được load đúng.

### 3. Icon source sai (1% trường hợp)

- URL không đúng
- File không phải PNG
- Size không phải 1024x1024
- File bị corrupt

---

## ✅ Checklist đầy đủ

### Config:
- [ ] CDN_ICON preference được set trong config
- [ ] URL trả về HTTP 200
- [ ] File là PNG 1024x1024
- [ ] URL accessible từ build server

### Build Log:
- [ ] Thấy section "GENERATE ICONS HOOK"
- [ ] Thấy "Found CDN_ICON in config.xml"
- [ ] Thấy "Icon downloaded successfully"
- [ ] Thấy "Generated 30 iOS icon sizes"
- [ ] Thấy "All 30 iOS icons verified"
- [ ] Thấy "Updated project.pbxproj"

### Thiết bị:
- [ ] XÓA app hoàn toàn (Delete App, không phải Remove)
- [ ] REBOOT thiết bị (tắt nguồn 10 giây)
- [ ] CÀI app MỚI (không install over)
- [ ] Kiểm tra Settings → Storage để chắc app đã xóa hết

### Nếu vẫn không được:
- [ ] Build lại với plugin mới nhất
- [ ] Kiểm tra toàn bộ build log
- [ ] Test trên simulator (nếu có Mac)
- [ ] Thử workaround: Reset Home Screen hoặc đổi Bundle ID

---

## 📞 Nếu vẫn còn vấn đề

1. **Copy TOÀN BỘ build log** từ OutSystems MABS
2. **Chụp ảnh thiết bị** hiển thị icon cũ
3. **Gửi CDN icon URL** để test
4. **Mở issue**: https://github.com/vnkhoado/cordova-plugin-change-app-info/issues

### Thông tin cần cung cấp:

```
- iOS version: (e.g., iOS 17.1)
- Device: (e.g., iPhone 14 Pro)
- OutSystems version: (e.g., MABS 8.0)
- Plugin version: (latest commit hash)
- CDN icon URL: https://...
- Build log: (attach full log)
- Đã reboot thiết bị: Yes/No
- Đã xóa app hoàn toàn: Yes/No
```

---

## 🎯 Tóm tắt

**99% trường hợp icon không đổi là do iOS cache.**

**Giải pháp duy nhất 100%:**
1. Xóa app
2. **REBOOT** thiết bị
3. Cài lại

**KHÔNG CÓ cách nào khác** ngoài reboot để xóa cache iOS Springboard.

Nếu sau khi reboot vẫn không được → Kiểm tra build log theo hướng dẫn trên.