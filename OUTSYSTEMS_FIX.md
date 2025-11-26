# Fix for OutSystems MABS Issues

## ✅ FIXED - Version 2.0.2

### Problems that were fixed:

1. ❌ **CDN_ICON not found**
2. ❌ **Duplicate app_name in Android**  
3. ❌ **Plugin variables are missing**

---

## 🚀 How to Use with OutSystems MABS

### Step 1: Extensibility Configurations

Add this **exact format** to your app's Extensibility Configurations:

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ICON",
                "value": "https://your-cdn.com/icon-1024.png"
            },
            {
                "name": "APP_NAME",
                "value": "Your App Name"
            },
            {
                "name": "PACKAGE_NAME",
                "value": "com.yourcompany.app"
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
    },
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git"
    }
}
```

### ⚠️ CRITICAL NOTES:

1. **Use `"preferences": { "global": [...]`** - NOT `plugin.variables`!
2. **No plugin variables needed** - Plugin reads from preferences automatically
3. **All values are OPTIONAL** - Plugin only updates what you provide

---

## 📐 Icon Requirements

Your CDN icon **MUST** meet these specs:

- ✅ **Format**: PNG (not JPG/JPEG)
- ✅ **Size**: 1024x1024px minimum
- ✅ **Ratio**: 1:1 (perfect square)
- ✅ **Background**: Solid color (iOS doesn't accept transparent)
- ✅ **URL**: Publicly accessible with CORS enabled

### Test your icon URL:

```bash
curl -I https://your-cdn.com/icon-1024.png
```

**Expected response:**
```
HTTP/1.1 200 OK
Content-Type: image/png
Access-Control-Allow-Origin: *
Content-Length: 123456
```

---

## 🔄 Clean Build Process

If you've used older versions of this plugin:

### Step 1: Remove old plugin
1. Go to Extensibility Configurations
2. **Delete** the old plugin URL
3. **Generate a build** (this removes old plugin completely)

### Step 2: Add new plugin
1. Add the JSON config above
2. **Generate final build**

---

## ✅ Verification

### In your build logs, look for:

#### For CDN_ICON:
```
══════════════════════════════════
        GENERATE ICONS HOOK        
══════════════════════════════════
ℹ Found CDN_ICON in config.xml: https://your-cdn.com/icon-1024.png
🔗 CDN URL: https://your-cdn.com/icon-1024.png
📥 Downloading icon from: https://your-cdn.com/icon-1024.png
✔ Icon downloaded successfully (123456 bytes)

📱 Generating Android icons...
  ✔ mipmap-mdpi/ic_launcher.png (48x48)
  ✔ mipmap-hdpi/ic_launcher.png (72x72)
  ✔ mipmap-xhdpi/ic_launcher.png (96x96)
  ✔ mipmap-xxhdpi/ic_launcher.png (144x144)
  ✔ mipmap-xxxhdpi/ic_launcher.png (192x192)
✅ Generated 5 Android icon sizes

📱 Generating iOS icons...
  ✔ icon-20@2x.png (40x40)
  ✔ icon-20@3x.png (60x60)
  ... [25 more icons]
✅ Generated 30 iOS icon sizes
✅ Contents.json created
```

#### For app info:
```
══════════════════════════════════
       CHANGE APP INFO HOOK        
══════════════════════════════════

📱 Processing platform: android
📦 Package: com.yourcompany.app
📝 App Name: Your App Name
🔢 Version: 1.0.0 (1)
✅ Android app name updated (duplicates removed)
✅ Android manifest updated
✅ Android build.gradle updated
```

### ❌ Errors you should NOT see anymore:
- ~~`⚠ CDN_ICON not found for ios`~~
- ~~`Resource and asset merger: Found item String/app_name more than one time`~~
- ~~`Couldn't install the Cordova plugin because one or more plugin variables are missing`~~

---

## 🐛 Troubleshooting

### Issue: "CDN_ICON not found"

**Check:**
1. ✅ Using `preferences.global` (NOT `plugin.variables`)
2. ✅ Name is exactly `CDN_ICON` (case-sensitive)
3. ✅ URL works in browser
4. ✅ URL returns `Content-Type: image/png`

**Still not working?**

Add this to verify config is loaded:
```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ICON",
                "value": "https://i.imgur.com/test123.png"
            }
        ]
    }
}
```

### Issue: "Plugin variables are missing"

**Solution:** Make sure you're using **version 2.0.2 or later**

```json
{
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git#565d02c6"
    }
}
```

Or just use:
```json
{
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git"
    }
}
```
(Will use latest commit automatically)

### Issue: Icons not showing on iOS

**iOS caches aggressively:**

1. **Delete app completely** from device
2. Restart device (optional but helps)
3. Install new build
4. **Never** just "reinstall over" - always delete first

### Issue: Still getting duplicate app_name

**This is now impossible** with v2.0.2+

The new code removes ALL duplicates automatically:
```javascript
// Removes ALL existing app_name entries
content = content.replace(/<string name="app_name">.*?<\/string>\s*/g, '');
// Adds exactly ONE new entry
content = content.replace("</resources>", `<string name="app_name">${appName}</string>\n</resources>`);
```

---

## 📋 Minimal Working Example

This is the **absolute minimum** config that works:

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ICON",
                "value": "https://your-cdn.com/icon.png"
            },
            {
                "name": "APP_NAME",
                "value": "MyApp"
            }
        ]
    },
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git"
    }
}
```

**Note:** PACKAGE_NAME, VERSION_NUMBER, VERSION_CODE are optional.

---

## 📦 Complete Production Example

```json
{
    "preferences": {
        "global": [
            {
                "name": "PACKAGE_NAME",
                "value": "vn.company.appname"
            },
            {
                "name": "APP_NAME",
                "value": "MyApp Production"
            },
            {
                "name": "VERSION_NUMBER",
                "value": "2.1.5"
            },
            {
                "name": "VERSION_CODE",
                "value": "215"
            },
            {
                "name": "CDN_ICON",
                "value": "https://cdn.yourcompany.com/apps/myapp/icon-1024.png"
            }
        ],
        "android": [
            {
                "name": "AndroidXEnabled",
                "value": "true"
            }
        ],
        "ios": [
            {
                "name": "deployment-target",
                "value": "13.0"
            }
        ]
    },
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git"
    }
}
```

---

## 📚 Version History

- **v2.0.2** (2025-11-26) ✅ **CURRENT**
  - Fixed "plugin variables are missing" error
  - Removed all `<preference>` declarations from plugin.xml
  - Plugin now reads directly from config.xml
  - No plugin variables required

- **v2.0.1** (2025-11-26)
  - Fixed OutSystems MABS issues
  - Read config from root config.xml
  - Remove duplicate app_name entries
  - Better error messages

---

## 🆘 Support

- **GitHub Issues**: [Report a bug](https://github.com/vnkhoado/cordova-plugin-change-app-info/issues)
- **Latest version**: [View on GitHub](https://github.com/vnkhoado/cordova-plugin-change-app-info)
- **Commits**: [View all commits](https://github.com/vnkhoado/cordova-plugin-change-app-info/commits/master)

---

## ✨ Quick Check Before Build

- [ ] Using `preferences.global` NOT `plugin.variables`
- [ ] CDN_ICON URL works in browser
- [ ] Icon is 1024x1024px PNG
- [ ] Plugin URL points to this repo
- [ ] Old plugin removed if upgrading
- [ ] All preference names are UPPERCASE (CDN_ICON not cdn_icon)

**Ready to build!** 🚀