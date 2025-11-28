# Cordova Plugin Change App Info

Cordova plugin để thay đổi app display name, package name, version và icon từ CDN lúc build time. Tối ưu cho **OutSystems MABS**.

---

## ✨ Tính năng

- ✅ Thay đổi package name / bundle ID  
- ✅ Thay đổi display name của app  
- ✅ Thay đổi version number và version code  
- ✅ Download và generate icon từ CDN URL  
- ✅ Tự động tạo tất cả kích thước icon cần thiết (iOS & Android)  
- ✅ Clean build cache để đảm bảo thay đổi được áp dụng  
- ✅ Multiple hooks để tránh bị overwrite  
- ✅ Support iOS (xcassets) và Android (mipmap)  
- ✅ Compatible với OutSystems MABS  

---

## 📦 Cài đặt

### From Git
```bash
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git
```

### Local
```bash
cordova plugin add /path/to/cordova-plugin-change-app-info
```

### OutSystems MABS
See `QUICK_START.md` for detailed instructions.

---

## ⚙️ Cấu hình

### Với OutSystems - Extensibility Configurations (Recommended)

Thêm vào **Extensibility Configurations** trong OutSystems:

```json
{
    "preferences": {
        "global": [
            {
                "name": "PACKAGE_NAME",
                "value": "com.yourcompany.app"
            },
            {
                "name": "APP_NAME",
                "value": "Your App Name"
            },
            {
                "name": "VERSION_NUMBER",
                "value": "1.0.0"
            },
            {
                "name": "VERSION_CODE",
                "value": "1"
            },
            {
                "name": "CDN_ICON",
                "value": "https://your-cdn.com/icon-1024.png"
            }
        ]
    }
}
```

**Lưu ý quan trọng:**
- Tất cả preferences phải nằm trong `preferences.global` array
- `VERSION_NUMBER` và `VERSION_CODE` **phải tồn tại cùng nhau** hoặc đều không có
- Nếu không cần thay đổi preference nào, có thể bỏ qua (ngoại trừ VERSION)

**Variables:**
- `PACKAGE_NAME`: Bundle ID (iOS) / Package Name (Android)
- `APP_NAME`: Tên hiển thị của app
- `VERSION_NUMBER`: Version string (e.g., "1.0.0") - **Bắt buộc cùng VERSION_CODE**
- `VERSION_CODE`: Build number (integer) - **Bắt buộc cùng VERSION_NUMBER**
- `CDN_ICON`: URL của app icon (1024x1024px PNG)

### Config.xml (Alternative)
```xml
<widget>
    <preference name="PACKAGE_NAME" value="com.yourcompany.app" />
    <preference name="APP_NAME" value="Your App Name" />
    <preference name="VERSION_NUMBER" value="1.0.0" />
    <preference name="VERSION_CODE" value="1" />
    <preference name="CDN_ICON" value="https://cdn.example.com/icon.png" />
</widget>
```

---

## 📐 Yêu cầu Icon

### Icon Source
- **Format**: PNG
- **Size**: 1024x1024px minimum
- **Ratio**: 1:1 (square)
- **Background**: Solid color (iOS không nên trong suốt)
- **CDN**: Public URL với CORS headers

### Kích thước generated

#### iOS
- 20x20 (@1x, @2x, @3x)
- 29x29 (@1x, @2x, @3x)
- 40x40 (@1x, @2x, @3x)
- 60x60 (@2x, @3x)
- 76x76 (@1x, @2x)
- 83.5x83.5 (@2x)
- 1024x1024 (App Store)

#### Android
- **mdpi**: 48x48
- **hdpi**: 72x72
- **xhdpi**: 96x96
- **xxhdpi**: 144x144
- **xxxhdpi**: 192x192

---

## 🔧 Cách hoạt động

### Hooks
- `after_prepare`: Update app info và generate icons
- `before_compile` (iOS): Verify icons không bị overwrite
- `before_build` (iOS): Clean build cache

### Config Files
- **iOS**: Update `Info.plist` và `project.pbxproj`
- **Android**: Update `AndroidManifest.xml`, `strings.xml`, `build.gradle`

