#!/usr/bin/env node

/**
 * Splash Color Manager
 * 
 * Unified module for managing splash screen colors across platforms.
 * Consolidates logic from:
 * - customizeSplashScreen.js
 * - forceOverrideSplashColor.js
 * - forceOverrideNativeColors.js
 * - forceMBASSplashColor.js
 * - scanAndReplaceColor.js
 * 
 * This eliminates ~45 KB of duplicate code.
 */

const fs = require('fs');
const path = require('path');
const { 
  getConfigParser, 
  hexToRgb, 
  getBackgroundColorPreference,
  safeWriteFile,
  findAllFiles 
} = require('../utils');

// ============================================================================
// CONFIG READING
// ============================================================================

/**
 * Get splash color configuration from config.xml
 * Single source of truth for all splash color operations
 */
function getSplashColorConfig(context) {
  const config = getConfigParser(context);
  
  // Try multiple preference keys (compatibility)
  const splashColor = getBackgroundColorPreference(config) || '#001833';
  
  // Get old color for replacement (if exists)
  const oldColor = config.getPreference('OLD_SPLASH_COLOR') || '#1E1464';
  
  return {
    newColor: splashColor,
    oldColor: oldColor,
    // Generate color variants for search/replace
    variants: generateColorVariants(splashColor, oldColor)
  };
}

/**
 * Generate color format variants for comprehensive replacement
 */
function generateColorVariants(newColor, oldColor) {
  return {
    new: {
      hex: newColor,
      hexLower: newColor.toLowerCase(),
      hexUpper: newColor.toUpperCase(),
      rgb: hexToRgb(newColor)
    },
    old: {
      hex: oldColor,
      hexLower: oldColor.toLowerCase(),
      hexUpper: oldColor.toUpperCase(),
      patterns: [
        oldColor,
        oldColor.toLowerCase(),
        oldColor.toUpperCase(),
        oldColor.replace('#', ''),
        oldColor.replace('#', '').toLowerCase(),
        oldColor.replace('#', '').toUpperCase()
      ]
    }
  };
}

// ============================================================================
// CONFIG.XML UPDATES
// ============================================================================

/**
 * Update splash color preferences in config.xml
 * Replaces: customizeSplashScreen.js logic
 */
function updateConfigXml(context, platform, colorConfig) {
  const root = context.opts.projectRoot;
  const configPaths = [
    path.join(root, `platforms/${platform}/res/xml/config.xml`),
    path.join(root, `platforms/${platform}/app/src/main/res/xml/config.xml`)
  ];
  
  let updated = false;
  
  for (const configPath of configPaths) {
    if (!fs.existsSync(configPath)) continue;
    
    try {
      let content = fs.readFileSync(configPath, 'utf8');
      
      // Update or add preferences
      const preferences = [
        { name: 'BackgroundColor', value: colorConfig.newColor },
        { name: 'SplashScreenBackgroundColor', value: colorConfig.newColor },
        { name: 'AndroidWindowSplashScreenBackground', value: colorConfig.newColor }
      ];
      
      for (const pref of preferences) {
        const regex = new RegExp(
          `<preference\\s+name="${pref.name}"\\s+value="[^"]*"\\s*/?>`
        );
        
        if (regex.test(content)) {
          // Update existing
          content = content.replace(regex, 
            `<preference name="${pref.name}" value="${pref.value}" />`
          );
        } else {
          // Add new before </widget>
          content = content.replace(
            '</widget>',
            `    <preference name="${pref.name}" value="${pref.value}" />\n</widget>`
          );
        }
      }
      
      safeWriteFile(configPath, content);
      updated = true;
      console.log(`   ✅ Updated ${path.basename(configPath)}`);
      
    } catch (err) {
      console.warn(`   ⚠️  Failed to update ${configPath}:`, err.message);
    }
  }
  
  return updated;
}

// ============================================================================
// ANDROID NATIVE FILES
// ============================================================================

/**
 * Update Android native color resources
 * Replaces: forceOverrideNativeColors.js logic
 */
function updateAndroidNativeFiles(context, colorConfig) {
  const root = context.opts.projectRoot;
  const resPath = path.join(root, 'platforms/android/app/src/main/res');
  
  if (!fs.existsSync(resPath)) {
    console.log('   ℹ️  Android res folder not found');
    return false;
  }
  
  let filesUpdated = 0;
  
  // Update colors.xml
  filesUpdated += updateColorsXml(resPath, colorConfig);
  
  // Update themes.xml (cdv_themes.xml)
  filesUpdated += updateThemesXml(resPath, colorConfig);
  
  console.log(`   ✅ Updated ${filesUpdated} Android native file(s)`);
  return filesUpdated > 0;
}

