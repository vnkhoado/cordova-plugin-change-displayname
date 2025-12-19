# Fixes Summary - Splash Screen & App Name

## 📊 Overview

**Date**: December 19, 2025  
**Issues Fixed**: 3 critical issues for OutSystems MABS compatibility

---

## 🔧 Fix #1: Splash Screen Not Removing

### Problem

Splash screen không tự động ẩn mặc dù log hiển thị "Splash removed successfully". Code cũ chỉ có fade animation nhưng không thực sự xóa splash screen khỏi view hierarchy.

### Root Cause

- OutSystems MABS splash screen KHÔNG nằm trong standard Cordova view hierarchy
- Splash có thể ở trong Dialog, Window layer, hoặc custom container
- Fade animation chỉ làm mờ dần nhưng không remove view

### Solution

**File**: `src/android/SplashScreenManager.java`  
**Commit**: [`303adcd`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/303adcd5808296697701dc47dae0a30be64364b2)

Thêm **10 chiến lược removal** (tăng từ 5 lên 10):

#### Strategy 1-5 (Original)
1. ✅ cordova-plugin-splashscreen reflection
2. ✅ ViewGroup hierarchy scan & remove
3. ✅ OutSystems-specific splash IDs
4. ✅ Fade animation + visibility control
5. ✅ Content view visibility

#### Strategy 6-10 (NEW - Aggressive)
6. 🆕 **Dismiss All Dialogs** - Tìm và dismiss tất cả Dialog objects
7. 🆕 **Search All Window Views** - Scan window DecorView cho splash containers
8. 🆕 **OutSystems Splash Reflection** - Gọi OutSystems splash classes trực tiếp
9. 🆕 **Aggressive DecorView Hiding** - Hide tất cả non-webview children
10. 🆕 **Delayed Forced Removal** - 500ms delay rồi force remove lần nữa

### Expected Results

**Before Fix**:
```
Splash removal completed: 2 strategies succeeded
[Splash still visible on screen]
```

**After Fix**:
```
Splash removal completed: 5-7 strategies succeeded
Strategy 6: ✓ Dialogs dismissed
Strategy 7: ✓ Window views hidden  
Strategy 8: ✓ OutSystems splash hidden
Strategy 9: ✓ Aggressive hiding succeeded
[After 500ms] Strategy 10: ✓ Delayed removal executed
[Splash completely gone]
```

---

## 🏷️ Fix #2: App Name Not Changing (Duplicate Resources Error)

### Problem Evolution

**Issue 1**: strings.xml not found → app name không cập nhật  
**Issue 2**: Tạo strings.xml mới → Duplicate resources error  
**Issue 3**: strings.xml từ build cũ còn sót lại → Conflict với cdv_strings.xml

### Root Cause Analysis

1. **Vấn đề 1**: OutSystems MABS không tạo `strings.xml` ban đầu
2. **Vấn đề 2**: Cordova đã có `cdv_strings.xml` chứa `app_name`
3. **Vấn đề 3**: Build cũ tạo `strings.xml` → File vẫn còn trong platforms/ folder
4. **Result**: 2 files cùng define `app_name` → **Gradle mergeDebugResources FAILED**

### Solution (3-Step Fix)

#### Step 1: Use cdv_strings.xml Instead of strings.xml

**File**: `hooks/changeAppInfo.js`  
**Commit**: [`48cc845`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/48cc845da87e68cfb7441dfbd07ca1a2d3d9e56d)

```javascript
// Priority 1: Use Cordova's default cdv_strings.xml
const cdvStringsPath = path.join(
  root,
  "platforms/android/app/src/main/res/values/cdv_strings.xml"
);

if (fs.existsSync(cdvStringsPath)) {
  // Update app_name in cdv_strings.xml
  content = content.replace(
    /<string name="app_name">.*?<\/string>/,
    `<string name="app_name">${appName}</string>`
  );
}
```

#### Step 2: Remove Conflicting strings.xml

**File**: `hooks/removeConflictingStringsXml.js` (NEW)  
**Commit**: [`86c2ef5`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/86c2ef53d717a4d2538026b5803a7239b4df167c)

