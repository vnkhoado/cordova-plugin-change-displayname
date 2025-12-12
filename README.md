# Cordova Plugin Change App Info

Cordova plugin để thay đổi app display name, version và icon từ CDN lúc build time. Hỗ trợ inject build info vào app runtime và gửi build notification qua API. Tối ưu cho **OutSystems MABS**.

---

## ✨ Tính năng

### Build Time
- ✅ Thay đổi display name của app  
- ✅ Thay đổi version number và version code  
- ✅ Download và generate icon từ CDN URL  
- ✅ Tự động tạo tất cả kích thước icon cần thiết (iOS & Android)  
- ✅ Clean build cache để đảm bảo thay đổi được áp dụng  
- ✅ Multiple hooks để tránh bị overwrite  
- ✅ Support iOS (xcassets) và Android (mipmap)  

### Runtime (NEW)
- ✅ **Inject build info vào localStorage** - App có thể đọc version, API config, etc.
- ✅ **Preserve user data** - User data không bị mất khi update app
- ✅ **Offline mode** - Hoạt động hoàn toàn offline, không cần internet
- ✅ **Global variable** - `window.APP_BUILD_INFO` sẵn sàng khi app khởi động

### Build Notification (NEW)
- ✅ **Gửi build notification qua API** - Track builds thành công
- ✅ **Toggle on/off** - Bật/tắt notification bằng config
- ✅ **Bearer Token authentication** - Secure API calls
- ✅ **Backup original values** - So sánh thay đổi trước/sau build

### Compatible với OutSystems MABS
- ✅ Tự động đọc `API_HOSTNAME` từ MABS
- ❌ **Đã loại bỏ**: Thay đổi package name / bundle ID (gây conflict với iOS provisioning profile)

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
            },
            {
                "name": "ENABLE_BUILD_NOTIFICATION",
                "value": "true"
            },
            {
                "name": "BUILD_SUCCESS_API_URL",
                "value": "https://your-api.com/build-success"
            },
            {
                "name": "BUILD_API_BEARER_TOKEN",
                "value": "your-bearer-token"
            }
        ]
    }
}
```

**Lưu ý quan trọng:**
- Tất cả preferences phải nằm trong `preferences.global` array
- `VERSION_NUMBER` và `VERSION_CODE` **phải tồn tại cùng nhau** hoặc đều không có
- `API_HOSTNAME` **TỰ ĐỘNG** được inject bởi OutSystems MABS - KHÔNG CẦN thêm thủ công
- `ENABLE_BUILD_NOTIFICATION` mặc định là `false` - set `true` để bật

**Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_NAME` | Optional | Tên hiển thị của app |
| `VERSION_NUMBER` | Optional | Version string (e.g., "1.0.0") - Bắt buộc cùng VERSION_CODE |
| `VERSION_CODE` | Optional | Build number (integer) - Bắt buộc cùng VERSION_NUMBER |
| `CDN_ICON` | Optional | URL của app icon (1024x1024px PNG) |
| `API_HOSTNAME` | Auto | ⚠️ **Tự động inject bởi MABS** - không cần thêm |
| `ENABLE_BUILD_NOTIFICATION` | Optional | `true` hoặc `false` - bật/tắt build notification |
| `BUILD_SUCCESS_API_URL` | If enabled | API endpoint để gửi build notification |
| `BUILD_API_BEARER_TOKEN` | If enabled | Bearer token cho API authentication |

### Config.xml (Alternative)
```xml
<widget>
    <preference name="APP_NAME" value="Your App Name" />
    <preference name="VERSION_NUMBER" value="1.0.0" />
    <preference name="VERSION_CODE" value="1" />
    <preference name="CDN_ICON" value="https://cdn.example.com/icon.png" />
    
    <!-- Build Notification (Optional) -->
    <preference name="ENABLE_BUILD_NOTIFICATION" value="true" />
    <preference name="BUILD_SUCCESS_API_URL" value="https://api.com/build" />
    <preference name="BUILD_API_BEARER_TOKEN" value="token" />
</widget>
```

---

## 🚀 Sử dụng Build Info trong App

### Đọc từ Global Variable (Recommended)

```javascript
document.addEventListener('deviceready', function() {
  // Build info có sẵn trong window.APP_BUILD_INFO
  const buildInfo = window.APP_BUILD_INFO;
  
  console.log('App Name:', buildInfo.appName);
  console.log('Version:', buildInfo.versionNumber);
  console.log('Build Code:', buildInfo.versionCode);
  console.log('Backend Host:', buildInfo.apiHostname); // Từ MABS
  console.log('Platform:', buildInfo.platform);
  console.log('Build Time:', buildInfo.buildTime);
  
  // Sử dụng để gọi API
  const backendUrl = `https://${buildInfo.apiHostname}/api`;
  fetch(backendUrl + '/users');
  
}, false);
```

### Đọc từ localStorage

```javascript
// Backup method
const buildInfoStr = localStorage.getItem('APP_BUILD_INFO');
const buildInfo = JSON.parse(buildInfoStr);

console.log('Version:', buildInfo.versionNumber);
```

### Lưu User Data (Không mất khi update app)

```javascript
// Lưu user data
window.updateAppUserData('userId', '12345');
window.updateAppUserData('userName', 'John Doe');

// Lưu settings
window.updateAppSettings({
  theme: 'dark',
  notifications: true,
  language: 'vi'
});