/**
 * Update colors.xml files
 */
function updateColorsXml(resPath, colorConfig) {
  const colorFiles = findAllFiles(resPath, ['colors.xml'], 2);
  let updated = 0;
  
  for (const colorFile of colorFiles) {
    try {
      let content = fs.readFileSync(colorFile, 'utf8');
      
      // Replace splash color definition
      const patterns = [
        /<color name="splash_background">#[0-9A-Fa-f]{6}<\/color>/,
        /<color name="colorPrimary">#[0-9A-Fa-f]{6}<\/color>/
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, (match) => {
            const colorName = match.match(/name="([^"]+)"/)[1];
            return `<color name="${colorName}">${colorConfig.newColor}</color>`;
          });
        }
      }
      
      safeWriteFile(colorFile, content);
      updated++;
      
    } catch (err) {
      console.warn(`   ⚠️  Failed to update ${colorFile}:`, err.message);
    }
  }
  
  return updated;
}

/**
 * Update themes.xml files
 */
function updateThemesXml(resPath, colorConfig) {
  const themeFiles = findAllFiles(resPath, ['cdv_themes.xml', 'themes.xml'], 2);
  let updated = 0;
  
  for (const themeFile of themeFiles) {
    try {
      let content = fs.readFileSync(themeFile, 'utf8');
      
      // Replace windowBackground colors
      content = content.replace(
        /<item name="android:windowBackground">#[0-9A-Fa-f]{6}<\/item>/g,
        `<item name="android:windowBackground">${colorConfig.newColor}</item>`
      );
      
      safeWriteFile(themeFile, content);
      updated++;
      
    } catch (err) {
      console.warn(`   ⚠️  Failed to update ${themeFile}:`, err.message);
    }
  }
  
  return updated;
}

// ============================================================================
// SCAN AND REPLACE IN WWW FILES
// ============================================================================

/**
 * Scan and replace colors in www files (CSS, HTML)
 * Replaces: scanAndReplaceColor.js logic
 */
function scanAndReplaceColors(context, platform, colorConfig) {
  const root = context.opts.projectRoot;
  const searchPaths = [
    path.join(root, `platforms/${platform}/app/src/main/assets/www`),
    path.join(root, `platforms/${platform}/platform_www`),
    path.join(root, 'www')
  ];
  
  let totalFiles = 0;
  let totalOccurrences = 0;
  
  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;
    
    // Find CSS and HTML files
    const files = findAllFiles(searchPath, ['.css', '.html'], 5);
    
    for (const file of files) {
      const result = replaceColorsInFile(file, colorConfig);
      if (result.replaced) {
        totalFiles++;
        totalOccurrences += result.count;
        console.log(`   🔍 Found ${result.count}x in: ${path.relative(root, file)}`);
      }
    }
  }
  
  console.log(`   ✅ Replaced ${totalOccurrences} occurrence(s) in ${totalFiles} file(s)`);
  return totalFiles > 0;
}

/**
 * Replace colors in a single file
 */
function replaceColorsInFile(filePath, colorConfig) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let count = 0;
    const originalContent = content;
    
    // Replace all old color patterns with new color
    for (const pattern of colorConfig.variants.old.patterns) {
      const regex = new RegExp(pattern.replace('#', '#?'), 'gi');
      const matches = content.match(regex);
      if (matches) {
        count += matches.length;
        content = content.replace(regex, colorConfig.newColor);
      }
    }
    
    if (count > 0) {
      safeWriteFile(filePath, content);
      return { replaced: true, count };
    }
    
    return { replaced: false, count: 0 };
    
  } catch (err) {
    console.warn(`   ⚠️  Failed to process ${filePath}:`, err.message);
    return { replaced: false, count: 0 };
  }
}

// ============================================================================
// MABS OVERRIDE (POST-COMPILE)
// ============================================================================

/**
 * Force MABS splash color override after compilation
 * Replaces: forceMBASSplashColor.js logic
 * 
 * This runs post_compile to override any MABS changes
 */
function forceMBASOverride(context, platform, colorConfig) {
  console.log('   🔒 Forcing MABS color override (post-compile)...');
  
  // Re-apply all color updates
  let success = true;
  
  success = updateConfigXml(context, platform, colorConfig) && success;
  success = updateAndroidNativeFiles(context, colorConfig) && success;
  
  if (success) {
    console.log('   ✅ MABS override complete');
  } else {
    console.warn('   ⚠️  Some MABS overrides failed');
  }
  
  return success;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  getSplashColorConfig,
  updateConfigXml,
  updateAndroidNativeFiles,
  scanAndReplaceColors,
  forceMBASOverride
};
