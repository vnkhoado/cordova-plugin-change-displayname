# 🎨 Gradient Splash Screen Implementation Guide

## Quick Start

### Step 1: Install Dependencies
```bash
npm install sharp jimp --save-optional
```

### Step 2: Update Hook
Add to `hooks/updateSplashScreen.js`:

```javascript
const GradientParser = require('./gradient-parser');
const AndroidGradientGenerator = require('./android/gradient-generator');
const IOSGradientGenerator = require('./ios/gradient-generator');

// Inside your hook function, add:
const splashGradient = preferences.SPLASH_GRADIENT;

if (splashGradient && GradientParser.isValid(splashGradient)) {
  if (platforms.includes('android')) {
    const androidGen = new AndroidGradientGenerator(projectRoot);
    androidGen.generateDrawable(splashGradient);
    androidGen.generateSplashLayout(splashGradient);
  }
  
  if (platforms.includes('ios')) {
    const iosGen = new IOSGradientGenerator(projectRoot);
    await iosGen.generateSplashImages(splashGradient);
    iosGen.generateContentsJson();
  }
}
```

### Step 3: Configure
In `config.xml`:

```xml
<platform name="android">
  <preference name="SPLASH_GRADIENT" 
    value="linear-gradient(64.28deg, #001833 0%, #004390 100%)" />
</platform>

<platform name="ios">
  <preference name="SPLASH_GRADIENT" 
    value="linear-gradient(64.28deg, #001833 0%, #004390 100%)" />
</platform>
```

### Step 4: Build
```bash
cordova build android ios
```

## Supported Gradient Formats

### Syntax
```
linear-gradient(angle, color1 position1, color2 position2, ...)
```

### Examples
```javascript
// Basic
"linear-gradient(45deg, #FF0000, #0000FF)"

// With positions
"linear-gradient(90deg, #FF0000 0%, #00FF00 50%, #0000FF 100%)"

// Different units
"linear-gradient(0.5turn, #FF0000, #0000FF)"   // 180 degrees
"linear-gradient(100grad, #FF0000, #0000FF)"   // 90 degrees
"linear-gradient(1.57rad, #FF0000, #0000FF)"   // ~90 degrees
```

## File Reference

- **gradient-parser.js** - Parse gradient strings
- **android/gradient-generator.js** - Generate Android resources
- **ios/gradient-generator.js** - Generate iOS resources

## Testing

```bash
# Android
rm -rf platforms/android
cordova platform add android
cordova build android
ls platforms/android/app/src/main/res/values/splash_gradient*.xml

# iOS
rm -rf platforms/ios
cordova platform add ios
cordova build ios
ls platforms/ios/*/Images.xcassets/splash.imageset/splash_*.png
```

## Troubleshooting

### Issue: Splash still white
```bash
# Clean build
rm -rf platforms/
cordova platform add android ios
cordova build
```

### Issue: Sharp not found
```bash
npm install sharp --force
# Or use jimp
npm install jimp
```

## More Information

See other documentation files for:
- **ROOT_CAUSE_ANALYSIS.md** - Technical details
- **QUICK_START.md** - Quick reference
- **README_SOLUTION.md** - Complete overview