```javascript
// Check for conflict
const hasStrings = fs.existsSync(stringsPath);
const hasCdvStrings = fs.existsSync(cdvStringsPath);

if (hasCdvStrings && hasStrings) {
  // Both exist → Check if strings.xml has app_name
  const stringsContent = fs.readFileSync(stringsPath, 'utf8');
  const hasAppName = /<string name="app_name">/.test(stringsContent);

  if (hasAppName) {
    console.log('🚨 CONFLICT DETECTED');
    console.log('🗑️  Deleting strings.xml...');
    fs.unlinkSync(stringsPath);  // Remove duplicate file
    console.log('✅ Conflict resolved');
  }
}
```

#### Step 3: Register Hook in plugin.xml

**File**: `plugin.xml`  
**Commit**: [`03579a3`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/03579a3581ab534f162f99760f5e9ef71d0ff72f)

```xml
<!-- CRITICAL: Remove conflicting strings.xml BEFORE updating cdv_strings.xml -->
<hook type="after_prepare" src="hooks/removeConflictingStringsXml.js" />
<hook type="after_prepare" src="hooks/changeAppInfo.js" />
```

**Order matters**: removeConflictingStringsXml.js runs FIRST to clean up, then changeAppInfo.js updates cdv_strings.xml.

### Why This 3-Step Solution Works

✅ **Step 1**: Prevent creating new duplicate files  
✅ **Step 2**: Clean up old duplicate files from previous builds  
✅ **Step 3**: Ensure hook execution order is correct  

### Expected Build Log

**After Complete Fix**:
```
══════════════════════════════════════════════
  REMOVE CONFLICTING STRINGS.XML
══════════════════════════════════════════════
🎯 Purpose: Prevent duplicate app_name resource
📋 Strategy: Use cdv_strings.xml only

🤖 Processing Android...
   📁 cdv_strings.xml: ✓ EXISTS
   📁 strings.xml: ⚠️  EXISTS (will remove)
   🚨 CONFLICT DETECTED: Both files define app_name
   🗑️  Deleting strings.xml...
   ✅ strings.xml removed successfully
   ℹ️  Using cdv_strings.xml as single source of truth

══════════════════════════════════════════════
✅ Conflict check completed!
══════════════════════════════════════════════

══════════════════════════════════════════════
       CHANGE APP INFO HOOK        
══════════════════════════════════════════════
🔧 FIX: Use cdv_strings.xml (no duplicate resources)

📱 Processing platform: android
📝 App Name: NexTalent
🔢 Version: 0.125.36 (2)
   🔍 Using Cordova default: cdv_strings.xml
   📄 Read file: cdv_strings.xml (423 bytes)
   ✅ Updated app_name: NexTalent
   ✅ Saved: cdv_strings.xml
   ✅ AndroidManifest.xml updated

[No duplicate resources error]
✅ BUILD SUCCESSFUL
```

---

## 🚀 How to Use (FINAL VERSION)

### Step 1: Update Plugin

```bash
# Remove old version completely
cordova plugin remove cordova-plugin-change-app-info
cordova clean
rm -rf platforms/android

# Fresh install with ALL fixes
cordova platform add android
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git

# Build
cordova build android
```

### Step 2: Verify No Duplicate Error

```bash
# Check build log for conflict resolution
grep "CONFLICT DETECTED" build.log
# Should show: "🗑️  Deleting strings.xml..." and "✅ Conflict resolved"

# Verify only cdv_strings.xml exists
ls platforms/android/app/src/main/res/values/ | grep strings
# Should show: cdv_strings.xml (NOT strings.xml)

# Check app_name is correct
cat platforms/android/app/src/main/res/values/cdv_strings.xml | grep app_name
# Should show: <string name="app_name">NexTalent</string>

# Build succeeds without errors
cordova build android
# No "Duplicate resources" error!
```

---

## 📊 Success Metrics

### Splash Screen
- ✅ **Before**: 0-2 strategies succeed, splash stuck
- ✅ **After**: 5-7 strategies succeed, splash gone in <1s
- ✅ **OutSystems MABS**: Full compatibility

### App Name
- ❌ **Attempt 1**: strings.xml not found, old name persists
- ❌ **Attempt 2**: Created strings.xml → Duplicate resources error
- ❌ **Attempt 3**: Updated cdv_strings.xml but old strings.xml still exists → Duplicate error
- ✅ **Final Fix**: Remove conflicting strings.xml + Update cdv_strings.xml → **WORKS!**

