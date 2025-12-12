# Configuration Examples

Mẫu cấu hình cho plugin `cordova-plugin-change-app-info` v2.7.0

---

## 📁 Files

### OutSystems MABS Configurations

1. **`outsystems-config-dev.json`** - Development environment
2. **`outsystems-config-staging.json`** - Staging environment  
3. **`outsystems-config-production.json`** - Production environment

### Cordova Configuration

4. **`cordova-config.xml`** - Standard Cordova config.xml sample

---

## 🚀 Sử dụng với OutSystems

### Bước 1: Chọn file config phù hợp

```
Development   → outsystems-config-dev.json
Staging       → outsystems-config-staging.json
Production    → outsystems-config-production.json
```

### Bước 2: Cập nhật giá trị

Mở file và chỉnh sửa:

```json
{
  "preferences": {
    "global": [
      {
        "name": "APP_NAME",
        "value": "TÊN APP CỦA BẠN"  // ← Sửa đây
      },
      {
        "name": "CDN_ICON",
        "value": "https://your-cdn.com/icon.png"  // ← Sửa đây
      }
    ]
  }
}
```

### Bước 3: Copy vào OutSystems

1. Mở **Service Studio**
2. Chọn Mobile App → **Properties** (F4)
3. Tab **Extensibility Configurations**
4. Paste nội dung JSON
5. Click **Apply**
6. **Publish** module

---

## 🔧 Sử dụng với Cordova CLI

### Bước 1: Copy file config.xml

```bash
cp examples/cordova-config.xml config.xml
```

### Bước 2: Chỉnh sửa cho project

```xml
<!-- Sửa app ID -->
<widget id="com.yourcompany.yourapp" version="1.0.0">

<!-- Sửa tên app -->
<name>Your App Name</name>

<!-- Sửa build info -->
<preference name="APP_NAME" value="Your App" />
<preference name="CDN_ICON" value="https://cdn.com/icon.png" />
```

### Bước 3: Build

```bash
# Add platforms
cordova platform add android
cordova platform add ios

# Build
cordova build android
cordova build ios
```

---

## 📋 Tham số Configuration

### Bắt buộc

Không có tham số nào là bắt buộc. Plugin sẽ dùng giá trị mặc định từ `config.xml`.

### Khuyến nghị

| Parameter | Mô tả | Ví dụ | Mặc định |
|-----------|-------|-------|----------|
| `APP_NAME` | Tên hiển thị app | "MyApp" | Từ config.xml |
| `VERSION_NUMBER` | Version string | "1.0.0" | Từ config.xml |
| `VERSION_CODE` | Build number | "1" | "0" |
| `ENVIRONMENT` | Environment | "production" | "production" |

### Tùy chọn

| Parameter | Mô tả | Ví dụ |
|-----------|-------|-------|
| `CDN_ICON` | Icon URL 1024x1024 | "https://cdn.com/icon.png" |
| `ENABLE_BUILD_NOTIFICATION` | Bật thông báo build | "true" |
| `BUILD_SUCCESS_API_URL` | API endpoint | "https://api.com/notify" |
| `BUILD_API_BEARER_TOKEN` | Bearer token | "token123" |

### Tự động inject (OutSystems)

| Parameter | Nguồn | Mô tả |
|-----------|-------|-------|
| `API_HOSTNAME` | OutSystems Environment | Tự động inject |

---

## 🌍 Environment-Specific Configs

### Development

```json
{
  "name": "APP_NAME",
  "value": "MyApp DEV"  // Thêm suffix DEV
},
{
  "name": "ENVIRONMENT",
  "value": "development"  // Enable debug logs
},
{
  "name": "CDN_ICON",
  "value": "https://cdn.com/icon-dev.png"  // Dev icon (có badge)
}
```

**Đặc điểm**:
- ✅ Debug logs enabled
- ✅ Show dev badge on icon
- ✅ Clear app name suffix

### Staging

```json
{
  "name": "APP_NAME",
  "value": "MyApp STG"
},
{
  "name": "ENVIRONMENT",
  "value": "staging"
},
{
  "name": "CDN_ICON",
  "value": "https://cdn.com/icon-staging.png"
}
```

