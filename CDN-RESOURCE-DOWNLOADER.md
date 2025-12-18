# 📥 CDN Resource Downloader

## Overview

Automatically download CSS and resource files from CDN during build-time and cache them locally in the app.

### Benefits
- ✅ CSS files bundled with app (no CDN dependency at runtime)
- ✅ Faster app load (local files vs. CDN)
- ✅ Works offline (cached resources available)
- ✅ Automatic injection into index.html
- ✅ Fallback to CDN if download fails

---

## Setup (2 Steps)

### Step 1: Update config.xml

Add `CDN_RESOURCE` preference:

```xml
<widget id="com.example.app" version="1.0.0">
    <name>My App</name>
    
    <!-- Download and cache CSS from CDN -->
    <preference name="CDN_RESOURCE" value="https://cdn.example.com/styles.css" />
    
    <!-- Other preferences -->
    <preference name="APP_NAME" value="MyApp" />
    <preference name="CDN_ICON" value="https://cdn.example.com/icon.png" />
</widget>
```

### Step 2: Build

```bash
cordova build android
```

**Done!** CSS file downloaded and cached automatically ✅

---

## How It Works

### Build-Time Process

```
1. cordova build android
   ↓
2. before_prepare phase
   ↓
3. downloadCDNResources hook runs
   ↓
4. Reads CDN_RESOURCE from config.xml
   ↓
5. Downloads CSS file from CDN
   ↓
6. Saves to: www/assets/styles.css
   ↓
7. Injects link tag into index.html:
   <link rel="stylesheet" href="assets/styles.css">
   ↓
8. Files packed into APK/IPA
```

### Runtime

- App loads index.html
- CSS link points to local file (`assets/styles.css`)
- Styles applied instantly (no network call)
- If CSS was unavailable at build-time, falls back to CDN URL

---

## Configuration

### Basic Setup

```xml
<preference name="CDN_RESOURCE" value="https://cdn.example.com/styles.css" />
```

### Multiple Resources

Currently supports one resource per app. For multiple resources, use separate apps or combine CSS files on CDN.

### Supported Formats

- ✅ `.css` files
- ✅ `.min.css` (minified)
- ✅ Any HTTP/HTTPS URL
- ✅ URLs with query parameters (e.g., `?v=1.2.3`)
- ✅ URLs with redirects

---

## Examples

### Example 1: Bootstrap CSS

```xml
<preference name="CDN_RESOURCE" value="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />
```

**Result:**
- Downloaded to: `www/assets/bootstrap.min.css`
- Injected: `<link rel="stylesheet" href="assets/bootstrap.min.css">`

### Example 2: Custom Company CSS

```xml
<preference name="CDN_RESOURCE" value="https://company-cdn.com/branding/corporate-styles.css" />
```

**Result:**
- Downloaded to: `www/assets/corporate-styles.css`
- Injected: `<link rel="stylesheet" href="assets/corporate-styles.css">`

### Example 3: Versioned CSS

```xml
<preference name="CDN_RESOURCE" value="https://cdn.example.com/app-styles-v2.5.1.css" />
```

**Result:**
- Downloaded to: `www/assets/app-styles-v2.5.1.css`
- Injected: `<link rel="stylesheet" href="assets/app-styles-v2.5.1.css">`

---

## Build Output

### Successful Download

```
📥 [CDN-DOWNLOAD] Starting CDN resource download...

✅ Found CDN_RESOURCE: https://cdn.example.com/styles.css
✅ Created: www/assets/
✅ Downloaded: www/assets/styles.css
✅ Injected: <link rel="stylesheet" href="assets/styles.css">
```

### Download Failed (Fallback)

```
📥 [CDN-DOWNLOAD] Starting CDN resource download...

✅ Found CDN_RESOURCE: https://cdn.example.com/styles.css
✅ Created: www/assets/
⚠️  Failed to download from CDN: Connection timeout
📌 Will use CDN URL directly: https://cdn.example.com/styles.css
✅ Injected: <link rel="stylesheet" href="https://cdn.example.com/styles.css">
```

### No CDN_RESOURCE Configured

```
📥 [CDN-DOWNLOAD] Starting CDN resource download...

⚠️  CDN_RESOURCE not configured in config.xml, skipping download
```

---

## Troubleshooting

### CSS File Not Downloaded

**Check:**
1. CDN_RESOURCE is set in config.xml
2. URL is correct and accessible
3. No firewall blocking downloads
4. URL returns valid CSS file

**Test CDN URL:**
```bash
# Test if URL is accessible
curl -I https://cdn.example.com/styles.css

# Should return HTTP 200
```

### Link Tag Not Injected

**Check:**
1. `www/index.html` exists
2. index.html has `<head>` tag
3. index.html has `</head>` closing tag

**Verify:**
```bash
# Check if link tag was added
grep "stylesheet" www/index.html

# Should show:
# <link rel="stylesheet" href="assets/styles.css">
```

### CSS Not Applied in App

**Check:**
1. CSS file exists in assets folder:
   ```bash
   ls -la www/assets/
   ```

2. Link tag is correct in index.html
3. CSS file is packed in APK:
   ```bash
   # Extract APK and check
   unzip -l app-debug.apk | grep assets/styles.css
   ```

### Timeout During Download

Default timeout is 10 seconds. If CDN is slow:

1. Check CDN performance
2. Verify internet connection
3. Try with smaller CSS file

---

## Best Practices

### 1. Use Minified CSS

```xml
<!-- ❌ Avoid: Large file
<preference name="CDN_RESOURCE" value="https://cdn.example.com/styles.css" /> -->

<!-- ✅ Better: Minified
<preference name="CDN_RESOURCE" value="https://cdn.example.com/styles.min.css" /> -->
```

### 2. Version Your CSS

```xml
<!-- Include version in filename for cache busting -->
<preference name="CDN_RESOURCE" value="https://cdn.example.com/styles-v2.1.0.min.css" />
```

### 3. Use CDN with Good Uptime

- Use reliable CDN services (CloudFlare, AWS CloudFront, etc.)
- Ensure CDN is always available during build-time
- Monitor CDN status before building releases

### 4. Test Download Before Release

```bash
# Build and verify CSS was downloaded
cordova build android

# Check assets folder
ls -lh www/assets/

# Verify file size is reasonable
file www/assets/styles.css
```

---

## Advanced Usage

### Conditional CDN Resources

Use different CSS for different environments:

```xml
<!-- config.xml -->
<platform name="android">
    <preference name="CDN_RESOURCE" value="https://cdn.prod.example.com/styles.min.css" />
</platform>

<platform name="ios">
    <preference name="CDN_RESOURCE" value="https://cdn.prod.example.com/styles-ios.min.css" />
</platform>
```

### Combined with Auto-Copy

Works perfectly with auto-copy hook:

```
1. CDN downloader: Downloads CSS
2. Auto-copy: Copies build-config.json
3. Both cached in www/
4. Ready for app to use
```

---

## Related Features

- **Auto-Copy Hook** - Automatically copy build config files
- **CDN Icon** - Download app icon from CDN
- **Build Info** - Inject build metadata into app

---

## Support

For issues or questions:
1. Check troubleshooting section
2. Verify CDN URL is accessible
3. Ensure config.xml syntax is correct
4. Check build log for error messages

---

## Changelog

### v2.9.13
- ✨ Added CDN resource downloader
- ✅ Auto-cache CSS files locally
- ✅ Fallback to CDN if download fails
- ✅ Works for Android & iOS