### Validation Logic
- Nếu preference không có hoặc rỗng (`""`), plugin sẽ bỏ qua không xử lý
- `VERSION_NUMBER` và `VERSION_CODE` phải có cùng nhau, nếu thiếu 1 trong 2 sẽ bỏ qua cả 2

---

## 🐛 Troubleshooting

### ❌ Icons không thay đổi trên iOS

**Giải pháp:**
1. ⭐ Xóa app hoàn toàn khỏi device
2. Clean build: `cordova clean ios`
3. Build lại: `cordova build ios`
4. Install clean

### ❌ Build failed: "sharp not found"

**Giải pháp:**
```bash
cd plugins/cordova-plugin-change-app-info
npm install
```

### ❌ CDN icon không download được

**Check:**
```bash
curl -I https://your-cdn.com/icon.png
```

Phải trả về:
```
HTTP/1.1 200 OK
Content-Type: image/png
Access-Control-Allow-Origin: *
```

### ❌ Icons bị mờ

**Giải pháp:**
- Đảm bảo icon source ≥ 1024x1024px
- Format PNG không nén
- Tránh JPG

### ❌ VERSION_NUMBER và VERSION_CODE không được áp dụng

**Nguyên nhân:** Cả 2 phải được set cùng nhau.

**Giải pháp:**
- Kiểm tra trong Extensibility Configurations có cả 2 values
- Không được để trống (`""`) một trong hai

---

## 📚 Documentation

- `QUICK_START.md` - Quick start cho OutSystems MABS
- `CHANGELOG.md` - Version history
- `example-outsystems-config.json` - Example config

---

## 🎯 Example Configs

### Development
```json
{
    "preferences": {
        "global": [
            {
                "name": "PACKAGE_NAME",
                "value": "com.company.app.dev"
            },
            {
                "name": "APP_NAME",
                "value": "MyApp DEV"
            },
            {
                "name": "VERSION_NUMBER",
                "value": "1.0.0"
            },
            {
                "name": "VERSION_CODE",
                "value": "100"
            },
            {
                "name": "CDN_ICON",
                "value": "https://cdn.com/icon-red.png"
            }
        ]
    }
}
```

### Production
```json
{
    "preferences": {
        "global": [
            {
                "name": "PACKAGE_NAME",
                "value": "com.company.app"
            },
            {
                "name": "APP_NAME",
                "value": "MyApp"
            },
            {
                "name": "VERSION_NUMBER",
                "value": "1.0.0"
            },
            {
                "name": "VERSION_CODE",
                "value": "1"
            },
            {
                "name": "CDN_ICON",
                "value": "https://cdn.com/icon.png"
            }
        ]
    }
}
```

### Minimal (Chỉ thay đổi icon)
```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ICON",
                "value": "https://cdn.com/icon.png"
            }
        ]
    }
}
```

---

## 📁 Structure

```
cordova-plugin-change-app-info/
├── plugin.xml
├── package.json
├── hooks/
│   ├── changeAppInfo.js      # Update app info
│   ├── generateIcons.js      # Generate icons from CDN
│   ├── cleanBuild.js         # Clean build cache
│   └── utils.js              # Helper functions
└── scripts/
    └── postinstall.js        # Auto-install dependencies
```

---

## 🔗 Dependencies

- `sharp@^0.33.0` - Image processing
- `node-fetch@^2.7.0` - Download từ CDN
- `xcode@^3.0.1` - iOS project manipulation

---

## ✅ Compatibility

- **Cordova**: 9.0+
- **iOS**: 11.0+
- **Android**: 5.0+ (API 21+)
- **Node.js**: 14.0+
- **OutSystems**: MABS 8.0+

---

## 📝 License

MIT

---

## 🤝 Contributing

Issues và Pull Requests welcome!

---

## 📧 Support

- **GitHub Issues**: https://github.com/vnkhoado/cordova-plugin-change-app-info/issues
- **Email**: support@example.com

---

## 🙏 Credits

Forked from [agoncalvesos/cordova-plugin-change-displayname](https://github.com/agoncalvesos/cordova-plugin-change-displayname)  
Enhanced by OutSystems Experts team.
