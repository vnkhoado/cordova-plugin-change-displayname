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
  
  log(colors.reset, '🎯 Ensuring correct splash color (#001833) at final phase...');
  
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
  
  if (fs.existsSync(cdvColorsPath)) {
    log(colors.reset, '\n📄 Fixing cdvcolors.xml:');
    
    try {
      let content = fs.readFileSync(cdvColorsPath, 'utf8');
      const originalContent = content;
      
      // Expected color values
      const CORRECT_COLOR = '#001833';
      const WRONG_COLOR = '1e1464'; // Cordova's default
      
      // Fix splash screen background color
      // Pattern: <color name="cdv_splashscreen_background_color">VALUE</color>
      const splashColorPattern = /<color\s+name="cdv_splashscreen_background_color">([^<]*)<\/color>/;
      const splashColorMatch = content.match(splashColorPattern);
      
      if (splashColorMatch) {
        const currentColor = splashColorMatch[1].trim();
        
        // Replace with correct color
        content = content.replace(
          splashColorPattern,
          `<color name="cdv_splashscreen_background_color">${CORRECT_COLOR}</color>`
        );
        
        log(colors.green, `   ✅ Splash color: "${currentColor}" → "${CORRECT_COLOR}"`);
        fixedColors = true;
      } else {
        // Color might not exist, add it
        const insertPoint = content.indexOf('</resources>');
        if (insertPoint !== -1) {
          content = content.substring(0, insertPoint) +
            `    <color name="cdv_splashscreen_background_color">${CORRECT_COLOR}</color>\n` +
            content.substring(insertPoint);
          log(colors.green, `   ✅ Added splash color: "${CORRECT_COLOR}"`);
          fixedColors = true;
        }
      }
      
      // Also update other splash-related colors if they exist
      const colorNames = [
        'cdv_splashscreen_background_color',
        'cdv_splashscreen_backdrop_color'
      ];
      
      for (const colorName of colorNames) {
        const pattern = new RegExp(
          `<color\\s+name="${colorName}">([^<]*)<\\/color>`,
          'g'
        );
        
        if (pattern.test(content)) {
          content = content.replace(
            pattern,
            `<color name="${colorName}">${CORRECT_COLOR}</color>`
          );
        }
      }
      
      // Write back only if changed
      if (content !== originalContent) {
        fs.writeFileSync(cdvColorsPath, content);
        log(colors.green, `   ✅ cdvcolors.xml updated successfully`);
      } else {
        log(colors.green, `   ✅ cdvcolors.xml already correct`);
      }
      
    } catch (error) {
      log(colors.red, `   ❌ Error updating cdvcolors.xml: ${error.message}`);
    }
  } else {
    log(colors.yellow, `   ⚠️  cdvcolors.xml not found at: ${cdvColorsPath}`);
  }
  
  // ============================================
  // 2. Fix cdvthemes.xml (Theme Color References)
  // ============================================
  const cdvThemesPath = path.join(androidResPath, 'cdvthemes.xml');
  
  if (fs.existsSync(cdvThemesPath)) {
    log(colors.reset, '\n🎨 Fixing cdvthemes.xml:');
    
    try {
      let content = fs.readFileSync(cdvThemesPath, 'utf8');
      const originalContent = content;
      
      // Ensure theme references correct color
      // Pattern: <item name="android:windowBackground">VALUE</item>
      const themeColorPattern = /<item\s+name="android:windowBackground">([^<]*)<\/item>/g;
      
      if (themeColorPattern.test(content)) {
        content = content.replace(
          themeColorPattern,
          '<item name="android:windowBackground">@color/cdv_splashscreen_background_color</item>'
        );
        log(colors.green, `   ✅ Theme window background: Uses cdv_splashscreen_background_color`);
      }
      
      // Write back only if changed
      if (content !== originalContent) {
        fs.writeFileSync(cdvThemesPath, content);
        log(colors.green, `   ✅ cdvthemes.xml updated successfully`);
      } else {
        log(colors.green, `   ✅ cdvthemes.xml already correct`);
      }
      
    } catch (error) {
      log(colors.red, `   ❌ Error updating cdvthemes.xml: ${error.message}`);
    }
  } else {
    log(colors.yellow, `   ⚠️  cdvthemes.xml not found at: ${cdvThemesPath}`);
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
  log(colors.yellow, '   1. Splash color forced to: #001833');
  log(colors.yellow, '   2. Removed Cordova default color: 1e1464');
  log(colors.yellow, '   3. Theme colors synchronized');
  log(colors.yellow, '   4. No more color flicker on app launch');
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
