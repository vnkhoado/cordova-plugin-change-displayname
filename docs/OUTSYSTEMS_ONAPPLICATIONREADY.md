# OutSystems OnApplicationReady Integration

Hướng dẫn sử dụng Build Info Plugin trong OutSystems với **OnApplicationReady** event.

---

## 🎯 Tại sao dùng OnApplicationReady?

**OnApplicationReady** là event thích hợp nhất để lắng nghe `buildInfoReady` vì:

✅ Fire **sau** khi Cordova `deviceready` 
✅ Chạy **trước** khi hiển thị UI  
✅ Phù hợp cho **initialization logic**  
✅ Không bị **race condition**  

---

## 🛠️ Setup trong OutSystems

### Bước 1: Tạo Client Action - InitBuildInfo

**Tạo Client Action mới**:
- Name: `InitBuildInfo`
- Function: No
- Client Action: Yes

**Output Parameters**:
- `Success` (Boolean)
- `AppName` (Text)
- `Version` (Text)
- `BuildCode` (Text)
- `Environment` (Text)
- `ApiHostname` (Text)
- `ErrorMessage` (Text)

**JavaScript Code**:

```javascript
// Wait for build info to be ready
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    // Success - store in output parameters
    $parameters.Success = true;
    $parameters.AppName = info.appName || '';
    $parameters.Version = info.versionNumber || '';
    $parameters.BuildCode = info.versionCode || '';
    $parameters.Environment = info.environment || '';
    $parameters.ApiHostname = info.apiHostname || '';
    $parameters.ErrorMessage = '';
    
    console.log('[InitBuildInfo] Success:', info.appName, 'v' + info.versionNumber);
    $resolve();
  })
  .catch(function(error) {
    // Error - timeout or not available
    $parameters.Success = false;
    $parameters.AppName = '';
    $parameters.Version = '';
    $parameters.BuildCode = '';
    $parameters.Environment = '';
    $parameters.ApiHostname = '';
    $parameters.ErrorMessage = error.message || 'Failed to load build info';
    
    console.error('[InitBuildInfo] Error:', error);
    $resolve();
  });
```

---

### Bước 2: Gọi trong OnApplicationReady

**Module → Events → OnApplicationReady**:

```
OnApplicationReady
  ├─ InitBuildInfo
  │   ├─ If Success = True
  │   │   ├─ Assign: Session.AppName = InitBuildInfo.AppName
  │   │   ├─ Assign: Session.AppVersion = InitBuildInfo.Version
  │   │   ├─ Assign: Session.BuildCode = InitBuildInfo.BuildCode
  │   │   ├─ Assign: Session.Environment = InitBuildInfo.Environment
  │   │   ├─ Assign: Session.ApiHostname = InitBuildInfo.ApiHostname
  │   │   └─ Message: "App Ready: " + Session.AppName + " v" + Session.AppVersion
  │   └─ Else (Success = False)
  │       ├─ Message: "Build Info Error: " + InitBuildInfo.ErrorMessage
  │       └─ [Optional] Set default values
  └─ Continue app flow
```

---

### Bước 3: Tạo Session Variables

**Module → Data → Client Variables → Session Variables**:

```
Session.AppName (Text) = ""
Session.AppVersion (Text) = ""
Session.BuildCode (Text) = ""
Session.Environment (Text) = ""
Session.ApiHostname (Text) = ""
Session.IsProduction (Boolean) = False
```

---

## 📝 Complete Example

### Example 1: Basic Initialization

**OnApplicationReady Flow**:

```javascript
// Client Action: InitBuildInfo
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    $parameters.Success = true;
    $parameters.AppName = info.appName;
    $parameters.Version = info.versionNumber;
    $parameters.Environment = info.environment;
    $resolve();
  })
  .catch(function(error) {
    $parameters.Success = false;
    $parameters.ErrorMessage = error.message;
    $resolve();
  });
```

**Flow Logic**:
```
OnApplicationReady
  └─ InitBuildInfo
      ├─ Success?
      │   ├─ Yes: Store in Session
      │   └─ No: Use defaults
      └─ Continue to Home
```

