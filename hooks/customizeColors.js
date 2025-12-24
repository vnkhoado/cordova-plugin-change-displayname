#!/usr/bin/env node

/**
 * UNIFIED HOOK: Customize native colors (splash screen + webview)
 * 
 * Smart approach:
 * - Replaces ONLY named splash colors (splash_background, etc.)
 * - Does NOT touch other colors by hex value
 * - Preserves status bar, accent, and other app colors
 */

const fs = require('fs');
const path = require('path');
const { 
  getConfigParser, 
  normalizeHexColor, 
  validateHexColor,
  hexToRgb,
  safeWriteFile 
} = require('./utils');

/**
 * Known splash background color names - ONLY these will be replaced
 * Updated to include Cordova's default color names (cdv_*)
 */
const SPLASH_COLOR_NAMES = [
  'splash_background',
  'splashColor',
  'splash_color',
  'splashscreen_color',
  'splashBackground',
  // Cordova default color names
  'cdv_background_color',
  'cdv_splashscreen_background',
  'cdv_splashscreen_background_color'
];

/**
 * Customize Android splash & webview colors
 * ONLY touches named splash colors, NOT hex values
 */
function customizeAndroidColors(root, backgroundColor, webviewBackgroundColor) {
  // 1. Update colors.xml - ONLY named splash colors
  const colorsPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/colors.xml'
  );
  
  if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf8');
    let updated = false;
    
    if (backgroundColor) {
      // Replace ONLY splash-named colors
      for (const colorName of SPLASH_COLOR_NAMES) {
        const regex = new RegExp(
          `<color name="${colorName}">[^<]*</color>`,
          'i'
        );
        
        if (colors.match(regex)) {
          colors = colors.replace(
            regex,
            `<color name="${colorName}">${backgroundColor}</color>`
          );
          console.log(`   ✓ Updated ${colorName}`);
          updated = true;
        }
      }
      
      // Add splash_background if not exists
      if (!colors.includes('splash_background')) {
        colors = colors.replace(
          '</resources>',
          `    <color name="splash_background">${backgroundColor}</color>\n</resources>`
        );
        console.log(`   ✓ Added splash_background`);
        updated = true;
      }
      
      // Fix cdv_splashscreen_background to use direct color instead of reference
      if (colors.includes('cdv_splashscreen_background')) {
        colors = colors.replace(
          /<color name="cdv_splashscreen_background">@color\/cdv_background_color<\/color>/i,
          `<color name="cdv_splashscreen_background">${backgroundColor}</color>`
        );
        console.log(`   ✓ Fixed cdv_splashscreen_background reference`);
        updated = true;
      }
    }
    
    if (webviewBackgroundColor) {
      // Add or update webview_background
      if (!colors.includes('webview_background')) {
        colors = colors.replace(
          '</resources>',
          `    <color name="webview_background">${webviewBackgroundColor}</color>\n</resources>`
        );
        console.log(`   ✓ Added webview_background`);
      } else {
        colors = colors.replace(
          /<color name="webview_background">[^<]*<\/color>/i,
          `<color name="webview_background">${webviewBackgroundColor}</color>`
        );
        console.log(`   ✓ Updated webview_background`);
      }
      updated = true;
    }
    
    if (updated) {
      safeWriteFile(colorsPath, colors);
      console.log(`   📝 Saved colors.xml`);
    }
  }
  
  // 2. Update styles.xml - Use @color references
  const stylesPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/styles.xml'
  );
  
  if (fs.existsSync(stylesPath) && backgroundColor) {
    let styles = fs.readFileSync(stylesPath, 'utf8');
    let updated = false;
    
    // Update AppTheme.Launcher to use @color/splash_background
    if (styles.includes('AppTheme.Launcher')) {
      const launcherRegex = /(<style name="AppTheme\.Launcher"[^>]*>)(.*?)(<\/style>)/s;
      const launcherMatch = styles.match(launcherRegex);
      
      if (launcherMatch) {
        let themeContent = launcherMatch[2];
        
        if (themeContent.includes('android:windowBackground')) {
          // Replace with color reference
          themeContent = themeContent.replace(
            /<item name="android:windowBackground">[^<]*<\/item>/,
            `<item name="android:windowBackground">@color/splash_background</item>`
          );
          styles = styles.replace(launcherRegex, `$1${themeContent}$3`);
          console.log(`   ✓ Updated AppTheme.Launcher to use @color/splash_background`);
          updated = true;
        }
      }
    }
    
    if (updated) {
      safeWriteFile(stylesPath, styles);
      console.log(`   📝 Saved styles.xml`);
    }
  }
  
  // 3. Update splash.xml drawable
  const splashXmlPath = path.join(
    root,
    'platforms/android/app/src/main/res/drawable/splash.xml'
  );
  
  if (backgroundColor && fs.existsSync(splashXmlPath)) {
    let splash = fs.readFileSync(splashXmlPath, 'utf8');
    let updated = false;
    
    // Replace solid colors with color reference
    if (splash.includes('<solid')) {
      splash = splash.replace(
        /<solid android:color="[^"]*"/g,
        `<solid android:color="@color/splash_background"`
      );
      console.log(`   ✓ Updated splash.xml to use @color/splash_background`);
      updated = true;
    }
    
    if (updated) {
      safeWriteFile(splashXmlPath, splash);
      console.log(`   📝 Saved splash.xml`);
    }
  }
  
  if (backgroundColor) {
    console.log(`   ✅ Android splash: ${backgroundColor}`);
  }
  if (webviewBackgroundColor) {
    console.log(`   ✅ Android webview: ${webviewBackgroundColor}`);
  }
}