**Đặc điểm**:
- ⚠️ Limited logging
- ⚠️ Show staging badge
- ⚠️ Testing features enabled

### Production

```json
{
  "name": "APP_NAME",
  "value": "MyApp"  // No suffix
},
{
  "name": "ENVIRONMENT",
  "value": "production"  // No debug logs
},
{
  "name": "CDN_ICON",
  "value": "https://cdn.com/icon.png"  // Clean icon
},
{
  "name": "ENABLE_BUILD_NOTIFICATION",
  "value": "true"  // Enable notifications
}
```

**Đặc điểm**:
- 🔒 No debug logs (security)
- 🔒 Clean production icon
- 🔒 Build notifications enabled
- 🔒 Analytics enabled

---

## 🎨 Icon Requirements

### Size
- **1024x1024 pixels** (required)
- PNG format
- RGB color space (not CMYK)

### Recommendations

```
✅ DO:
- Use square images (1024x1024)
- Use transparent background for iOS
- Use high-quality PNG
- Test on both light/dark backgrounds

❌ DON'T:
- Use alpha transparency for Android
- Use images smaller than 1024x1024
- Use JPEG or GIF formats
- Use rounded corners (auto-applied by OS)
```

### CDN Hosting

**Recommended CDN providers**:
- Cloudflare R2
- AWS S3 + CloudFront
- Google Cloud Storage
- Azure Blob Storage

**Example URLs**:
```
https://cdn.yourcompany.com/icons/app-icon-1024.png
https://assets.yourapp.com/v1/icon.png
https://storage.googleapis.com/your-bucket/icon.png
```

---

## 🔐 Security Best Practices

### 1. Không commit secrets

```json
// ❌ BAD - Don't commit to git
{
  "name": "BUILD_API_BEARER_TOKEN",
  "value": "actual-secret-token-123"
}

// ✅ GOOD - Use placeholders
{
  "name": "BUILD_API_BEARER_TOKEN",
  "value": "REPLACE_WITH_YOUR_TOKEN"
}
```

### 2. Sử dụng environment variables

**OutSystems**:
- Store secrets in Service Center
- Use Site Properties
- Reference in Extensibility Configurations

**Cordova**:
- Use environment variables
- Store in `.env` file (gitignored)
- Load at build time

### 3. Rotate tokens định kỳ

```
Development: Monthly
Staging:     Monthly  
Production:  Quarterly
```

---

## 📱 Platform-Specific Notes

### Android

```json
{
  "name": "VERSION_CODE",
  "value": "10"  // Must be integer, increment each build
}
```

**Version Code Rules**:
- Must be an integer
- Must increment for each release
- Cannot decrease
- Google Play uses this for versioning

### iOS

```json
{
  "name": "VERSION_NUMBER",
  "value": "1.0.0"  // Semantic versioning
}
```

**Version Number Rules**:
- Use semantic versioning (major.minor.patch)
- Must match App Store Connect version
- Can have build suffix (-dev, -beta)

---

## ❓ Troubleshooting

### Config không apply

**Kiểm tra**:
1. ✅ JSON syntax đúng?
2. ✅ Đã publish module?
3. ✅ Đã generate native build?
4. ✅ Check MABS build logs

### Icon không hiển thị

**Kiểm tra**:
1. ✅ Icon 1024x1024?
2. ✅ CDN URL accessible?
3. ✅ PNG format?
4. ✅ Clean install app?

### API_HOSTNAME null

**Giải pháp**:
- OutSystems tự động inject
- Không cần thêm vào config
- Check environment URL

---

## 📞 Support

- **Issues**: https://github.com/vnkhoado/cordova-plugin-change-app-info/issues
- **Docs**: [README.md](../README.md)
- **OutSystems Guide**: [OUTSYSTEMS_GUIDE.md](../OUTSYSTEMS_GUIDE.md)

---

**Last Updated**: December 12, 2025  
**Plugin Version**: 2.7.0