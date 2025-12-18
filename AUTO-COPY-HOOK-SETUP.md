# ⚡ Auto-Copy Hook - Setup Guide

## 🎯 Tự Động Copy Files Mỗi Lần Prepare

Plugin tự động chạy hook mỗi lần `cordova prepare`:

---

## ⚡ QUICK START (2 MIN)

**IMPORTANT:** Requires **plugin version 2.9.12+**

### Step 1: Update Plugin to Latest

```bash
# Remove old version
cordova plugin remove cordova-plugin-change-app-info

# Install latest (2.9.12+)
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git

# Verify version
cordova plugin list
# Should show: cordova-plugin-change-app-info 2.9.12+ "change app info"
```

### Step 2: Add Script Tag to index.html

Add this to `www/index.html` in `<head>`:

```html
<script src="js/config-loader-mobile.js"></script>
```

### Step 3: Build

```bash
cordova clean
cordova build android --verbose
```

### Step 4: Verify Files Copied

```bash
ls -la www/build-config.json
ls -la www/js/config-loader.js
```

**Done!** ✅ Files now auto-copy every build!

---

## 📋 Version Requirements

| Version | Has Auto-Copy | Status |
|---------|-----------------|--------|
| 2.9.10 | ❌ NO | Old |
| 2.9.11 | ❌ NO | Old |
| **2.9.12+** | ✅ **YES** | **Required** |

**⚠️ Must be 2.9.12 or higher for auto-copy to work!**

---

## ✅ How Auto-Copy Hook Works

When you run `cordova build android`:

1. Before prepare phase: Hook auto-copies files to www/
2. Cordova prepare runs: Files already in www/ so not deleted
3. Files get packed into APK/IPA
4. App loads with build config available

**Result:** No more deleted files! ✅

---

## 🎉 Summary

**Auto-Copy is ENABLED automatically in plugin 2.9.12+**

Just:
1. Update plugin
2. Add script tag to index.html  
3. Build

**Done!** Files preserved forever! 🚀