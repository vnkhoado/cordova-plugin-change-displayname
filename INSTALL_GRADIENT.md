# 📦 Installation Guide - Gradient Splash Screen

## Quick Installation

### Option 1: Automatic Installation (Recommended)

```bash
npm run setup:gradient
```

This automatically installs:
- ✅ sharp (image processing - recommended)
- ✅ jimp (fallback processor)

### Option 2: Manual Installation

```bash
# Install both (recommended)
npm install sharp jimp --save-optional

# Or install separately
npm install sharp --save-optional   # Recommended
npm install jimp --save-optional    # Fallback
```

## After Installation

### Step 1: Configure config.xml

Add to your Android platform:
```xml
<platform name="android">
  <preference name="SPLASH_GRADIENT" 
    value="linear-gradient(64.28deg, #001833 0%, #004390 100%)" />
</platform>
```

Add to your iOS platform:
```xml
<platform name="ios">
  <preference name="SPLASH_GRADIENT" 
    value="linear-gradient(64.28deg, #001833 0%, #004390 100%)" />
</platform>
```

### Step 2: Build

```bash
cordova build android ios
```

The gradient splash screen will be automatically generated!

## Verification

### Check Android Resources
```bash
ls platforms/android/app/src/main/res/values/splash_gradient_bg.xml
cat platforms/android/app/src/main/res/values/splash_gradient_bg.xml
```

### Check iOS Resources
```bash
ls platforms/ios/*/Images.xcassets/splash.imageset/splash_*.png
cat platforms/ios/*/Images.xcassets/splash.imageset/Contents.json
```

## Dependencies Explained

### sharp (Recommended)
- Fast image processing using native bindings
- High quality output
- Requires compilation
- Better performance

### jimp (Fallback)
- Pure JavaScript image processor
- No compilation needed
- Slower but works everywhere
- Used if sharp fails

**Both are optional.** If neither is available, falls back to solid color.

## Troubleshooting

### Issue: npm ERR! code ERESOLVE

**Solution:**
```bash
# Try with --force flag
npm install sharp jimp --save-optional --force

# Or use npm 6
npm install sharp jimp --save-optional --legacy-peer-deps
```

### Issue: sharp build fails

**Solution:**
```bash
# Use prebuilt binaries
npm install sharp --build-from-source=false --save-optional

# Or use jimp instead
npm install jimp --save-optional
```

### Issue: Permission denied

**Solution:**
```bash
# Run with sudo (not recommended)
sudo npm install sharp jimp --save-optional

# Or fix npm permissions
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

## Check Installation

```bash
# Check if dependencies are installed
ls node_modules | grep -E '(sharp|jimp)'

# Or check package-lock.json
grep -E '(sharp|jimp)' package-lock.json
```

## What Gets Installed

### package.json Updated
```json
{
  "optionalDependencies": {
    "sharp": "^0.33.0",
    "jimp": "^0.22.0"
  }
}
```

### Scripts Added
```json
{
  "scripts": {
    "setup:gradient": "node scripts/install-gradient-deps.js"
  }
}
```

## Next Steps

1. ✅ Install dependencies: `npm run setup:gradient`
2. ✅ Configure config.xml with SPLASH_GRADIENT
3. ✅ Build: `cordova build android ios`
4. ✅ Test on devices
5. ✅ Enjoy gradient splash screens! 🎨

## Node.js Requirements

- Node.js 14.0.0 or higher
- npm 6.0.0 or higher

## Support

If you encounter issues:
1. Check troubleshooting section above
2. Check build logs: `cordova build -d`
3. Open an issue on GitHub

---

**Ready? Run:**
```bash
npm run setup:gradient
```