---

### Example 2: With Environment Check

**Client Action: InitBuildInfoWithEnv**

```javascript
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    $parameters.Success = true;
    $parameters.AppName = info.appName;
    $parameters.Version = info.versionNumber;
    $parameters.Environment = info.environment;
    $parameters.IsProduction = info.environment === 'production';
    
    // Or use helper
    // $parameters.IsProduction = window.AppBuildInfo.isProduction();
    
    $resolve();
  })
  .catch(function(error) {
    $parameters.Success = false;
    $parameters.ErrorMessage = error.message;
    $resolve();
  });
```

**Flow Logic**:
```
OnApplicationReady
  └─ InitBuildInfoWithEnv
      ├─ Success?
      │   ├─ Store in Session
      │   └─ If IsProduction
      │       ├─ Enable Analytics
      │       ├─ Hide Debug Menu
      │       └─ Set Log Level = Error
      │   └─ Else
      │       ├─ Disable Analytics
      │       ├─ Show Debug Menu
      │       └─ Set Log Level = Debug
      └─ Continue
```

---

### Example 3: With API Configuration

**Client Action: InitBuildInfoWithAPI**

```javascript
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    $parameters.Success = true;
    $parameters.AppName = info.appName;
    $parameters.Version = info.versionNumber;
    $parameters.ApiHostname = info.apiHostname;
    
    // Construct API base URL
    if (info.apiHostname) {
      $parameters.ApiBaseUrl = 'https://' + info.apiHostname + '/api';
    } else {
      $parameters.ApiBaseUrl = '';
    }
    
    $resolve();
  })
  .catch(function(error) {
    $parameters.Success = false;
    $parameters.ApiBaseUrl = '';
    $resolve();
  });
```

**Flow Logic**:
```
OnApplicationReady
  └─ InitBuildInfoWithAPI
      ├─ Success?
      │   ├─ Store API config
      │   ├─ Configure REST endpoints
      │   └─ Set base URL
      └─ Continue
```

---

## 🚀 Advanced Patterns

### Pattern 1: Retry Logic

```javascript
// Client Action: InitBuildInfoWithRetry
var maxRetries = 3;
var retryCount = 0;

function tryInit() {
  window.AppBuildInfo.waitForReady(3000)
    .then(function(info) {
      $parameters.Success = true;
      $parameters.AppName = info.appName;
      $parameters.Version = info.versionNumber;
      $resolve();
    })
    .catch(function(error) {
      retryCount++;
      if (retryCount < maxRetries) {
        console.log('[InitBuildInfo] Retry ' + retryCount + '/' + maxRetries);
        setTimeout(tryInit, 1000); // Retry after 1 second
      } else {
        $parameters.Success = false;
        $parameters.ErrorMessage = 'Failed after ' + maxRetries + ' retries';
        $resolve();
      }
    });
}

tryInit();
```

---

### Pattern 2: Fallback Values

```javascript
// Client Action: InitBuildInfoWithFallback
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    $parameters.Success = true;
    $parameters.AppName = info.appName;
    $parameters.Version = info.versionNumber;
    $resolve();
  })
  .catch(function(error) {
    // Use fallback values
    $parameters.Success = false;
    $parameters.AppName = 'MyApp'; // Fallback name
    $parameters.Version = '1.0.0'; // Fallback version
    $parameters.ErrorMessage = 'Using fallback values';
    
    console.warn('[InitBuildInfo] Using fallbacks:', error);
    $resolve();
  });
```

---

### Pattern 3: Conditional Logic