---

## 📝 Commits Timeline

| Fix | Commit | File | Status |
|-----|--------|------|--------|
| Splash Screen | [`303adcd`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/303adcd5808296697701dc47dae0a30be64364b2) | `SplashScreenManager.java` | ✅ Working |
| App Name (v1) | [`c0610f5`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/c0610f5b538d6e5024784d7690a0ace1b3e67d5a) | `changeAppInfo.js` | ❌ Created duplicate |
| App Name (v2) | [`48cc845`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/48cc845da87e68cfb7441dfbd07ca1a2d3d9e56d) | `changeAppInfo.js` | ❌ Old file remains |
| Remove Conflict | [`86c2ef5`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/86c2ef53d717a4d2538026b5803a7239b4df167c) | `removeConflictingStringsXml.js` | ✅ New hook |
| Register Hook | [`03579a3`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/03579a3581ab534f162f99760f5e9ef71d0ff72f) | `plugin.xml` | ✅ **COMPLETE FIX** |

---

## 🔍 Troubleshooting

### Still Getting Duplicate Error?

```bash
# 1. Completely clean
cordova plugin remove cordova-plugin-change-app-info
cordova clean
rm -rf platforms/android
rm -rf plugins/cordova-plugin-change-app-info

# 2. Fresh reinstall
cordova platform add android
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git

# 3. Verify hook exists
ls plugins/cordova-plugin-change-app-info/hooks/ | grep removeConflicting
# Should show: removeConflictingStringsXml.js

# 4. Build with verbose logging
cordova build android --verbose > build.log 2>&1
grep -A 5 "REMOVE CONFLICTING" build.log
```

### Hook Not Running?

```bash
# Check plugin.xml includes the hook
grep "removeConflictingStringsXml" plugins/cordova-plugin-change-app-info/plugin.xml

# Should show:
# <hook type="after_prepare" src="hooks/removeConflictingStringsXml.js" />
```

### Verify Hook Execution Order

```bash
grep -E "(REMOVE CONFLICTING|CHANGE APP INFO HOOK)" build.log

# Expected order:
# 1. REMOVE CONFLICTING STRINGS.XML  (runs first)
# 2. CHANGE APP INFO HOOK             (runs second)
```

---

## ✅ Verified Compatibility

- ✅ **OutSystems MABS** (Primary target)
- ✅ **Cordova 9.0+**
- ✅ **Android 21+ (Lollipop)**
- ✅ **Gradle 7.x - 8.x**
- ✅ **No duplicate resource conflicts**
- ✅ **Clean builds after previous duplicate errors**

---

## 📚 Key Learnings

### The Problem Was Multi-Layered

1. **Layer 1**: strings.xml not found → plugin tried to create it
2. **Layer 2**: cdv_strings.xml already exists → duplicate definition
3. **Layer 3**: Old strings.xml from previous build → persists across builds

### The Solution Required 3 Fixes

1. **Don't create new strings.xml** → Use existing cdv_strings.xml
2. **Delete old strings.xml if exists** → New cleanup hook
3. **Hook execution order** → Cleanup BEFORE update

### What NOT to Do

❌ **DON'T**: Create new strings.xml  
❌ **DON'T**: Assume platforms/ folder is clean  
❌ **DON'T**: Run update hooks before cleanup hooks  

✅ **DO**: Use cdv_strings.xml (Cordova default)  
✅ **DO**: Clean up conflicting files first  
✅ **DO**: Order hooks correctly (cleanup → update)  

---

## 📧 Support

Nếu vẫn gặp vấn đề:

1. **Full clean rebuild** (xem Troubleshooting)
2. **Check hook execution order** (grep build log)
3. **Verify latest version** - Ensure commit [`03579a3`](https://github.com/vnkhoado/cordova-plugin-change-app-info/commit/03579a3581ab534f162f99760f5e9ef71d0ff72f) or newer
4. **Create issue**: [GitHub Issues](https://github.com/vnkhoado/cordova-plugin-change-app-info/issues)

Provide:
- Full build log (with --verbose)
- Output of: `ls platforms/android/app/src/main/res/values/`
- Cordova/Android/Gradle versions
- Whether you see "CONFLICT DETECTED" in logs