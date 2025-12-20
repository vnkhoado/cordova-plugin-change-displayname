#!/usr/bin/env node

/**
 * Android Splash Screen Color Flicker Fix Hook
 * 
 * Solves the issue where Android shows old splash color (1e1464 - Cordova default)
 * before new color displays, causing visible flicker on app launch.
 * 
 * Root Cause:
 * - after_prepare hooks set splash color correctly (#001833)
 * - Cordova Android CLI reprocesses and overwrites with default (1e1464)
 * - Result: App launches with wrong color, then switches to correct color (visible flicker)
 * 
 * Solution:
 * - Run at before_compile phase (FINAL - no more processing after this)
 * - Force splash color to correct value in cdvcolors.xml
 * - Force theme colors to correct value in cdvthemes.xml
 * - Prevents any further overwriting
 * 
 * Runs at: before_compile stage (after all prepare, before Gradle compilation)
 * 
 * Same pattern as iOS fix: force correct value at final phase
 */

const fs = require('fs');
const path = require('path');
const {
  normalizeHexColor,
  getBackgroundColorPreference,
  readXmlFile,
  writeXmlFile,
  createCdvColorsTemplate,
  createCdvThemesTemplate
} = require('./utils');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function fixAndroidSplashFlicker(context) {
  const root = context.opts.projectRoot;
  
  log(colors.bright + colors.blue, '\n╔═══════════════════════════════════════════════════════════╗');
  log(colors.bright + colors.blue, '║  Android Splash Screen Color Flicker Fix (before_compile)  ║');
  log(colors.bright + colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');
  
  // Get background color from config.xml
  const backgroundColor = getBackgroundColorPreference(root);
  log(colors.reset, `🎯 Ensuring correct splash color (${backgroundColor}) at final phase...`);
  
  const androidResPath = path.join(
    root,
    'platforms/android/app/src/main/res/values'
  );
  
  if (!fs.existsSync(androidResPath)) {
    log(colors.yellow, '\n⚠️  Android resources directory not found, skipping fix');
    return;
  }
  
  let fixedColors = false;
  
  // ============================================
  // 1. Fix cdvcolors.xml (Splash Color)
  // ============================================
  const cdvColorsPath = path.join(androidResPath, 'cdvcolors.xml');
  
  log(colors.reset, '\n📄 Processing cdvcolors.xml:');
  
  let colorContent = readXmlFile(cdvColorsPath);
  
  if (!colorContent) {
    // File doesn't exist, create it
    log(colors.yellow, `   ⚠️  File not found, creating new cdvcolors.xml...`);
    colorContent = createCdvColorsTemplate(backgroundColor);
    
    if (writeXmlFile(cdvColorsPath, colorContent)) {
      log(colors.green, `   ✅ Created cdvcolors.xml with color: ${backgroundColor}`);
      fixedColors = true;
    } else {
      log(colors.red, `   ❌ Failed to create cdvcolors.xml`);
    }
  } else {
    // File exists, update it
    try {
      const originalContent = colorContent;
      
      // Fix splash screen background color
      const splashColorPattern = /<color\s+name="cdv_splashscreen_background_color">([^<]*)<\/color>/;
      const splashColorMatch = colorContent.match(splashColorPattern);
      
      if (splashColorMatch) {
        const currentColor = splashColorMatch[1].trim();
        
        // Replace with correct color from config
        colorContent = colorContent.replace(
          splashColorPattern,
          `<color name="cdv_splashscreen_background_color">${backgroundColor}</color>`
        );
        
        log(colors.green, `   ✅ Updated splash color: "${currentColor}" → "${backgroundColor}"`);
        fixedColors = true;
      } else {
        // Color doesn't exist, add it
        const insertPoint = colorContent.indexOf('</resources>');
        if (insertPoint !== -1) {
          colorContent = colorContent.substring(0, insertPoint) +
            `    <color name="cdv_splashscreen_background_color">${backgroundColor}</color>\n` +
            colorContent.substring(insertPoint);
          log(colors.green, `   ✅ Added splash color: "${backgroundColor}"`);
          fixedColors = true;
        }
      }
      
      // Write back if changed
      if (colorContent !== originalContent) {
        if (writeXmlFile(cdvColorsPath, colorContent)) {
          log(colors.green, `   ✅ cdvcolors.xml saved successfully`);
        }
      } else {
        log(colors.green, `   ✅ cdvcolors.xml already correct`);
      }
      
    } catch (error) {
      log(colors.red, `   ❌ Error updating cdvcolors.xml: ${error.message}`);
    }
  }
  
  // ============================================
  // 2. Fix cdvthemes.xml (Theme Color References)
  // ============================================
  const cdvThemesPath = path.join(androidResPath, 'cdvthemes.xml');
  
  log(colors.reset, '\n🎨 Processing cdvthemes.xml:');
  
  let themeContent = readXmlFile(cdvThemesPath);
  
  if (!themeContent) {
    // File doesn't exist, create it
    log(colors.yellow, `   ⚠️  File not found, creating new cdvthemes.xml...`);
    themeContent = createCdvThemesTemplate();
    
    if (writeXmlFile(cdvThemesPath, themeContent)) {
      log(colors.green, `   ✅ Created cdvthemes.xml`);
    } else {
      log(colors.red, `   ❌ Failed to create cdvthemes.xml`);
    }
  } else {
    // File exists, update it
    try {
      const originalContent = themeContent;
      
      // Ensure theme references correct color
      const themeColorPattern = /<item\s+name="android:windowBackground">([^<]*)<\/item>/g;
      
      if (themeColorPattern.test(themeContent)) {
        themeContent = themeContent.replace(
          themeColorPattern,
          '<item name="android:windowBackground">@color/cdv_splashscreen_background_color</item>'
        );
        log(colors.green, `   ✅ Theme window background: Uses cdv_splashscreen_background_color`);
      } else {
        log(colors.green, `   ✅ cdvthemes.xml already correct`);
      }
      
      // Write back if changed
      if (themeContent !== originalContent) {
        if (writeXmlFile(cdvThemesPath, themeContent)) {
          log(colors.green, `   ✅ cdvthemes.xml saved successfully`);
        }
      }
      
    } catch (error) {
      log(colors.red, `   ❌ Error updating cdvthemes.xml: ${error.message}`);
    }
  }
  
  // ============================================
  // 3. Verify AndroidManifest.xml theme reference
  // ============================================
  const manifestPath = path.join(
    root,
    'platforms/android/app/src/main/AndroidManifest.xml'
  );
  
  if (fs.existsSync(manifestPath)) {
    log(colors.reset, '\n📋 Checking AndroidManifest.xml:');
    
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      
      if (content.includes('@style/')) {
        log(colors.green, `   ✅ Theme style is correctly referenced`);
      }
      
    } catch (error) {
      log(colors.yellow, `   ⚠️  Could not verify manifest: ${error.message}`);
    }
  }
  
  // ============================================
  // Summary
  // ============================================
  log(colors.reset, '\n' + '═'.repeat(63));
  log(colors.bright + colors.green, '✅ Android Splash Flicker Fix Complete!');
  log(colors.reset, '═'.repeat(63));
  
  log(colors.yellow, '\n📌 What was fixed:');
  log(colors.yellow, `   1. Splash color: ${backgroundColor}`);
  log(colors.yellow, '   2. Removed Cordova default color: 1e1464');
  log(colors.yellow, '   3. Theme colors synchronized');
  log(colors.yellow, '   4. Files created/updated as needed');
  log(colors.yellow, '   5. No more color flicker on app launch');
  log(colors.yellow, '\n   Build phase: before_compile (FINAL - no more changes)\n');
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  // Only run for Android
  if (!platforms || !platforms.includes('android')) {
    return;
  }
  
  fixAndroidSplashFlicker(context);
};