/**
 * Customize iOS splash & webview colors
 */
function customizeIOSColors(root, config, backgroundColor, webviewBackgroundColor) {
  const projectName = config.name();
  const platformPath = path.join(root, 'platforms/ios');
  
  if (!fs.existsSync(platformPath)) {
    console.log('⚠ iOS platform folder not found');
    return;
  }
  
  // iOS LaunchScreen.storyboard
  if (backgroundColor) {
    const storyboardPath = path.join(
      platformPath,
      projectName,
      'Resources/LaunchScreen.storyboard'
    );
    
    if (fs.existsSync(storyboardPath)) {
      const rgb = hexToRgb(backgroundColor);
      let storyboard = fs.readFileSync(storyboardPath, 'utf8');
      
      // Update ALL backgroundColor in storyboard
      const colorPattern = /<color key="backgroundColor"[^\/]*\/>/g;
      const matches = storyboard.match(colorPattern) || [];
      
      if (matches.length > 0) {
        storyboard = storyboard.replace(
          colorPattern,
          `<color key="backgroundColor" red="${rgb.r.toFixed(3)}" green="${rgb.g.toFixed(3)}" blue="${rgb.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`
        );
        
        safeWriteFile(storyboardPath, storyboard);
        console.log(`   ✓ Updated ${matches.length} backgroundColor in LaunchScreen.storyboard`);
      }
      
      console.log(`   📝 Saved LaunchScreen.storyboard`);
    }
    
    console.log(`   ✅ iOS splash: ${backgroundColor}`);
  }
  
  if (webviewBackgroundColor) {
    console.log(`   ℹ️  iOS webview: ${webviewBackgroundColor}`);
  }
}

/**
 * Main hook
 */
module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Get preferences
  let splashColor = config.getPreference('SplashScreenBackgroundColor') ||
                    config.getPreference('AndroidWindowSplashScreenBackground') ||
                    config.getPreference('SPLASH_BACKGROUND_COLOR');
                    
  let webviewColor = config.getPreference('WEBVIEW_BACKGROUND_COLOR') ||
                     config.getPreference('WebviewBackgroundColor');
  
  // Validate colors
  if (splashColor && !validateHexColor(splashColor)) {
    console.error('\n❌ Invalid splash color format. Use hex color (e.g., #FFFFFF)');
    return;
  }
  
  if (webviewColor && !validateHexColor(webviewColor)) {
    console.error('\n❌ Invalid webview color format. Use hex color (e.g., #FFFFFF)');
    return;
  }
  
  // Normalize colors
  if (splashColor) {
    splashColor = normalizeHexColor(splashColor);
  }
  if (webviewColor) {
    webviewColor = normalizeHexColor(webviewColor);
  }
  
  // Skip if no colors configured
  if (!splashColor && !webviewColor) {
    console.log('\n🎨 No custom colors configured, skipping');
    return;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🎨 CUSTOMIZE COLORS (Named Colors Only)');
  console.log('══════════════════════════════════════════════');
  console.log('⚠️  ONLY replaces named splash colors');
  console.log('⚠️  Includes Cordova cdv_* color names');
  console.log('⚠️  Does NOT replace by hex value');
  console.log('⚠️  Status bar and other colors preserved');
  
  if (splashColor) console.log(`Splash: ${splashColor}`);
  if (webviewColor) console.log(`Webview: ${webviewColor}`);
  
  for (const platform of platforms) {
    console.log(`\n📱 ${platform}...`);
    
    try {
      if (platform === 'android') {
        customizeAndroidColors(root, splashColor, webviewColor);
      } else if (platform === 'ios') {
        customizeIOSColors(root, config, splashColor, webviewColor);
      }
    } catch (error) {
      console.error(`\n❌ Error:`, error.message);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✓ Color customization completed!');
  console.log('══════════════════════════════════════════════\n');
};
