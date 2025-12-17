# 🎨 Gradient Splash Screen Implementation

## Quick Start

### 1. Update config.xml

```xml
<preference name="SPLASH_GRADIENT" value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
```

### 2. Build

```bash
cordova clean
cordova build android ios
```

**That's it!** Gradient splash screens are generated automatically.

---

## Supported Gradient Formats

```javascript
// Basic linear gradient
"linear-gradient(45deg, #FF0000, #0000FF)"

// With positions
"linear-gradient(90deg, #FF0000 0%, #00FF00 50%, #0000FF 100%)"

// Different angle units
"linear-gradient(0.5turn, #FF0000, #0000FF)"     // 180 degrees
"linear-gradient(100grad, #FF0000, #0000FF)"     // 90 degrees
"linear-gradient(1.57rad, #FF0000, #0000FF)"     // ~90 degrees
```

---

## How It Works

### Build Time

1. **Parse gradient** - Extract colors, angle, and positions
2. **Generate images** - Create splash images with gradient using sharp/jimp
3. **Generate Android drawable** - Create XML gradient drawable
4. **Generate iOS splash** - Create PNG images for all device sizes

### Platforms

**Android**:
- Generates `res/drawable/splash_gradient_bg.xml`
- Gradient applied via XML drawable
- Works on all Android versions

**iOS**:
- Generates 5 splash images (1x, 2x, 3x, iPad, iPad-2x)
- One gradient, multiple resolutions
- Proper Contents.json with all device types

---

## Configuration

### Global (both platforms)

```xml
<!-- config.xml -->
<preference name="SPLASH_GRADIENT" value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
```

### Platform-specific

```xml
<platform name="android">
  <preference name="SPLASH_GRADIENT" value="linear-gradient(45deg, #001833, #004390)" />
</platform>

<platform name="ios">
  <preference name="SPLASH_GRADIENT" value="linear-gradient(45deg, #001833, #004390)" />
</platform>
```

### With color stops

```xml
<preference name="SPLASH_GRADIENT" 
  value="linear-gradient(90deg, #FF0000 0%, #00FF00 50%, #0000FF 100%)" />
```

---

## Dependencies

**Optional** (auto-installs):
- `sharp` - Fast image generation (recommended)
- `jimp` - Fallback image processor

At least one must be available for image generation.

---

## Testing

### Android

```bash
# Check generated drawable
find platforms/android -name "splash_gradient_bg.xml"

# View content
cat platforms/android/app/src/main/res/drawable/splash_gradient_bg.xml
```

### iOS

```bash
# Check generated images
find platforms/ios -path "*/splash.imageset/*" -name "*.png" | wc -l
# Should be 5+ images

# Check Contents.json
cat platforms/ios/*/Images.xcassets/splash.imageset/Contents.json
```

---

## Troubleshooting

### Splash not showing gradient

**Android**:
```bash
# Verify drawable exists and has gradient
cat platforms/android/app/src/main/res/drawable/splash_gradient_bg.xml

# Should contain <gradient> element
```

**iOS**:
```bash
# Verify all 5 images generated
ls platforms/ios/*/Images.xcassets/splash.imageset/splash_*.png | wc -l
# Should show: 5
```

### Image processor error

**If sharp/jimp not installed**:
```bash
npm install sharp
# OR
npm install jimp

cordova clean
cordova build
```

### White splash instead of gradient

**Solutions**:
1. Clean rebuild: `cordova clean && cordova build`
2. Uninstall old app completely
3. Install fresh build
4. Check `SPLASH_GRADIENT` preference is set

---

## Files Generated

### Android

```
platforms/android/app/src/main/res/
├── drawable/
│   └── splash_gradient_bg.xml       ← Gradient drawable
└── layout/
    └── splash.xml                   ← Uses above drawable
```

### iOS

```
platforms/ios/[AppName]/Images.xcassets/splash.imageset/
├── splash.png                       ← 1x
├── splash@2x.png                    ← 2x (iPhone)
├── splash@3x.png                    ← 3x (iPhone)
├── splash-ipad.png                  ← 1x (iPad)
├── splash-ipad@2x.png               ← 2x (iPad)
└── Contents.json                    ← Metadata
```

---

## Advanced Examples

### Example 1: Blue to Purple

```xml
<preference name="SPLASH_GRADIENT" value="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" />
```

### Example 2: Dark Blue Gradient

```xml
<preference name="SPLASH_GRADIENT" value="linear-gradient(64.28deg, #001833 0%, #004390 100%)" />
```

### Example 3: Multi-color Gradient

```xml
<preference name="SPLASH_GRADIENT" 
  value="linear-gradient(90deg, #FF0000 0%, #00FF00 50%, #0000FF 100%)" />
```

### Example 4: Horizontal Gradient

```xml
<preference name="SPLASH_GRADIENT" value="linear-gradient(to right, #FF6B6B, #4ECDC4)" />
```

---

## See Also

- **README.md** - Main documentation with all features
- **SPLASH_SCREEN_TROUBLESHOOTING.md** - Splash screen issues
- **WEBVIEW_COLOR_TROUBLESHOOTING.md** - Webview background color

---

**For complete documentation, see README.md**
