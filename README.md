# Cordova Plugin Change App Info

Cordova plugin để thay đổi app display name, version và icon từ CDN lúc build time. **Tạo SQLite database trực tiếp lúc build** để lưu build info (không inject JavaScript). Hỗ trợ gửi build notification qua API. Tối ưu cho **OutSystems MABS**.

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
- ✅ **Tạo SQLite database với build info** - Có sẵn ngay khi app khởi động

### Runtime (v2.6.0+) 🆕
- ✅ **Pre-built SQLite database** - Database được tạo sẵn lúc build, không cần khởi tạo runtime
- ✅ **Instant access** - Build info có sẵn ngay, không cần chờ async initialization
- ✅ **Faster startup** - Không có overhead tạo database khi app khởi động
- ✅ **Preserve user data** - User data không bị mất khi update app
- ✅ **Install history tracking** - Tự động track cài đặt và update
- ✅ **Offline mode** - Hoạt động hoàn toàn offline, không cần internet
- ✅ **Global variable** - `window.APP_BUILD_INFO` sẵn sàng sau `deviceready`

### Build Notification
- ✅ **Gửi build notification qua API** - Track builds thành công
- ✅ **Toggle on/off** - Bật/tắt notification bằng config
- ✅ **Bearer Token authentication** - Secure API calls
- ✅ **Backup original values** - So sánh thay đổi trước/sau build

### Compatible với OutSystems MABS
- ✅ Tự động đọc `API_HOSTNAME` và `API_BASE_URL` từ MABS
- ✅ Tự động đọc `ENVIRONMENT` từ config
- ❌ **Đã loại bỏ**: Thay đổi package name / bundle ID (gây conflict với iOS provisioning profile)

---

## 🆕 What's New in v2.6.0

### Direct SQLite Database Creation

Phiên bản 2.6.0 giới thiệu cách tiếp cận mới:

**Trước đây (v2.5.0):**
- Inject JavaScript vào `index.html`
- Tạo database khi app khởi động (runtime)
- Phải chờ `deviceready` event
- Có overhead khởi tạo database

**Bây giờ (v2.6.0+):**
- Tạo SQLite database **trực tiếp lúc build**
- Database có sẵn trong app bundle
- App chỉ cần đọc database (không tạo mới)
- Nhanh hơn và tin cậy hơn

📖 **Chi tiết**: Xem [SQLITE_DIRECT_BUILD.md](SQLITE_DIRECT_BUILD.md)

---

## 📦 Cài đặt

### From Git
```bash
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git
```

### Specific Version
```bash
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git#v2.6.0
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
                "name": "API_BASE_URL",
                "value": "https://api.myapp.com/v1"
            },
            {
                "name": "ENVIRONMENT",
                "value": "production"
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
| `API_BASE_URL` | Optional | Base URL cho API calls (e.g., "https://api.myapp.com/v1") |
| `ENVIRONMENT` | Optional | Environment name ("development", "staging", "production") |
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
    
    <!-- Runtime Configuration -->
    <preference name="API_BASE_URL" value="https://api.myapp.com/v1" />
    <preference name="ENVIRONMENT" value="production" />
    
    <!-- Build Notification (Optional) -->
    <preference name="ENABLE_BUILD_NOTIFICATION" value="true" />
    <preference name="BUILD_SUCCESS_API_URL" value="https://api.com/build" />
    <preference name="BUILD_API_BEARER_TOKEN" value="token" />
</widget>
```

---

## 🚀 Sử dụng Build Info trong App

### Đọc Build Info (v2.6.0+)