// Data này sẽ KHÔNG MẤT khi build/update app mới
```

### Cấu trúc dữ liệu trong localStorage

```json
{
  "appName": "MyApp",
  "versionNumber": "1.0.0",
  "versionCode": "100",
  "packageName": "com.example.myapp",
  "platform": "android",
  "buildTime": "2025-12-12T04:21:00.000Z",
  "buildTimestamp": 1733977260000,
  
  "apiHostname": "yourapp.outsystemscloud.com",
  
  "firstInstallTime": "2025-11-01T10:00:00.000Z",
  "firstInstallVersion": "0.9.0",
  "installCount": 3,
  
  "userData": {
    "userId": "12345",
    "userName": "John Doe"
  },
  "userSettings": {
    "theme": "dark",
    "notifications": true
  },
  
  "lastUpdateTime": "2025-12-12T04:21:00.000Z",
  "previousVersion": "0.9.0"
}
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

### Build Process

```
1. before_prepare
   └─ backupAppInfo.js - Backup original app info

2. after_prepare
   ├─ changeAppInfo.js - Update app name, version
   ├─ generateIcons.js - Download & generate icons from CDN
   └─ injectBuildInfo.js - Inject build info to localStorage

3. before_build (iOS)
   └─ cleanBuild.js - Clean build cache

4. BUILD PROCESS
   └─ Cordova builds .apk/.ipa

5. after_build (only if build SUCCESS)
   └─ sendBuildSuccess.js - Send notification to API (if enabled)
```

### Hooks
- `before_prepare`: Backup app info
- `after_prepare`: Update app info, generate icons, inject build info
- `before_build` (iOS): Clean build cache
- `after_build`: Send build notification (nếu `ENABLE_BUILD_NOTIFICATION=true`)

### Config Files Modified
- **iOS**: `Info.plist` (CFBundleDisplayName, CFBundleShortVersionString, CFBundleVersion)
- **Android**: `AndroidManifest.xml` (versionName, versionCode), `strings.xml` (app_name)
- **Both**: `www/build-info.js` (injected), `www/index.html` (script tag added)

### Validation Logic
- Nếu preference không có hoặc rỗng (`""`), plugin sẽ bỏ qua không xử lý
- `VERSION_NUMBER` và `VERSION_CODE` phải có cùng nhau, nếu thiếu 1 trong 2 sẽ bỏ qua cả 2
- `ENABLE_BUILD_NOTIFICATION` mặc định `false`, chỉ gửi API khi set `true`

---

## 🌐 Build Notification API

### API Request

```http
POST /build-success
Content-Type: application/json
Authorization: Bearer your-token-here

{
  "timestamp": "2025-12-12T04:21:00.000Z",
  "buildStatus": "success",
  "platforms": ["android", "ios"],
  "original": {
    "android": {
      "appName": "Old App",
      "versionNumber": "0.9.0",
      "versionCode": "90"
    }
  },
  "new": {
    "appName": "MyApp Production",
    "versionNumber": "1.0.0",
    "versionCode": "100"
  },
  "changes": {
    "android": {
      "appName": {
        "from": "Old App",
        "to": "MyApp Production",
        "changed": true
      },
      "versionNumber": {
        "from": "0.9.0",
        "to": "1.0.0",
        "changed": true
      }
    }
  }
}
```

### API Response (Expected)

```json
{
  "status": "success",
  "message": "Build notification received",
  "buildId": "12345"
}
```

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

### ❌ Build notification không được gửi

**Kiểm tra:**
1. `ENABLE_BUILD_NOTIFICATION` có set `true` không?
2. `BUILD_SUCCESS_API_URL` có đúng không?
3. Check console output trong build log
4. Verify Bearer Token có đúng không?

### ❌ window.APP_BUILD_INFO là undefined

**Nguyên nhân:** Đọc trước khi `deviceready` event

**Giải pháp:**
```javascript
// ✅ ĐÚNG
document.addEventListener('deviceready', function() {
  const info = window.APP_BUILD_INFO; // OK
}, false);

// ❌ SAI
const info = window.APP_BUILD_INFO; // undefined
```

### ❌ User data bị mất sau update

**Kiểm tra:**
- User có uninstall app không? (uninstall sẽ xóa localStorage)
- Có clear app data không?
- Build info có được inject đúng không?

---

## 📚 Documentation

- `QUICK_START.md` - Quick start cho OutSystems MABS
- `CHANGELOG.md` - Version history
- `example-outsystems-config.json` - Example config

---

## 🎯 Example Configs

### Development (No notification)
```json
{
    "preferences": {
        "global": [
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
            },
            {
                "name": "ENABLE_BUILD_NOTIFICATION",
                "value": "false"
            }
        ]
    }
}
```

### Production (With notification)
```json
{
    "preferences": {
        "global": [
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
            },
            {
                "name": "ENABLE_BUILD_NOTIFICATION",
                "value": "true"
            },
            {
                "name": "BUILD_SUCCESS_API_URL",
                "value": "https://api.myapp.com/build-success"
            },
            {
                "name": "BUILD_API_BEARER_TOKEN",
                "value": "prod-bearer-token"
            }
        ]
    }
}
```

### Minimal (Chỉ inject build info)
```json
{
    "preferences": {
        "global": [
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
│   ├── backupAppInfo.js       # Backup original app info
│   ├── changeAppInfo.js       # Update app info
│   ├── generateIcons.js       # Generate icons from CDN
│   ├── injectBuildInfo.js     # Inject build info to localStorage
│   ├── sendBuildSuccess.js    # Send build notification
│   ├── cleanBuild.js          # Clean build cache
│   └── utils.js               # Helper functions
└── scripts/
    └── postinstall.js         # Auto-install dependencies
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

---

## 🙏 Credits

Forked from [agoncalvesos/cordova-plugin-change-displayname](https://github.com/agoncalvesos/cordova-plugin-change-displayname)  
Enhanced by OutSystems Experts team.
