#!/usr/bin/env node

/**
 * Hook để customize màu background của native splash screen
 * Chỉnh sửa splash screen config và theme colors
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

function customizeAndroidSplash(context, backgroundColor) {
  const root = context.opts.projectRoot;
  
  // 1. Update colors.xml
  const colorsPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/colors.xml'
  );
  
  if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf8');
    
    // Check if already has custom splash color
    if (!colors.includes('splash_background')) {
      // Add splash background color
      colors = colors.replace(
        '</resources>',
        `    <color name="splash_background">${backgroundColor}</color>\n</resources>`
      );
      
      fs.writeFileSync(colorsPath, colors, 'utf8');
      console.log(`   ✓ Added splash_background color to colors.xml`);
    } else {
      // Update existing
      colors = colors.replace(
        /<color name="splash_background">[^<]*<\/color>/,
        `<color name="splash_background">${backgroundColor}</color>`
      );
      
      fs.writeFileSync(colorsPath, colors, 'utf8');
      console.log(`   ✓ Updated splash_background color`);
    }
  }
  
  // 2. Update splash screen theme
  const stylesPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/styles.xml'
  );
  
  if (fs.existsSync(stylesPath)) {
    let styles = fs.readFileSync(stylesPath, 'utf8');
    
    // Check if AppTheme.Launcher exists
    if (styles.includes('AppTheme.Launcher')) {
      // Update window background in launcher theme
      if (!styles.includes('<item name="android:windowBackground">@color/splash_background</item>')) {
        styles = styles.replace(
          /(<style name="AppTheme\.Launcher"[^>]*>)/,
          `$1\n        <item name="android:windowBackground">@color/splash_background</item>`
        );
        
        fs.writeFileSync(stylesPath, styles, 'utf8');
        console.log(`   ✓ Added windowBackground to AppTheme.Launcher`);
      }
    }
  }
  
  console.log(`   ✓ Android splash background set to ${backgroundColor}`);
}

function customizeIOSSplash(context, backgroundColor) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  const projectName = config.name();
  
  // iOS splash screen được control bởi LaunchScreen.storyboard
  const storyboardPath = path.join(
    root,
    `platforms/ios/${projectName}/Resources/LaunchScreen.storyboard`
  );
  
  if (fs.existsSync(storyboardPath)) {
    let storyboard = fs.readFileSync(storyboardPath, 'utf8');
    
    // Convert hex to RGB
    const rgb = hexToRGB(backgroundColor);
    
    // Update background color in storyboard
    // Find view with backgroundColor and update it
    const colorPattern = /<color key="backgroundColor"[^>]*\/>/g;
    
    if (storyboard.match(colorPattern)) {
      storyboard = storyboard.replace(
        colorPattern,
        `<color key="backgroundColor" red="${rgb.r}" green="${rgb.g}" blue="${rgb.b}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`
      );
      
      fs.writeFileSync(storyboardPath, storyboard, 'utf8');
      console.log(`   ✓ Updated LaunchScreen.storyboard background`);
    }
  }
  
  console.log(`   ✓ iOS splash background set to ${backgroundColor}`);
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
  
  // Đọc splash background color từ config
  let backgroundColor = config.getPreference('SPLASH_BACKGROUND_COLOR');
  
  if (!backgroundColor) {
    console.log('\n🖼️  SPLASH_BACKGROUND_COLOR not configured, skipping splash customization');
    return;
  }
  
  // Validate color format
  if (!validateHexColor(backgroundColor)) {
    console.error('\n❌ Invalid SPLASH_BACKGROUND_COLOR format. Use hex color (e.g., #FFFFFF)');
    return;
  }
  
  // Ensure # prefix
  if (!backgroundColor.startsWith('#')) {
    backgroundColor = '#' + backgroundColor;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  CUSTOMIZE SPLASH SCREEN BACKGROUND COLOR    ');
  console.log('══════════════════════════════════════════════');
  console.log(`Color: ${backgroundColor}`);
  
  for (const platform of platforms) {
    console.log(`\n🖼️  Processing ${platform}...`);
    
    try {
      if (platform === 'android') {
        customizeAndroidSplash(context, backgroundColor);
      } else if (platform === 'ios') {
        customizeIOSSplash(context, backgroundColor);
      }
    } catch (error) {
      console.error(`\n❌ Error customizing ${platform} splash:`, error.message);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Splash screen customization completed!');
  console.log('══════════════════════════════════════════════\n');
};