```javascript
document.addEventListener('deviceready', function() {
  // Build info có sẵn trong window.APP_BUILD_INFO
  const buildInfo = window.APP_BUILD_INFO;
  
  console.log('App Name:', buildInfo.appName);
  console.log('Version:', buildInfo.versionNumber);
  console.log('Build Code:', buildInfo.versionCode);
  console.log('API Hostname:', buildInfo.apiHostname); // Từ MABS
  console.log('API Base URL:', buildInfo.apiBaseUrl);
  console.log('Environment:', buildInfo.environment);
  console.log('Platform:', buildInfo.platform);
  console.log('Build Time:', buildInfo.buildTime);
  console.log('Storage Type:', buildInfo.storageType); // 'sqlite-prebuild'
  
  // Sử dụng để gọi API
  const apiUrl = buildInfo.apiBaseUrl || `https://${buildInfo.apiHostname}/api`;
  fetch(apiUrl + '/users');
  
}, false);
```

### Sử dụng Event (Recommended)

```javascript
// Listen for buildInfoReady event
document.addEventListener('buildInfoReady', function(event) {
  const buildInfo = event.detail;
  
  console.log('Build info ready:', buildInfo);
  
  // Initialize your app with build info
  initializeApp(buildInfo);
}, false);
```

### Lưu User Data (Persists across updates)

```javascript
// Lưu user data
window.updateAppUserData('userId', '12345', function(err) {
  if (!err) console.log('User ID saved');
});

window.updateAppUserData('userName', 'John Doe', function(err) {
  if (!err) console.log('User name saved');
});

// Đọc user data
window.getAppUserData('userId', function(err, value) {
  console.log('User ID:', value);
});

// Lưu settings (multiple keys at once)
window.updateAppSettings({
  theme: 'dark',
  notifications: true,
  language: 'vi'
}, function(err) {
  if (!err) console.log('Settings saved');
});

// Đọc single setting
window.getAppSetting('theme', function(err, value) {
  console.log('Theme:', value);
});

