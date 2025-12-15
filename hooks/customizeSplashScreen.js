#!/usr/bin/env node

/**
 * Hook to customize native splash screen background color
 * Auto-override OutSystems theme colors
 * Works with both SplashScreenBackgroundColor and SPLASH_BACKGROUND_COLOR
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

function customizeAndroidSplash(context, backgroundColor) {
  const root = context.opts.projectRoot;
  
  // 1. Update colors.xml - FORCE override all splash-related colors
  const colorsPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/colors.xml'
  );
  
  if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf8');
    let updated = false;
    
    // Override OutSystems primary colors
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
      updated = true;
    } else {
      colors = colors.replace(
        /<color name="splash_background">[^<]*<\/color>/,
        `<color name="splash_background">${backgroundColor}</color>`
      );
      console.log(`   ✓ Updated splash_background`);
      updated = true;
    }
    
    if (updated) {
      fs.writeFileSync(colorsPath, colors, 'utf8');
    }
  }
  
  // 2. Update styles.xml - Force window background
  const stylesPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/styles.xml'
  );
  
  if (fs.existsSync(stylesPath)) {
    let styles = fs.readFileSync(stylesPath, 'utf8');
    let updated = false;
    
    // Update AppTheme
    if (styles.includes('<style name="AppTheme"')) {
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
    }
    
    // Update AppTheme.Launcher if exists
    if (styles.includes('AppTheme.Launcher')) {
      const launcherRegex = /(<style name="AppTheme\.Launcher"[^>]*>)(.*?)(<\/style>)/s;
      const match = styles.match(launcherRegex);
      
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
        
        styles = styles.replace(launcherRegex, `$1${themeContent}$3`);
        console.log(`   ✓ Updated AppTheme.Launcher windowBackground`);
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(stylesPath, styles, 'utf8');
    }
  }
  
  // 3. Check for splash.xml drawable
  const splashXmlPath = path.join(
    root,
    'platforms/android/app/src/main/res/drawable/splash.xml'
  );
  
  if (fs.existsSync(splashXmlPath)) {
    let splash = fs.readFileSync(splashXmlPath, 'utf8');
    
    if (splash.includes('<solid')) {
      splash = splash.replace(
        /<solid android:color="[^"]*"/g,
        `<solid android:color="${backgroundColor}"`
      );
      fs.writeFileSync(splashXmlPath, splash, 'utf8');
      console.log(`   ✓ Updated splash.xml drawable`);
    }
  }
  
  console.log(`   ✅ Android splash configured: ${backgroundColor}`);
}

function customizeIOSSplash(context, backgroundColor) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  const projectName = config.name();
  
  // iOS LaunchScreen.storyboard
  const storyboardPath = path.join(
    root,
    `platforms/ios/${projectName}/Resources/LaunchScreen.storyboard`
  );
  
  if (fs.existsSync(storyboardPath)) {
    let storyboard = fs.readFileSync(storyboardPath, 'utf8');
    const rgb = hexToRGB(backgroundColor);
    
    // Update ALL backgroundColor in storyboard
    const colorPattern = /<color key="backgroundColor"[^/]*\/>/g;
    
    if (storyboard.match(colorPattern)) {
      storyboard = storyboard.replace(
        colorPattern,
        `<color key="backgroundColor" red="${rgb.r}" green="${rgb.g}" blue="${rgb.b}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`
      );
      
      fs.writeFileSync(storyboardPath, storyboard, 'utf8');
      console.log(`   ✓ Updated LaunchScreen.storyboard`);
    }
  }
  
  console.log(`   ✅ iOS splash configured: ${backgroundColor}`);
}

function hexToRGB(hex) {
  hex = hex.replace('#', '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255.0;
  const g = parseInt(hex.substring(2, 4), 16) / 255.0;
  const b = parseInt(hex.substring(4, 6), 16) / 255.0;
  
  return {
    r: r.toFixed(3),
    g: g.toFixed(3),
    b: b.toFixed(3)
  };
}

function validateHexColor(color) {
  const hexRegex = /^#?([A-Fa-f0-9]{6})$/;
  return hexRegex.test(color);
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Try both preference names (backwards compatible)
  let backgroundColor = config.getPreference("SplashScreenBackgroundColor") ||
                      config.getPreference("AndroidWindowSplashScreenBackground") ||
                      config.getPreference("SPLASH_BACKGROUND_COLOR");
  
  if (!backgroundColor) {
    console.log('\n🎨 Splash color not configured, skipping');
    return;
  }
  
  // Validate color format
  if (!validateHexColor(backgroundColor)) {
    console.error('\n❌ Invalid splash color format. Use hex color (e.g., #FFFFFF)');
    return;
  }
  
  // Ensure # prefix
  if (!backgroundColor.startsWith('#')) {
    backgroundColor = '#' + backgroundColor;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🎨 SPLASH SCREEN COLOR (Auto-Override)');
  console.log('══════════════════════════════════════════════');
  console.log(`Color: ${backgroundColor}`);
  
  for (const platform of platforms) {
    console.log(`\n📱 Processing ${platform}...`);
    
    try {
      if (platform === 'android') {
        customizeAndroidSplash(context, backgroundColor);
      } else if (platform === 'ios') {
        customizeIOSSplash(context, backgroundColor);
      }
    } catch (error) {
      console.error(`\n❌ Error:`, error.message);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Splash customization completed!');
  console.log('══════════════════════════════════════════════\n');
};
