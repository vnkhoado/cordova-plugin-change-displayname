/**
 * Android Gradient Generator
 * Creates Android drawable resources from CSS gradient
 */

const fs = require('fs');
const path = require('path');
const GradientParser = require('../gradient-parser');

class AndroidGradientGenerator {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.resPath = path.join(projectRoot, 'platforms/android/app/src/main/res');
  }

  /**
   * Generate Android drawable XML from gradient
   */
  generateDrawable(gradientStr, filename = 'splash_gradient') {
    const parsed = GradientParser.parse(gradientStr);
    
    if (!parsed || !parsed.colors || parsed.colors.length < 2) {
      console.warn('Invalid gradient, falling back to solid color');
      return this.generateSolidColor(
        GradientParser.getDominantColor(gradientStr) || '#000000'
      );
    }

    const drawableXml = this.createGradientXml(parsed);
    return this.saveDrawable(drawableXml, filename);
  }

  /**
   * Create gradient XML drawable
   */
  createGradientXml(parsed) {
    const { angle, colors } = parsed;
    
    // Android gradient angles
    // 0deg = bottom-to-top, 90deg = left-to-right
    // Convert CSS angle to Android angle
    const androidAngle = this.convertAngleToAndroid(angle);
    
    let colorElements = colors
      .map((stop, index) => {
        const position = Math.round(stop.position * 100);
        return `        <item android:color="${stop.color}" android:offset="${stop.position}"/>`;
      })
      .join('\n');

    // Ensure at least start and end colors
    if (colors.length < 2) {
      colorElements = `        <item android:color="${colors[0].color}" android:offset="0.0"/>
        <item android:color="${colors[colors.length - 1].color}" android:offset="1.0"/>`;
    }

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <gradient
        android:type="linear"
        android:angle="${androidAngle}"
        android:startColor="${colors[0].color}"
        android:endColor="${colors[colors.length - 1].color}"
        android:interpolator="@android:interpolator/accelerate_decelerate"
        android:dither="true" />
</shape>`;

    return xml;
  }

  /**
   * Convert CSS gradient angle to Android angle
   * CSS: 0deg = top-to-bottom, 90deg = left-to-right
   * Android: 0deg = bottom-to-top, 90deg = left-to-right
   */
  convertAngleToAndroid(cssAngle) {
    // Android only supports: 0, 45, 90, 135, 180, 225, 270, 315
    const validAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    
    // Convert CSS angle (0 = top-to-bottom) to Android angle (0 = bottom-to-top)
    let androidAngle = (360 - cssAngle) % 360;
    
    // Round to nearest valid angle
    let nearest = validAngles[0];
    let minDiff = Math.abs(androidAngle - validAngles[0]);
    
    for (let angle of validAngles) {
      const diff = Math.abs(androidAngle - angle);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = angle;
      }
    }

    return nearest;
  }

  /**
   * Generate solid color drawable (fallback)
   */
  generateSolidColor(colorHex) {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="${colorHex}" />
</shape>`;

    return xml;
  }

  /**
   * Save drawable to values directory
   */
  saveDrawable(xml, filename) {
    try {
      const valuesDir = path.join(this.resPath, 'values');
      
      if (!fs.existsSync(valuesDir)) {
        fs.mkdirSync(valuesDir, { recursive: true });
      }

      const filePath = path.join(valuesDir, `${filename}.xml`);
      fs.writeFileSync(filePath, xml, 'utf8');
      
      console.log(`✓ Generated Android drawable: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error saving drawable:', error);
      throw error;
    }
  }

  /**
   * Generate splash screen layout using gradient
   */
  generateSplashLayout(gradientStr) {
    // Generate the gradient drawable first
    this.generateDrawable(gradientStr, 'splash_background');

    // Create layout that references the gradient
    const layoutXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/splash_background"
    android:gravity="center">
    
    <!-- Your splash content here -->
    <ImageView
        android:id="@+id/splash_logo"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:src="@drawable/ic_launcher_foreground" />
    
</LinearLayout>`;

    try {
      const layoutDir = path.join(this.resPath, 'layout');
      if (!fs.existsSync(layoutDir)) {
        fs.mkdirSync(layoutDir, { recursive: true });
      }

      const filePath = path.join(layoutDir, 'activity_splash.xml');
      fs.writeFileSync(filePath, layoutXml, 'utf8');
      
      console.log(`✓ Generated splash layout: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error saving layout:', error);
      throw error;
    }
  }

  /**
   * Update AndroidManifest.xml with splash activity theme
   */
  updateManifestWithGradient(gradientStr) {
    try {
      const manifestPath = path.join(
        this.projectRoot,
        'platforms/android/app/src/main/AndroidManifest.xml'
      );

      let manifest = fs.readFileSync(manifestPath, 'utf8');

      // Add splash theme if not exists
      const themeStyle = `
    <style name="SplashTheme" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_background</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:windowFullscreen">true</item>
    </style>`;

      // Insert theme in application tag
      manifest = manifest.replace(
        /(<application[^>]*>)/,
        `$1\n${themeStyle}`
      );

      fs.writeFileSync(manifestPath, manifest, 'utf8');
      console.log('✓ Updated AndroidManifest.xml with splash theme');
    } catch (error) {
      console.error('Error updating manifest:', error);
    }
  }
}

module.exports = AndroidGradientGenerator;