// Data này sẽ KHÔNG MẤT khi build/update app mới
```

### Install History

```javascript
// Lấy lịch sử cài đặt/update
window.getInstallHistory(function(err, history) {
  if (!err) {
    console.log('Install history:', history);
    // [
    //   { version_number: '1.0.0', install_type: 'first_install', ... },
    //   { version_number: '1.0.1', install_type: 'update', ... }
    // ]
  }
});
```

### Cấu trúc dữ liệu APP_BUILD_INFO

```javascript
{
  // Build info (from build time)
  appName: "MyApp",
  versionNumber: "1.0.0",
  versionCode: "1",
  packageName: "com.example.myapp",
  platform: "android",
  buildTime: "2025-12-12T10:30:00.000Z",
  buildTimestamp: 1733998200000,
  
  // API Configuration
  apiHostname: "yourapp.outsystemscloud.com",
  apiBaseUrl: "https://api.myapp.com/v1",
  environment: "production",
  
  // Storage indicator
  storageType: "sqlite-prebuild"
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

### Build Process (v2.6.0+)

```
1. before_prepare
   └─ backupAppInfo.js - Backup original app info

2. after_prepare
   ├─ changeAppInfo.js - Update app name, version
   ├─ generateIcons.js - Download & generate icons from CDN
   └─ injectBuildInfo.js - ⭐ CREATE PRE-BUILT SQLITE DATABASE
       ├─ Create database with better-sqlite3
       ├─ Populate with build info
       ├─ Copy to platform assets (Android) / Resources (iOS)
       └─ Create lightweight helper JS (no DB creation logic)

3. before_build (iOS)
   └─ cleanBuild.js - Clean build cache

4. BUILD PROCESS
   └─ Cordova builds .apk/.ipa with database bundled

5. after_build (only if build SUCCESS)
   └─ sendBuildSuccess.js - Send notification to API (if enabled)
```

### Runtime Flow (v2.6.0+)

```
1. App launches
2. deviceready event fires
3. build-info-helper.js runs
   ├─ Opens existing SQLite database (no creation)
   ├─ Reads build info from pre-built database
   ├─ Checks for first install / update
   ├─ Records install event if needed
   └─ Exposes window.APP_BUILD_INFO
4. Fires 'buildInfoReady' event
5. App code can use build info
```

### Database Tables

- **build_info**: Current build information (single row)
- **install_history**: Installation and update history
- **user_data**: User-specific data (persists across updates)
- **app_settings**: App settings (persists across updates)

### Config Files Modified
- **iOS**: `Info.plist` (CFBundleDisplayName, CFBundleShortVersionString, CFBundleVersion)
- **Android**: `AndroidManifest.xml` (versionName, versionCode), `strings.xml` (app_name)
- **Both**: 
  - `app_build_info.db` (SQLite database - NEW in v2.6.0)
  - `build-info-helper.js` (lightweight helper)
  - `index.html` (script tag added)

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

### ❌ Build failed: "better-sqlite3 not installed"

**Giải pháp:**
```bash
cd plugins/cordova-plugin-change-app-info
npm install
```

### ❌ Database not found at runtime

**Android:**
```bash
# Check if database exists
ls platforms/android/app/src/main/assets/app_build_info.db
```

**iOS:**
1. Open Xcode project
2. Check if `app_build_info.db` is in project navigator
3. Verify "Target Membership" is checked
4. Clean and rebuild from Xcode

### ❌ Build notification không được gửi

**Kiểm tra:**
1. `ENABLE_BUILD_NOTIFICATION` có set `true` không?
2. `BUILD_SUCCESS_API_URL` có đúng không?
3. Check console output trong build log
4. Verify Bearer Token có đúng không?

### ❌ window.APP_BUILD_INFO là undefined

**Nguyên nhân:** Đọc trước khi `deviceready` event hoặc `buildInfoReady` event

**Giải pháp:**
```javascript
// ✅ ĐÚNG - Method 1
document.addEventListener('buildInfoReady', function(event) {
  const info = event.detail; // OK
}, false);

// ✅ ĐÚNG - Method 2
document.addEventListener('deviceready', function() {
  // Wait a bit for database to load
  setTimeout(() => {
    const info = window.APP_BUILD_INFO; // OK
  }, 100);
}, false);

// ❌ SAI
const info = window.APP_BUILD_INFO; // undefined
```

### ❌ User data bị mất sau update

**Kiểm tra:**
- User có uninstall app không? (uninstall sẽ xóa database)
- Có clear app data không?
- Database có được copy đúng không?

### ❌ Old build-info.js still present

**Giải pháp:**
```bash
cordova clean
rm -rf platforms/*/www/build-info.js
cordova build
```

---

## 📚 Documentation

- **[SQLITE_DIRECT_BUILD.md](SQLITE_DIRECT_BUILD.md)** - Chi tiết về direct SQLite database creation (v2.6.0+)
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
                "name": "ENVIRONMENT",
                "value": "development"
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
                "name": "API_BASE_URL",
                "value": "https://api.myapp.com/v1"
            },
            {
                "name": "ENVIRONMENT",
                "value": "production"
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
│   ├── injectBuildInfo.js     # 🆕 Create pre-built SQLite database
│   ├── sendBuildSuccess.js    # Send build notification
│   ├── cleanBuild.js          # Clean build cache
│   └── utils.js               # Helper functions
├── scripts/
│   └── postinstall.js         # Auto-install dependencies
└── docs/
    └── SQLITE_DIRECT_BUILD.md # v2.6.0 documentation
```

---

## 🔗 Dependencies

### Build Time
- `sharp@^0.33.0` - Image processing
- `node-fetch@^2.7.0` - Download từ CDN
- `xcode@^3.0.1` - iOS project manipulation
- `better-sqlite3@^9.0.0` - 🆕 SQLite database creation

### Runtime
- `cordova-sqlite-storage@^6.1.0` - SQLite access (auto-installed)

---

## ✅ Compatibility

- **Cordova**: 9.0+
- **iOS**: 11.0+
- **Android**: 5.0+ (API 21+)
- **Node.js**: 14.0+ (16.0+ recommended for better-sqlite3)
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
- **Documentation**: See [SQLITE_DIRECT_BUILD.md](SQLITE_DIRECT_BUILD.md) for v2.6.0 details

---

## 🙏 Credits

Forked from [agoncalvesos/cordova-plugin-change-displayname](https://github.com/agoncalvesos/cordova-plugin-change-displayname)  
Enhanced by OutSystems Experts team.