```javascript
// Client Action: InitBuildInfoConditional
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    $parameters.Success = true;
    $parameters.AppName = info.appName;
    $parameters.Version = info.versionNumber;
    $parameters.Environment = info.environment;
    
    // Set features based on environment
    if (info.environment === 'production') {
      $parameters.EnableAnalytics = true;
      $parameters.ShowDebugMenu = false;
      $parameters.LogLevel = 'error';
    } else if (info.environment === 'staging') {
      $parameters.EnableAnalytics = true;
      $parameters.ShowDebugMenu = true;
      $parameters.LogLevel = 'warn';
    } else { // development
      $parameters.EnableAnalytics = false;
      $parameters.ShowDebugMenu = true;
      $parameters.LogLevel = 'debug';
    }
    
    $resolve();
  })
  .catch(function(error) {
    // Development defaults
    $parameters.Success = false;
    $parameters.EnableAnalytics = false;
    $parameters.ShowDebugMenu = true;
    $parameters.LogLevel = 'debug';
    $resolve();
  });
```

---

## ❌ Troubleshooting

### Issue 1: "AppBuildInfo is not defined"

**Nguyên nhân**: Plugin chưa load

**Giải pháp**:
```javascript
if (typeof window.AppBuildInfo === 'undefined') {
  console.error('AppBuildInfo not available');
  $parameters.Success = false;
  $parameters.ErrorMessage = 'Plugin not loaded';
  $resolve();
  return;
}

window.AppBuildInfo.waitForReady(5000)
  .then(function(info) { /* ... */ })
  .catch(function(error) { /* ... */ });
```

---

### Issue 2: Timeout Error

**Nguyên nhân**: Database không load kịp

**Giải pháp**: Tăng timeout hoặc retry
```javascript
// Tăng timeout lên 10 giây
window.AppBuildInfo.waitForReady(10000)
  .then(function(info) { /* ... */ })
  .catch(function(error) {
    // Retry logic here
  });
```

---

### Issue 3: Event Fire Twice

**Nguyên nhân**: Lắng nghe nhiều lần

**Giải pháp**: Chỉ gọi 1 lần trong OnApplicationReady
```
✅ DO:
OnApplicationReady
  └─ InitBuildInfo (call once)

❌ DON'T:
OnApplicationReady
  ├─ InitBuildInfo
  └─ InitBuildInfo (duplicate!)
```

---

## 📊 Best Practices

### 1. **Always use waitForReady()**
```javascript
// ✅ GOOD
window.AppBuildInfo.waitForReady(5000)
  .then(callback)
  .catch(errorHandler);

// ❌ BAD
var info = window.AppBuildInfo.getData(); // Throws if not ready!
```

### 2. **Set reasonable timeout**
```javascript
// Development: 10 seconds (slower devices)
window.AppBuildInfo.waitForReady(10000)

// Production: 5 seconds (normal)
window.AppBuildInfo.waitForReady(5000)
```

### 3. **Always handle errors**
```javascript
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    // Success path
  })
  .catch(function(error) {
    // Always handle errors!
    console.error('Error:', error);
    // Use fallback or defaults
  });
```

### 4. **Store in Session Variables**
```javascript
// Store once in OnApplicationReady
Session.AppName = info.appName;
Session.Version = info.versionNumber;

// Use anywhere in app
Label.Text = Session.AppName + " v" + Session.Version;
```

### 5. **Log for debugging**
```javascript
window.AppBuildInfo.waitForReady(5000)
  .then(function(info) {
    console.log('[BuildInfo] Loaded:', info);
    // Store and continue
  })
  .catch(function(error) {
    console.error('[BuildInfo] Failed:', error);
    // Fallback
  });
```

---

## 📝 Summary

### Timeline:

```
1. App Start
   ↓
2. Cordova deviceready
   ↓
3. SQLite opens database
   ↓
4. buildInfoReady event fires
   ↓
5. OnApplicationReady (OutSystems) ← Lắng nghe ở đây!
   ↓
6. InitBuildInfo action
   ↓
7. Store in Session
   ↓
8. Show UI
```

### Key Points:

✅ Use `waitForReady()` in OnApplicationReady  
✅ Set timeout 5-10 seconds  
✅ Always handle errors  
✅ Store in Session Variables  
✅ Log for debugging  

❌ Don't use `getData()` directly  
❌ Don't listen in multiple places  
❌ Don't ignore timeout errors  
❌ Don't forget fallback values  

---

**Happy coding with OutSystems! 🚀**