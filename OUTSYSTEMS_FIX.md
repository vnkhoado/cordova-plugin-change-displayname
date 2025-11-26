# Fix for OutSystems MABS Issues

## Problems Fixed

### 1. ❌ CDN_ICON not found
```
⚠ CDN_ICON not found for ios.
   Checked: preferences (CDN_ICON, cdnIcon), plugin variables, environment variables
   Skipping icon generation.
```

### 2. ❌ Duplicate app_name in Android
```
ERROR: Resource and asset merger: Found item String/app_name more than one time
```

## Solution

### What was changed:

1. **plugin.xml** - Removed `<config-file>` entries that conflicted with hooks
2. **changeAppInfo.js** - Now reads from root `config.xml` once
3. **generateIcons.js** - Now reads from root `config.xml` once
4. **Duplicate prevention** - Removes ALL old `app_name` entries before adding new one

### How to use with OutSystems MABS:

#### Step 1: Update your Extensibility Configuration JSON

Add this to your app's Extensibility Configurations:

```json
{
    "preferences": {
        "global": [
            {
                "name": "PACKAGE_NAME",
                "value": "com.yourcompany.yourapp"
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
    },
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git"
    }
}
```

**IMPORTANT**: Use `preferences.global` NOT `plugin.variables`!

#### Step 2: Icon Requirements

Your CDN icon must be:
- **Format**: PNG
- **Size**: 1024x1024px minimum
- **Ratio**: 1:1 (square)
- **Background**: Solid color (not transparent for iOS)
- **URL**: Public with CORS enabled

Test your icon URL:
```bash
curl -I https://your-cdn.com/icon-1024.png
```

Should return:
```
HTTP/1.1 200 OK
Content-Type: image/png
Access-Control-Allow-Origin: *
```

#### Step 3: Clean Build

If you've built before with the old version:

1. **Remove the plugin** from Extensibility Configurations
2. **Generate a new build** (this removes old plugin)
3. **Add the plugin back** with new URL
4. **Generate final build**

## Verification

In your build logs, you should now see:

### ✅ For CDN_ICON:
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
  ...
✅ Generated 5 Android icon sizes
```

### ✅ For app_name:
```
📱 Processing platform: android
📦 Package: com.yourcompany.yourapp
📝 App Name: Your App Name
🔢 Version: 1.0.0 (1)
✅ Android app name updated (duplicates removed)
```

## Common Issues

### Issue: Still getting "CDN_ICON not found"

**Check:**
1. Are you using `preferences.global` in JSON? (NOT `plugin.variables`)
2. Is `CDN_ICON` spelled correctly? (case-sensitive)
3. Does your icon URL work in browser?

### Issue: Still getting duplicate app_name

**Solution:**
1. Make sure you're using the latest commit
2. Remove and re-add plugin
3. The new version removes ALL duplicates automatically

### Issue: Icons not showing on iOS

**Solution:**
1. Delete app from device completely
2. Rebuild with `cordova clean ios`
3. Install fresh build
4. iOS caches aggressively - must delete app first

## Version History

- **v2.0.1** (2025-11-26) - Fixed OutSystems MABS issues
  - Read config from root config.xml
  - Remove duplicate app_name entries
  - Better error messages

## Support

- GitHub Issues: https://github.com/vnkhoado/cordova-plugin-change-app-info/issues
- Latest version: https://github.com/vnkhoado/cordova-plugin-change-app-info

## Example Working Configuration

```json
{
    "preferences": {
        "global": [
            {
                "name": "PACKAGE_NAME",
                "value": "vn.vnkhoado.myapp"
            },
            {
                "name": "APP_NAME",
                "value": "MyApp Production"
            },
            {
                "name": "VERSION_NUMBER",
                "value": "2.1.0"
            },
            {
                "name": "VERSION_CODE",
                "value": "21"
            },
            {
                "name": "CDN_ICON",
                "value": "https://cdn.example.com/apps/myapp/icon-1024.png"
            }
        ]
    },
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git"
    },
    "resources": {
        "android": {
            "splash": [
                {
                    "src": "https://cdn.example.com/apps/myapp/splash.png",
                    "density": "land-xxxhdpi"
                }
            ]
        }
    }
}
```