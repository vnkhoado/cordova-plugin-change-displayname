# CDN Assets Replacement Guide

## 🎨 Replace CSS, JS, and other assets from CDN

This plugin can automatically replace local CSS, JavaScript, and other text-based assets with versions from your CDN during build time.

---

## 📋 Use Cases

- **Dynamic theming**: Replace CSS files to apply different themes per build
- **A/B testing**: Swap JavaScript files for different feature sets
- **Localization**: Replace content files for different languages
- **Environment configs**: Different config files for dev/staging/prod
- **Hot fixes**: Update files without rebuilding the entire app

---

## 🚀 Quick Start

### Step 1: Create a JSON config file on your CDN

Create a file like `https://your-cdn.com/assets-config.json`:

```json
[
    {
        "localFile": "www/css/app.css",
        "cdn": "https://your-cdn.com/themes/blue/app.css"
    },
    {
        "localFile": "www/js/config.js",
        "cdn": "https://your-cdn.com/config/production.js"
    },
    {
        "localFile": "www/css/custom.css",
        "cdn": "https://your-cdn.com/custom-theme.css"
    }
]
```

### Step 2: Add to OutSystems Extensibility Configurations

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ASSETS",
                "value": "https://your-cdn.com/assets-config.json"
            },
            {
                "name": "CDN_ICON",
                "value": "https://your-cdn.com/icon-1024.png"
            },
            {
                "name": "APP_NAME",
                "value": "My App"
            }
        ]
    },
    "plugin": {
        "url": "https://github.com/vnkhoado/cordova-plugin-change-app-info.git"
    }
}
```

### Step 3: Build your app

The plugin will automatically:
1. Download your JSON config
2. Download each asset from CDN
3. Replace local files with CDN versions
4. Create `.bak` backups of originals

---

## 📁 JSON Config Format

### Required fields:

```json
[
    {
        "localFile": "www/css/styles.css",  // Path relative to www folder
        "cdn": "https://cdn.com/styles.css"  // Full URL to replacement file
    }
]
```

### Alternative field names (all supported):

```json
[
    {
        "localFile": "www/app.css",   // or "local" or "file"
        "cdn": "https://..."          // or "url" or "cdnUrl"
    }
]
```

---

## 🎯 Common Examples

### Replace Theme CSS

**JSON config:**
```json
[
    {
        "localFile": "www/css/theme.css",
        "cdn": "https://cdn.example.com/themes/dark/theme.css"
    },
    {
        "localFile": "www/css/colors.css",
        "cdn": "https://cdn.example.com/themes/dark/colors.css"
    }
]
```

**CSS files on CDN:**

`dark/theme.css`:
```css
body {
    background-color: #1a1a1a;
    color: #ffffff;
}

.header {
    background-color: #2d2d2d;
}
```

`dark/colors.css`:
```css
:root {
    --primary: #3498db;
    --secondary: #2ecc71;
    --background: #1a1a1a;
    --text: #ffffff;
}
```

### Replace JavaScript Config

**JSON config:**
```json
[
    {
        "localFile": "www/js/config.js",
        "cdn": "https://cdn.example.com/config/production.js"
    }
]
```

**Production config.js:**
```javascript
window.APP_CONFIG = {
    apiUrl: 'https://api.production.com',
    environment: 'production',
    debug: false,
    analytics: {
        enabled: true,
        trackingId: 'UA-12345678-1'
    }
};
```

### Replace Multiple Files

```json
[
    {
        "localFile": "www/css/app.css",
        "cdn": "https://cdn.example.com/v2/app.css"
    },
    {
        "localFile": "www/css/mobile.css",
        "cdn": "https://cdn.example.com/v2/mobile.css"
    },
    {
        "localFile": "www/js/main.js",
        "cdn": "https://cdn.example.com/v2/main.js"
    },
    {
        "localFile": "www/locales/en.json",
        "cdn": "https://cdn.example.com/locales/en-US.json"
    }
]
```

---

## 🔀 Different Configs for Different Environments

### Development Build

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ASSETS",
                "value": "https://cdn.example.com/config/dev-assets.json"
            },
            {
                "name": "APP_NAME",
                "value": "MyApp DEV"
            }
        ]
    }
}
```

**dev-assets.json:**
```json
[
    {
        "localFile": "www/js/config.js",
        "cdn": "https://cdn.example.com/config/dev.js"
    },
    {
        "localFile": "www/css/theme.css",
        "cdn": "https://cdn.example.com/themes/debug/theme.css"
    }
]
```

### Production Build

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ASSETS",
                "value": "https://cdn.example.com/config/prod-assets.json"
            },
            {
                "name": "APP_NAME",
                "value": "MyApp"
            }
        ]
    }
}
```

**prod-assets.json:**
```json
[
    {
        "localFile": "www/js/config.js",
        "cdn": "https://cdn.example.com/config/production.js"
    },
    {
        "localFile": "www/css/theme.css",
        "cdn": "https://cdn.example.com/themes/production/theme.css"
    }
]
```

---

## ✅ Verification

### In Build Logs

You should see:

```
══════════════════════════════════
   CDN REPLACE ASSETS HOOK      
══════════════════════════════════
ℹ Found CDN_ASSETS in config.xml
🔗 CDN Config URL: https://your-cdn.com/assets-config.json
✔ Config downloaded (1234 bytes)
📄 Found 3 asset(s) to replace

📱 Processing platform: android

➡ Replacing: platforms/android/app/src/main/assets/www/css/app.css
   📥 Downloading from: https://your-cdn.com/themes/blue/app.css
   💾 Backup created: app.css.bak
   ✅ File replaced: app.css (5678 bytes)

