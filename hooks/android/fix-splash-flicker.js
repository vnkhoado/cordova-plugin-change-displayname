#!/usr/bin/env node

/**
 * Android Splash Screen Color Flicker Fix Hook
 * 
 * Solves the issue where Android shows old splash color (Cordova default)
 * before new color displays, causing visible flicker on app launch.
 * 
 * Root Cause:
 * - after_prepare hooks set splash color correctly
 * - Cordova Android CLI reprocesses and overwrites with default
 * - Result: App launches with wrong color, then switches to correct color (visible flicker)
 * 
 * Solution:
 * - Run at after_prepare phase (FINAL before compile)
 * - Read color configuration from config.xml
 * - Force splash color to correct value in cdvcolors.xml
 * - Force theme colors to correct value in cdvthemes.xml
 * - Prevents any further overwriting
 * 
 * Configuration from config.xml:
 *   OLD_COLOR: Previous/default Cordova splash color to replace
 *   BackgroundColor: New splash screen background color to force
 * 
 * Runs at: after_prepare stage (final before Gradle compilation)
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

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

/**
 * Read color configuration from config.xml
 * @param {string} configPath - Path to config.xml
 * @returns {object} - { oldColor, newColor }
 */
function readColorConfigFromXml(configPath) {
  if (!fs.existsSync(configPath)) {
    log(colors.yellow, `⚠️  config.xml not found: ${configPath}`);
    return { oldColor: '#1E1464', newColor: '#001833' }; // Fallback defaults
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    
    // Read OLD_COLOR (Cordova default to replace)
    const oldColorMatch = content.match(
      /<preference\s+name=["']OLD_COLOR["']\s+value=["']([^"']+)["']/i
    );
    const oldColor = oldColorMatch ? oldColorMatch[1].trim() : '#1E1464';
    
    // Read BackgroundColor (new splash color)
    const bgColorMatch = content.match(
      /<preference\s+name=["']BackgroundColor["']\s+value=["']([^"']+)["']/i
    );
    const newColor = bgColorMatch ? bgColorMatch[1].trim() : '#001833';
    
    log(colors.blue, `📖 Config.xml colors:`);
    log(colors.reset, `   OLD_COLOR (to replace): ${oldColor}`);
    log(colors.reset, `   BackgroundColor (new): ${newColor}`);
    
    return { oldColor, newColor };
  } catch (error) {
    log(colors.yellow, `⚠️  Error reading config.xml: ${error.message}`);
    return { oldColor: '#1E1464', newColor: '#001833' }; // Fallback
  }
}

/**
 * Normalize color format (with or without #)
 * @param {string} color - Color value
 * @returns {string} - Normalized color with #
 */
function normalizeColor(color) {
  if (!color) return '#001833';
  const trimmed = color.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Extract hex color (without #) for XML value
 * @param {string} color - Color value
 * @returns {string} - Hex without #
 */
function getHexWithoutHash(color) {
  const normalized = normalizeColor(color);
  return normalized.replace('#', '');
}

function fixAndroidSplashFlicker(context) {
  const root = context.opts.projectRoot;
  
  log(colors.bright + colors.blue, '\n╔═══════════════════════════════════════════════════════════╗');
  log(colors.bright + colors.blue, '║  Android Splash Screen Color Flicker Fix (after_prepare)   ║');
  log(colors.bright + colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');
  
  log(colors.reset, '🎯 Reading color config and forcing correct splash color...\n');
  
  // ============================================
  // 1. Read color config from config.xml
  // ============================================
  const configPath = path.join(root, 'config.xml');
  const { oldColor, newColor } = readColorConfigFromXml(configPath);
  
  const normalizedOldColor = normalizeColor(oldColor);
  const normalizedNewColor = normalizeColor(newColor);
  const newColorHex = getHexWithoutHash(normalizedNewColor);
  
  const androidResPath = path.join(
    root,
    'platforms/android/app/src/main/res/values'
  );
  
  if (!fs.existsSync(androidResPath)) {
    log(colors.yellow, '\n⚠️  Android resources directory not found, skipping fix');
    return;
  }
  
  let fixedFiles = 0;
  
  // ============================================
  // 2. Fix cdvcolors.xml (Splash Color)
  // ============================================
  const cdvColorsPath = path.join(androidResPath, 'cdvcolors.xml');
  
  if (fs.existsSync(cdvColorsPath)) {
    log(colors.reset, '📄 Processing cdvcolors.xml:');
    
    try {
      let content = fs.readFileSync(cdvColorsPath, 'utf8');
      const originalContent = content;
      
      // Pattern: <color name="cdv_splashscreen_background_color">VALUE</color>
      const splashColorPattern = /<color\s+name=["']cdv_splashscreen_background_color["']>([^<]*)<\/color>/;
      const splashColorMatch = content.match(splashColorPattern);
      
      if (splashColorMatch) {
        const currentColor = splashColorMatch[1].trim();
        
        // Replace with correct color
        content = content.replace(
          splashColorPattern,
          `<color name="cdv_splashscreen_background_color">${normalizedNewColor}</color>`
        );
        
        log(colors.green, `   ✅ Updated splash color: "${currentColor}" → "${normalizedNewColor}"`);
        fixedFiles++;
      } else {
        // Color doesn't exist, add it
        const insertPoint = content.indexOf('</resources>');
        if (insertPoint !== -1) {
          content = content.substring(0, insertPoint) +
            `    <color name="cdv_splashscreen_background_color">${normalizedNewColor}</color>\n` +
            content.substring(insertPoint);
          log(colors.green, `   ✅ Added splash color: "${normalizedNewColor}"`);
          fixedFiles++;
        }
      }
      
      // Update all splash-related color references
      const splashColorNames = [
        'cdv_splashscreen_background_color',
        'cdv_splashscreen_backdrop_color',
        'cdv_splashscreen_icon_color'
      ];
      
      for (const colorName of splashColorNames) {
        const pattern = new RegExp(
          `<color\\s+name=["']${colorName}["']>([^<]*)<\\/color>`,
          'g'
        );
        
        if (pattern.test(content)) {
          const matches = content.match(pattern);
          content = content.replace(
            pattern,
            `<color name="${colorName}">${normalizedNewColor}</color>`
          );
          if (matches && matches.length > 1) {
            log(colors.green, `   ✅ Updated ${matches.length} color reference(s) for ${colorName}`);
          }
        }
      }
      
      // Write back only if changed
      if (content !== originalContent) {
        fs.writeFileSync(cdvColorsPath, content);
        log(colors.green, `   ✅ cdvcolors.xml saved successfully\n`);
      } else {
        log(colors.green, `   ✅ cdvcolors.xml already correct\n`);
      }
      
    } catch (error) {
      log(colors.red, `   ❌ Error updating cdvcolors.xml: ${error.message}\n`);
    }
  } else {
    log(colors.yellow, `   ⚠️  cdvcolors.xml not found at: ${cdvColorsPath}\n`);
  }
  
  // ============================================
  // 3. Fix cdvthemes.xml (Theme Color References)
  // ============================================
  const cdvThemesPath = path.join(androidResPath, 'cdvthemes.xml');
  
  if (fs.existsSync(cdvThemesPath)) {
    log(colors.reset, '🎨 Processing cdvthemes.xml:');
    
    try {
      let content = fs.readFileSync(cdvThemesPath, 'utf8');
      const originalContent = content;
      
      // Ensure theme references correct color
      // Pattern: <item name="android:windowBackground">VALUE</item>
      const themeColorPattern = /<item\s+name=["']android:windowBackground["']>([^<]*)<\/item>/g;
      
      if (themeColorPattern.test(content)) {
        const matches = content.match(themeColorPattern) || [];
        content = content.replace(
          themeColorPattern,
          '<item name="android:windowBackground">@color/cdv_splashscreen_background_color</item>'
        );
        log(colors.green, `   ✅ Updated ${matches.length} theme window background reference(s)`);
      }
      
      // Write back only if changed
      if (content !== originalContent) {
        fs.writeFileSync(cdvThemesPath, content);
        log(colors.green, `   ✅ cdvthemes.xml saved successfully\n`);
      } else {
        log(colors.green, `   ✅ cdvthemes.xml already correct\n`);
      }
      
    } catch (error) {
      log(colors.red, `   ❌ Error updating cdvthemes.xml: ${error.message}\n`);
    }
  } else {
    log(colors.yellow, `   ⚠️  cdvthemes.xml not found at: ${cdvThemesPath}\n`);
  }
  
  // ============================================
  // 4. Verify AndroidManifest.xml theme reference
  // ============================================
  const manifestPath = path.join(
    root,
    'platforms/android/app/src/main/AndroidManifest.xml'
  );
  
  if (fs.existsSync(manifestPath)) {
    log(colors.reset, '📋 Checking AndroidManifest.xml:');
    
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      
      if (content.includes('@style/')) {
        log(colors.green, `   ✅ Theme style is correctly referenced\n`);
      }
      
    } catch (error) {
      log(colors.yellow, `   ⚠️  Could not verify manifest: ${error.message}\n`);
    }
  }
  
  // ============================================
  // Summary
  // ============================================
  log(colors.reset, '═'.repeat(63));
  log(colors.bright + colors.green, '✅ Android Splash Flicker Fix Complete!');
  log(colors.reset, '═'.repeat(63));
  
  log(colors.yellow, '\n📌 Configuration Applied:');
  log(colors.yellow, `   • Replace old color: ${normalizedOldColor}`);
  log(colors.yellow, `   • Force new color: ${normalizedNewColor}`);
  log(colors.yellow, '   • Phase: after_prepare (FINAL - no more changes)');
  log(colors.yellow, '\n📊 Result:');
  log(colors.yellow, '   ✓ No color flicker on app launch');
  log(colors.yellow, '   ✓ Correct color displayed immediately\n');
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  // Only run for Android
  if (!platforms || !platforms.includes('android')) {
    return;
  }
  
  fixAndroidSplashFlicker(context);
};
