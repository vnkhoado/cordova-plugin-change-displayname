#!/usr/bin/env node

/**
 * UNIFIED HOOK: Customize native colors (splash screen + webview)
 * 
 * Replaces:
 * - customizeSplashScreen.js
 * - forceOverrideSplashColor.js
 * - forceOverrideNativeColors.js
 * - scanAndReplaceColor.js
 * - native-gradient-splash.js
 * - forceMBASSplashColor.js
 * 
 * This is the SINGLE source of truth for color customization.
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
 * Customize Android splash & webview colors
 */
function customizeAndroidColors(root, backgroundColor, webviewBackgroundColor) {
  // 1. Update colors.xml - Force override splash colors
  const colorsPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/colors.xml'
  );
  
  if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf8');
    let updated = false;
    
    if (backgroundColor) {
      // Override splash-related colors
      if (colors.includes('colorPrimary')) {
        colors = colors.replace(
          /<color name="colorPrimary">[^<]*<\/color>/,
          `<color name="colorPrimary">${backgroundColor}</color>`
        );
        console.log(`   ✓ Overrode colorPrimary`);
        updated = true;
      }
      
      if (colors.includes('colorPrimaryDark')) {
        colors = colors.replace(
          /<color name="colorPrimaryDark">[^<]*<\/color>/,
          `<color name="colorPrimaryDark">${backgroundColor}</color>`
        );
        console.log(`   ✓ Overrode colorPrimaryDark`);
        updated = true;
      }
      
      // Add splash_background if not exists
      if (!colors.includes('splash_background')) {
        colors = colors.replace(
          '</resources>',
          `    <color name="splash_background">${backgroundColor}</color>\n</resources>`
        );
        console.log(`   ✓ Added splash_background`);
      } else {
        colors = colors.replace(
          /<color name="splash_background">[^<]*<\/color>/,
          `<color name="splash_background">${backgroundColor}</color>`
        );
        console.log(`   ✓ Updated splash_background`);
      }
      updated = true;
    }
    
    if (webviewBackgroundColor) {
      // Add webview background color
      if (!colors.includes('webview_background')) {
        colors = colors.replace(
          '</resources>',
          `    <color name="webview_background">${webviewBackgroundColor}</color>\n</resources>`
        );
        console.log(`   ✓ Added webview_background`);
      } else {
        colors = colors.replace(
          /<color name="webview_background">[^<]*<\/color>/,
          `<color name="webview_background">${webviewBackgroundColor}</color>`
        );
        console.log(`   ✓ Updated webview_background`);
      }
      updated = true;
    }
    
    if (updated) {
      safeWriteFile(colorsPath, colors);
    }
  }
  
  // 2. Update styles.xml - Force window backgrounds
  const stylesPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/styles.xml'
  );
  
  if (fs.existsSync(stylesPath)) {
    let styles = fs.readFileSync(stylesPath, 'utf8');
    let updated = false;
    
    if (backgroundColor) {
      // Update AppTheme
      const appThemeRegex = /(<style name="AppTheme"[^>]*>)(.*?)(<\/style>)/s;
      const match = styles.match(appThemeRegex);
      
      if (match) {
        let themeContent = match[2];
        
        if (themeContent.includes('android:windowBackground')) {
          themeContent = themeContent.replace(
            /<item name="android:windowBackground">[^<]*<\/item>/,
            `<item name="android:windowBackground">${backgroundColor}</item>`
          );
        } else {
          themeContent = `\n        <item name="android:windowBackground">${backgroundColor}</item>${themeContent}`;
        }
        
        styles = styles.replace(appThemeRegex, `$1${themeContent}$3`);
        console.log(`   ✓ Updated AppTheme windowBackground`);
        updated = true;
      }
      
      // Update AppTheme.Launcher if exists
      if (styles.includes('AppTheme.Launcher')) {
        const launcherRegex = /(<style name="AppTheme\.Launcher"[^>]*>)(.*?)(<\/style>)/s;
        const launcherMatch = styles.match(launcherRegex);
        
        if (launcherMatch) {
          let themeContent = launcherMatch[2];
          
          if (themeContent.includes('android:windowBackground')) {
            themeContent = themeContent.replace(
              /<item name="android:windowBackground">[^<]*<\/item>/,
              `<item name="android:windowBackground">${backgroundColor}</item>`
            );
          } else {
            themeContent = `\n        <item name="android:windowBackground">${backgroundColor}</item>${themeContent}`;
          }
          
          styles = styles.replace(launcherRegex, `$1${themeContent}$3`);
          console.log(`   ✓ Updated AppTheme.Launcher windowBackground`);
          updated = true;
        }
      }
    }
    
    if (updated) {
      safeWriteFile(stylesPath, styles);
    }
  }
  
  // 3. Update splash.xml drawable if exists
  const splashXmlPath = path.join(
    root,
    'platforms/android/app/src/main/res/drawable/splash.xml'
  );
  
  if (backgroundColor && fs.existsSync(splashXmlPath)) {
    let splash = fs.readFileSync(splashXmlPath, 'utf8');
    
    if (splash.includes('<solid')) {
      splash = splash.replace(
        /<solid android:color="[^"]*"/g,
        `<solid android:color="${backgroundColor}"`
      );
      safeWriteFile(splashXmlPath, splash);
      console.log(`   ✓ Updated splash.xml drawable`);
    }
  }
  
  if (backgroundColor) {
    console.log(`   ✅ Android splash configured: ${backgroundColor}`);
  }
  if (webviewBackgroundColor) {
    console.log(`   ✅ Android webview configured: ${webviewBackgroundColor}`);
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
      const colorPattern = /<color key="backgroundColor"[^/]*\/>/g;
      
      if (storyboard.match(colorPattern)) {
        storyboard = storyboard.replace(
          colorPattern,
          `<color key="backgroundColor" red="${rgb.r.toFixed(3)}" green="${rgb.g.toFixed(3)}" blue="${rgb.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`
        );
        
        safeWriteFile(storyboardPath, storyboard);
        console.log(`   ✓ Updated LaunchScreen.storyboard`);
      }
    }
    
    console.log(`   ✅ iOS splash configured: ${backgroundColor}`);
  }
  
  if (webviewBackgroundColor) {
    // Update webview background color in plist or code if needed
    console.log(`   ℹ️  iOS webview background color: ${webviewBackgroundColor}`);
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
  console.log('  🎨 CUSTOMIZE COLORS (Splash + Webview)');
  console.log('══════════════════════════════════════════════');
  
  if (splashColor) console.log(`Splash Color: ${splashColor}`);
  if (webviewColor) console.log(`Webview Color: ${webviewColor}`);
  
  for (const platform of platforms) {
    console.log(`\n📱 Processing ${platform}...`);
    
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