➡ Replacing: platforms/android/app/src/main/assets/www/js/config.js
   📥 Downloading from: https://your-cdn.com/config/production.js
   💾 Backup created: config.js.bak
   ✅ File replaced: config.js (2345 bytes)

android: 2 replaced, 0 errors

══════════════════════════════════
✅ CDN replacement completed!
══════════════════════════════════
```

### Check Replaced Files

After build, check:
- `platforms/android/app/src/main/assets/www/css/app.css` - should contain CDN content
- `platforms/android/app/src/main/assets/www/css/app.css.bak` - original backup

---

## 🐛 Troubleshooting

### Issue: "CDN_ASSETS preference not found"

**Solution:** Add the preference to config.xml:

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ASSETS",
                "value": "https://your-cdn.com/assets-config.json"
            }
        ]
    }
}
```

### Issue: "Cannot download CDN config"

**Check:**
1. URL is accessible from build server
2. Returns HTTP 200
3. Content-Type is `application/json` or `text/plain`
4. CORS is enabled if needed

**Test:**
```bash
curl -v https://your-cdn.com/assets-config.json
```

### Issue: "File not found"

**Common causes:**
- Wrong path in `localFile` (must start with `www/`)
- File doesn't exist in your project
- Typo in filename

**Correct paths:**
- ✅ `"www/css/app.css"`
- ✅ `"www/js/config.js"`
- ❌ `"css/app.css"` (missing www/)
- ❌ `"/www/css/app.css"` (don't start with /)

### Issue: Files revert after build

**Cause:** Backups are being restored

**Solution:** Delete `.bak` files if you want fresh replacements:
```bash
find platforms -name "*.bak" -delete
```

---

## 💡 Best Practices

### 1. Version your JSON configs

```
https://cdn.example.com/config/v1/assets.json
https://cdn.example.com/config/v2/assets.json
```

### 2. Use semantic URLs

```
https://cdn.example.com/themes/dark/styles.css
https://cdn.example.com/themes/light/styles.css
https://cdn.example.com/config/dev.js
https://cdn.example.com/config/prod.js
```

### 3. Add cache busting

```json
{
    "localFile": "www/css/app.css",
    "cdn": "https://cdn.example.com/app.css?v=1.2.3"
}
```

### 4. Keep JSON config small

Only replace files that actually need to change. Don't list every file.

### 5. Test on staging first

Always test CDN replacements on a staging build before production.

---

## 🔒 Security Notes

1. **HTTPS only**: Always use HTTPS URLs for CDN assets
2. **Verify sources**: Only use trusted CDN domains
3. **Content review**: Review CDN content before deploying
4. **Backup originals**: Plugin creates `.bak` files automatically
5. **Access control**: Secure your JSON config file

---

## 📊 File Types Supported

- ✅ CSS (`.css`)
- ✅ JavaScript (`.js`)
- ✅ JSON (`.json`)
- ✅ HTML (`.html`)
- ✅ XML (`.xml`)
- ✅ Text (`.txt`)
- ✅ Any text-based file

**Note:** Binary files (images, fonts, etc.) are NOT supported. Use `CDN_ICON` for icons.

---

## 🎓 Advanced Example: Multi-tenant App

### Tenant A (Blue Theme)

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ASSETS",
                "value": "https://cdn.example.com/tenants/tenant-a/assets.json"
            },
            {
                "name": "CDN_ICON",
                "value": "https://cdn.example.com/tenants/tenant-a/icon.png"
            },
            {
                "name": "APP_NAME",
                "value": "Company A App"
            },
            {
                "name": "PACKAGE_NAME",
                "value": "com.example.companya"
            }
        ]
    }
}
```

**tenant-a/assets.json:**
```json
[
    {
        "localFile": "www/css/theme.css",
        "cdn": "https://cdn.example.com/tenants/tenant-a/theme.css"
    },
    {
        "localFile": "www/js/config.js",
        "cdn": "https://cdn.example.com/tenants/tenant-a/config.js"
    }
]
```

### Tenant B (Green Theme)

```json
{
    "preferences": {
        "global": [
            {
                "name": "CDN_ASSETS",
                "value": "https://cdn.example.com/tenants/tenant-b/assets.json"
            },
            {
                "name": "CDN_ICON",
                "value": "https://cdn.example.com/tenants/tenant-b/icon.png"
            },
            {
                "name": "APP_NAME",
                "value": "Company B App"
            },
            {
                "name": "PACKAGE_NAME",
                "value": "com.example.companyb"
            }
        ]
    }
}
```

---

## 📚 Related Features

- [CDN Icon Replacement](OUTSYSTEMS_FIX.md#-icon-requirements) - Replace app icons from CDN
- [App Info Changes](README.md) - Change package name, version, etc.

---

## 🆘 Support

- **Issues**: [Report a bug](https://github.com/vnkhoado/cordova-plugin-change-app-info/issues)
- **Docs**: [Full documentation](https://github.com/vnkhoado/cordova-plugin-change-app-info)

---

## ✨ Quick Checklist

- [ ] JSON config file uploaded to CDN
- [ ] JSON is valid array format
- [ ] All CDN URLs are accessible
- [ ] `localFile` paths start with `www/`
- [ ] `CDN_ASSETS` preference added to config
- [ ] Tested download URLs with curl
- [ ] Using HTTPS for all CDN URLs
- [ ] Build logs show successful replacements

**Ready to build with CDN assets!** 🚀