# OutSystems Integration Guide - v2.7.0 READ-ONLY

Hướng dẫn tích hợp plugin **READ-ONLY** vào OutSystems Mobile Apps (MABS).

---

## 📋 Mục lục

1. [Cài đặt Plugin](#1-cài-đặt-plugin)
2. [Cấu hình Extensibility](#2-cấu-hình-extensibility)
3. [Tạo JavaScript Module](#3-tạo-javascript-module)
4. [Sử dụng trong App](#4-sử-dụng-trong-app)
5. [Examples](#5-examples)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Cài đặt Plugin

### Bước 1.1: Thêm Plugin vào Project

1. Mở **Service Studio**
2. Chọn Mobile App
3. Vào **Module Properties** (F4)
4. Tab **Extensibility Configurations**
5. Paste JSON configuration:

```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#v2.7.0"
  }
}
```

### Bước 1.2: Thêm SQLite Dependency

Plugin cần `cordova-sqlite-storage`:

```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#v2.7.0"
  },
  "dependencies": [
    {
      "plugin": {
        "url": "cordova-sqlite-storage@6.1.0"
      }
    }
  ]
}
```

---

## 2. Cấu hình Extensibility

### Cấu hình Cơ bản (Development)

```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#v2.7.0"
  },
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
        "value": "1"
      },
      {
        "name": "ENVIRONMENT",
        "value": "development"
      },
      {
        "name": "API_BASE_URL",
        "value": "https://dev-api.myapp.com/api"
      }
    ]
  }
}
```

### Cấu hình Production

```json
{
  "plugin": {
    "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#v2.7.0"
  },
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
        "name": "ENVIRONMENT",
        "value": "production"
      },
      {
        "name": "API_BASE_URL",
        "value": "https://api.myapp.com/api"
      },
      {
        "name": "CDN_ICON",
        "value": "https://cdn.myapp.com/icon-1024.png"
      }
    ]
  }
}
```

### Tham số Configuration

| Parameter | Required | Mô tả | Ví dụ |
|-----------|----------|-------|-------|
| `APP_NAME` | No | Tên hiển thị app | "MyApp" |
| `VERSION_NUMBER` | No | Version string | "1.0.0" |
| `VERSION_CODE` | No | Build number | "1" |
| `ENVIRONMENT` | No | Environment | "development", "production" |
| `API_BASE_URL` | No | API base URL | "https://api.myapp.com/v1" |
| `CDN_ICON` | No | Icon URL (1024x1024) | "https://cdn.com/icon.png" |

⚠️ **Lưu ý**: `API_HOSTNAME` tự động inject bởi OutSystems, không cần thêm.

---

## 3. Tạo JavaScript Module

### Bước 3.1: Tạo Client Action - GetBuildInfo

1. Tạo **Client Action** mới: `GetBuildInfo`
2. Add **JavaScript** node
3. Code:

```javascript
// Wait for plugin ready
document.addEventListener('buildInfoReady', function(event) {
    try {
        // Get build info (READ-ONLY)
        var info = window.AppBuildInfo.getData();
        
        // Map to OutSystems output parameters
        $parameters.AppName = info.appName || '';
        $parameters.Version = info.versionNumber || '';
        $parameters.BuildCode = info.versionCode || '';
        $parameters.Environment = info.environment || '';
        $parameters.ApiBaseUrl = info.apiBaseUrl || '';
        $parameters.ApiHostname = info.apiHostname || '';
        $parameters.Platform = info.platform || '';
        $parameters.BuildTime = info.buildTime || '';
        
        $parameters.Success = true;
        $resolve();
        
    } catch (error) {
        console.error('[GetBuildInfo] Error:', error);
        $parameters.Success = false;
        $parameters.ErrorMessage = error.message;
        $resolve();
    }
}, false);

// Timeout fallback (5 seconds)
setTimeout(function() {
    if (!window.AppBuildInfo || !window.AppBuildInfo.isReady()) {
        console.error('[GetBuildInfo] Timeout - not ready');
        $parameters.Success = false;
        $parameters.ErrorMessage = 'Build info not ready';
        $resolve();
    }
}, 5000);
```

4. **Output Parameters**:
   - `Success` (Boolean)
   - `ErrorMessage` (Text)
   - `AppName` (Text)
   - `Version` (Text)
   - `BuildCode` (Text)
   - `Environment` (Text)
   - `ApiBaseUrl` (Text)
   - `ApiHostname` (Text)
   - `Platform` (Text)
   - `BuildTime` (Text)

### Bước 3.2: Tạo Client Action - GetApiConfig

```javascript
if (window.AppBuildInfo && window.AppBuildInfo.isReady()) {
    try {
        var apiConfig = window.AppBuildInfo.getApiConfig();
        
        $parameters.ApiHostname = apiConfig.hostname || '';
        $parameters.ApiBaseUrl = apiConfig.baseUrl || '';
        $parameters.Environment = apiConfig.environment || '';
        $parameters.Success = true;
        
    } catch (error) {
        console.error('[GetApiConfig] Error:', error);
        $parameters.Success = false;
        $parameters.ErrorMessage = error.message;
    }
} else {
    $parameters.Success = false;
    $parameters.ErrorMessage = 'Build info not initialized';
}

$resolve();
```

**Output Parameters**:
- `Success` (Boolean)
- `ErrorMessage` (Text)
- `ApiHostname` (Text)
- `ApiBaseUrl` (Text)
- `Environment` (Text)

### Bước 3.3: Tạo Client Action - IsProduction

```javascript
if (window.AppBuildInfo && window.AppBuildInfo.isReady()) {
    $parameters.IsProduction = window.AppBuildInfo.isProduction();
    $parameters.Success = true;
} else {
    $parameters.IsProduction = false;
    $parameters.Success = false;
}

$resolve();
```

**Output Parameters**:
- `Success` (Boolean)
- `IsProduction` (Boolean)

---

## 4. Sử dụng trong App

### 4.1. Initialize trong Splash Screen

**On Initialize**:
```
├─ GetBuildInfo
│   ├─ If Success
│   │   ├─ Assign: Session.AppVersion = GetBuildInfo.Version
│   │   ├─ Assign: Session.AppName = GetBuildInfo.AppName
│   │   ├─ Assign: Session.Environment = GetBuildInfo.Environment
│   │   ├─ Assign: Session.ApiBaseUrl = GetBuildInfo.ApiBaseUrl
│   │   └─ Continue to Home
│   └─ Else
│       └─ Show Error Message
```

### 4.2. Display Version trên UI

**About Screen**:
```
Container:
  ├─ Text: "App Name"
  │   └─ Expression: Session.AppName
  ├─ Text: "Version"
  │   └─ Expression: Session.AppVersion
  ├─ Text: "Environment"
  │   └─ Expression: Session.Environment
  └─ Text: "Build"
      └─ Expression: Session.BuildCode
```

### 4.3. Configure API Endpoints

**REST Service Configuration**:
```
On Ready:
  ├─ GetApiConfig
  └─ If Success
      ├─ Set REST Base URL = GetApiConfig.ApiBaseUrl
      └─ Continue
```

### 4.4. Environment-Specific Logic

```
On Initialize:
  ├─ IsProduction
  └─ If IsProduction
      ├─ Enable Analytics
      ├─ Hide Debug Menu
      └─ Set Log Level = Error
  └─ Else
      ├─ Disable Analytics  
      ├─ Show Debug Menu
      └─ Set Log Level = Debug
```

---

## 5. Examples

### Example 1: Complete Splash Screen Logic

```javascript
// Client Action: InitializeApp

// Step 1: Get build info
document.addEventListener('buildInfoReady', function(event) {
    var info = window.AppBuildInfo.getData();
    
    // Step 2: Store in session
    Session.AppName = info.appName;
    Session.Version = info.versionNumber;
    Session.Environment = info.environment;
    Session.ApiBaseUrl = info.apiBaseUrl;
    
    // Step 3: Configure API
    configureRestAPI(info.apiBaseUrl);
    
    // Step 4: Check environment
    if (window.AppBuildInfo.isProduction()) {
        enableProductionMode();
    } else {
        enableDevelopmentMode();
    }
    
    // Step 5: Continue to home
    navigateToHome();
});
```

### Example 2: Dynamic REST API Configuration

```javascript
// Client Action: ConfigureAPI

var apiConfig = window.AppBuildInfo.getApiConfig();

if (apiConfig && apiConfig.baseUrl) {
    // Use configured API
    $parameters.RestURL = apiConfig.baseUrl;
} else if (apiConfig && apiConfig.hostname) {
    // Fallback to hostname
    $parameters.RestURL = 'https://' + apiConfig.hostname + '/api';
} else {
    // Default
    $parameters.RestURL = 'https://default-api.com';
}

$resolve();
```

### Example 3: Settings Screen

**Screen: SettingsScreen**

```
Widgets:
  ├─ Label: "App Information"
  ├─ Text: Expression = "Name: " + Session.AppName
  ├─ Text: Expression = "Version: " + Session.Version
  ├─ Text: Expression = "Build: " + Session.BuildCode
  ├─ Text: Expression = "Environment: " + Session.Environment
  └─ Button: "Copy Version Info"
      └─ OnClick: CopyToClipboard(
            "App: " + Session.AppName + "\n" +
            "Version: " + Session.Version + "\n" +
            "Build: " + Session.BuildCode
         )
```

### Example 4: Conditional Features by Environment

```javascript
// Client Action: ShowDebugMenu

if (window.AppBuildInfo && window.AppBuildInfo.isReady()) {
    var isProduction = window.AppBuildInfo.isProduction();
    
    if (isProduction) {
        // Hide debug features in production
        $parameters.ShowDebugMenu = false;
        $parameters.EnableLogging = false;
        $parameters.ShowTestData = false;
    } else {
        // Show debug features in dev/staging
        $parameters.ShowDebugMenu = true;
        $parameters.EnableLogging = true;
        $parameters.ShowTestData = true;
    }
}

$resolve();
```

---

## 6. Troubleshooting

### ❌ "AppBuildInfo is undefined"

**Nguyên nhân**: JavaScript chạy trước khi plugin initialized.

**Giải pháp**:
```javascript
// ✅ ĐÚNG - Wait for event
document.addEventListener('buildInfoReady', function(event) {
    var info = window.AppBuildInfo.getData();
});

// ❌ SAI - Immediate access
var info = window.AppBuildInfo.getData(); // Error!
```

### ❌ "Build info is empty"

**Kiểm tra**:
1. Extensibility Configurations đúng format JSON?
2. Đã publish module?
3. Đã generate **native build** (không phải browser preview)?
4. Check MABS build logs

**Debug**:
```javascript
console.log('Plugin loaded?', typeof window.AppBuildInfo);
console.log('Is ready?', window.AppBuildInfo?.isReady());
console.log('Data:', window.AppBuildInfo?.getData());
```

### ❌ "Cannot store user data"

**Lý do**: Plugin v2.7.0 là **READ-ONLY**, không có write functions.

**Giải pháp**: Sử dụng OutSystems storage:

```javascript
// ❌ SAI - Function không tồn tại
AppBuildInfo.updateUserData('key', 'value'); // Error!

// ✅ ĐÚNG - Use OutSystems Local Storage
LocalStorage.SetItem('key', 'value');

// Or Client Variables
ClientVariable.UserData = value;

// Or Server-side Database
```

### ❌ "API_HOSTNAME is null"

**Nguyên nhân**: OutSystems tự động inject `API_HOSTNAME`.

**Giải pháp**:
- **Không cần** thêm `API_HOSTNAME` vào config
- OutSystems tự động set từ environment URL
- Nếu muốn override, dùng `API_BASE_URL`

### ❌ "Icons không thay đổi"

**iOS**:
1. Xóa app hoàn toàn
2. Generate clean build
3. Install lại
4. Icon phải 1024x1024 PNG

**Android**:
- Build mới tự động update icons

---

## 📚 Best Practices

### 1. Session Variables

Lưu build info vào Session khi app start:

```
Session Variables:
  ├─ AppName (Text)
  ├─ AppVersion (Text)
  ├─ BuildCode (Text)
  ├─ Environment (Text)
  ├─ ApiBaseUrl (Text)
  └─ IsProduction (Boolean)
```

### 2. Reusable Module

Tạo **BuildInfoModule** chứa:
- Client Actions để get build info
- Server Actions (nếu cần)
- Structures cho data models

→ Reference từ nhiều modules khác

### 3. Error Handling

Luôn handle errors:

```javascript
try {
    var info = window.AppBuildInfo.getData();
    $parameters.Success = true;
} catch (error) {
    console.error('Error:', error);
    $parameters.Success = false;
    $parameters.ErrorMessage = error.message;
}
```

### 4. Environment Configuration

**Development**:
```json
{
  "name": "ENVIRONMENT",
  "value": "development"
}
```

**Production**:
```json
{
  "name": "ENVIRONMENT",
  "value": "production"
}
```

Sử dụng trong logic:
```javascript
if (window.AppBuildInfo.isProduction()) {
    // Production behavior
} else {
    // Development behavior
}
```

---

## 🔍 Testing

### Test trong Browser (Limited)

⚠️ Plugin **KHÔNG hoạt động** trong browser preview.

→ Phải test trên **native build** (device/emulator).

### Test trên Device

1. Generate native build từ Service Center
2. Install trên device/emulator
3. Check console logs:
   ```
   [Build Info] Database opened (READ-ONLY)
   [Build Info] Loaded (READ-ONLY)
   [Build Info] MyApp v1.0.0
   ```

### Debug Checklist

- [ ] Plugin đã add vào Extensibility Configurations?
- [ ] Preferences đã config đúng?
- [ ] Module đã publish?
- [ ] Native build đã generate?
- [ ] SQLite plugin đã install?
- [ ] Code wait for `buildInfoReady` event?

---

## 📖 API Reference (READ-ONLY)

### window.AppBuildInfo.getData()

```javascript
var info = window.AppBuildInfo.getData();
// Returns:
{
  appName: "MyApp",
  versionNumber: "1.0.0",
  versionCode: "1",
  packageName: "com.myapp",
  platform: "android",
  buildTime: "2025-12-12T10:00:00Z",
  buildTimestamp: 1702378800000,
  apiHostname: "api.myapp.com",
  apiBaseUrl: "https://api.myapp.com/v1",
  environment: "production",
  cdnIcon: "https://cdn.com/icon.png",
  storageType: "sqlite-readonly"
}
```

### window.AppBuildInfo.isReady()

```javascript
var ready = window.AppBuildInfo.isReady();
// Returns: true/false
```

### window.AppBuildInfo.getApiConfig()

```javascript
var apiConfig = window.AppBuildInfo.getApiConfig();
// Returns:
{
  hostname: "api.myapp.com",
  baseUrl: "https://api.myapp.com/v1",
  environment: "production"
}
```

### window.AppBuildInfo.isProduction()

```javascript
var isProd = window.AppBuildInfo.isProduction();
// Returns: true/false
```

### window.AppBuildInfo.getBuildTimestamp()

```javascript
var timestamp = window.AppBuildInfo.getBuildTimestamp();
// Returns: 1702378800000 (milliseconds)
```

---

## 🔗 Links

- **Plugin Repository**: https://github.com/vnkhoado/cordova-plugin-change-app-info
- **OutSystems MABS Docs**: https://success.outsystems.com/Documentation/11/Delivering_Mobile_Apps/Mobile_Apps_Build_Service
- **Cordova SQLite Plugin**: https://github.com/storesafe/cordova-sqlite-storage

---

## ⚠️ Important Notes

### v2.7.0 is READ-ONLY

⚠️ **Không có write operations**:
- ❌ `updateUserData()` - REMOVED
- ❌ `getUserData()` - REMOVED
- ❌ `updateSettings()` - REMOVED

✅ **Chỉ read operations**:
- ✅ `getData()` - Read build info
- ✅ `getApiConfig()` - Read API config
- ✅ `isProduction()` - Check environment

### Storage Alternatives

Nếu cần lưu user data:

1. **OutSystems Local Storage**
   ```javascript
   LocalStorage.SetItem('key', 'value');
   var value = LocalStorage.GetItem('key');
   ```

2. **OutSystems Client Variables**
   ```
   ClientVariable.UserData = value;
   ```

3. **Server Database**
   - Create entity
   - Use Server Actions

4. **Cordova Plugins**
   - `cordova-plugin-nativestorage`
   - `cordova-plugin-secure-storage` (for sensitive data)

---

**Last Updated**: December 12, 2025  
**Plugin Version**: 2.7.0 (READ-ONLY)  
**OutSystems**: 11.x