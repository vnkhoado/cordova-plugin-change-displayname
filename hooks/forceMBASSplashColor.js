#!/usr/bin/env node

/**
 * Force MABS Splash Color Override (Post-Compile)
 * 
 * This hook runs at the VERY END (post_compile stage) to ensure
 * all MABS theme overrides are completely replaced.
 * 
 * Problem: MABS injects theme colors that may override config.xml
 * Solution: Do final color replacement AFTER MABS completes
 * 
 * Strategy:
 * 1. Gets target color from config (SplashScreenBackgroundColor)
 * 2. Gets old MABS color (default: #FF8751 - OutSystems theme)
 * 3. Deep scans ALL platform files
 * 4. Replaces EVERY reference:
 *    - Hex values (#FF8751 → #001833)
 *    - RGB decimals (0.906, 0.506, 0.376 → 0.0, 0.094, 0.2)
 *    - Named color references
 *    - Drawable colors
 * 5. Ensures user color ALWAYS wins
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255.0;
  const g = parseInt(hex.substring(2, 4), 16) / 255.0;
  const b = parseInt(hex.substring(4, 6), 16) / 255.0;
  return { r, g, b };
}

function findAllFilesRecursive(dir, maxDepth = 5, currentDepth = 0) {
  const results = [];
  
  if (currentDepth > maxDepth) return results;
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          results.push(fullPath);
        } else if (stat.isDirectory()) {
          // Skip common exclusions
          if (!['node_modules', 'build', 'Pods', '.git', 'DerivedData'].includes(item)) {
            results.push(...findAllFilesRecursive(fullPath, maxDepth, currentDepth + 1));
          }
        }
      } catch (e) {
        // Skip inaccessible items
      }
    }
  } catch (e) {
    // Skip inaccessible directories
  }
  
  return results;
}

function replaceColorInFile(filePath, oldColor, newColor, oldRgb, newRgb) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let replacementCount = 0;
    
    // Strategy 1: Replace hex values (uppercase)
    const oldHexUpper = oldColor.toUpperCase();
    const newHexUpper = newColor.toUpperCase();
    const hexRegexUpper = new RegExp(oldHexUpper.replace('#', ''), 'g');
    
    if (hexRegexUpper.test(content)) {
      content = content.replace(hexRegexUpper, newHexUpper.replace('#', ''));
      replacementCount++;
    }
    
    // Strategy 2: Replace hex with # prefix
    const hexRegex = new RegExp(oldColor.replace('#', ''), 'gi');
    const beforeHex = (content.match(hexRegex) || []).length;
    content = content.replace(hexRegex, newColor.replace('#', ''));
    const afterHex = (content.match(hexRegex) || []).length;
    if (beforeHex > afterHex) {
      replacementCount++;
    }
    
    // Strategy 3: Replace RGB decimal values (MABS theme format)
    // Old: red="0.906" green="0.506" blue="0.376" (for #FF8751)
    // New: red="0.0" green="0.094" blue="0.2" (for #001833)
    const oldRgbPattern = new RegExp(
      `red=["']${oldRgb.r.toFixed(3)}["']\\s+green=["']${oldRgb.g.toFixed(3)}["']\\s+blue=["']${oldRgb.b.toFixed(3)}["']`,
      'g'
    );
    
    if (oldRgbPattern.test(content)) {
      content = content.replace(
        oldRgbPattern,
        `red="${newRgb.r.toFixed(3)}" green="${newRgb.g.toFixed(3)}" blue="${newRgb.b.toFixed(3)}"`
      );
      replacementCount++;
    }
    
    // Strategy 4: Replace in android:color attributes
    const androidColorRegex = new RegExp(`android:color=["']${oldColor}["']`, 'gi');
    if (androidColorRegex.test(content)) {
      content = content.replace(androidColorRegex, `android:color="${newColor}"`);
      replacementCount++;
    }
    
    // Strategy 5: Replace in CSS/SVG fill/stroke
    const cssColorRegex = new RegExp(`['\"]${oldColor}['\"]`, 'gi');
    const cssReplacements = (content.match(cssColorRegex) || []).length;
    if (cssReplacements > 0) {
      content = content.replace(cssColorRegex, `"${newColor}"`);
      replacementCount++;
    }
    
    // Write if changes made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return replacementCount;
    }
    
    return 0;
  } catch (error) {
    // Skip files that can't be read
    return 0;
  }
}

function deepScanAndReplace(platformPath, oldColor, newColor, oldRgb, newRgb, filePattern) {
  console.log(`\n   🔍 Deep scanning for ${oldColor}...`);
  
  const allFiles = findAllFilesRecursive(platformPath);
  let totalReplacements = 0;
  let filesModified = 0;
  
  // Filter by pattern if provided
  let filesToProcess = allFiles;
  if (filePattern) {
    filesToProcess = allFiles.filter(f => filePattern.test(f));
  }
  
  console.log(`   📂 Found ${filesToProcess.length} file(s) to scan`);
  
  for (const filePath of filesToProcess) {
    const replacements = replaceColorInFile(filePath, oldColor, newColor, oldRgb, newRgb);
    if (replacements > 0) {
      totalReplacements += replacements;
      filesModified++;
      const relPath = path.relative(platformPath, filePath);
      console.log(`   ✓ ${relPath} (${replacements} replacement)`);
    }
  }
  
  if (filesModified > 0) {
    console.log(`   ✅ Scanned ${filesToProcess.length} files, modified ${filesModified}`);
  } else {
    console.log(`   ℹ️  No color references found to replace`);
  }
  
  return { filesModified, totalReplacements };
}

function forceMBASColorsIOS(iosPath, oldColor, newColor, oldRgb, newRgb) {
  console.log(`\n📱 iOS: Force MABS Color Override`);
  console.log(`   Old: ${oldColor} (RGB: ${oldRgb.r.toFixed(3)}, ${oldRgb.g.toFixed(3)}, ${oldRgb.b.toFixed(3)})`);
  console.log(`   New: ${newColor} (RGB: ${newRgb.r.toFixed(3)}, ${newRgb.g.toFixed(3)}, ${newRgb.b.toFixed(3)})`);
  
  // Deep scan all files
  const results = deepScanAndReplace(
    iosPath,
    oldColor,
    newColor,
    oldRgb,
    newRgb,
    /\.(storyboard|plist|xcconfig|swift|m|h|json)$/ // Common iOS files
  );
  
  if (results.filesModified > 0) {
    console.log(`   ✅ iOS color replacement complete (${results.filesModified} files modified)`);
  }
}

function forceMBASColorsAndroid(androidPath, oldColor, newColor, oldRgb, newRgb) {
  console.log(`\n📱 Android: Force MABS Color Override`);
  console.log(`   Old: ${oldColor}`);
  console.log(`   New: ${newColor}`);
  
  // Deep scan all files
  const results = deepScanAndReplace(
    androidPath,
    oldColor,
    newColor,
    oldRgb,
    newRgb,
    /\.(xml|gradle|properties)$/ // Common Android files
  );
  
  if (results.filesModified > 0) {
    console.log(`   ✅ Android color replacement complete (${results.filesModified} files modified)`);
  }
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  
  try {
    const config = getConfigParser(context, path.join(root, 'config.xml'));
    
    // Get target color
    const newColor = config.getPreference("SplashScreenBackgroundColor") ||
                     config.getPreference("BackgroundColor");
    
    if (!newColor) {
      console.log('\n⏭️  No splash color configured, skipping MABS override');
      return;
    }
    
    // Ensure # prefix
    const targetColor = newColor.startsWith('#') ? newColor : '#' + newColor;
    
    // Get old color (default to MABS theme orange)
    const oldColorPref = config.getPreference("OLD_COLOR") || "#FF8751";
    const oldColor = oldColorPref.startsWith('#') ? oldColorPref : '#' + oldColorPref;
    
    console.log('\n══════════════════════════════════════════════');
    console.log('  🔒 FORCE MABS SPLASH COLOR OVERRIDE');
    console.log('══════════════════════════════════════════════');
    console.log(`Stage: post_compile (FINAL - after all processing)`);
    console.log(`Target Color: ${targetColor}`);
    console.log(`Old MABS Color: ${oldColor}`);
    console.log(`Purpose: Override MABS theme completely\n`);
    
    const newRgb = hexToRgb(targetColor);
    const oldRgb = hexToRgb(oldColor);
    
    for (const platform of platforms) {
      if (platform === 'ios') {
        const iosPath = path.join(root, 'platforms/ios');
        if (fs.existsSync(iosPath)) {
          forceMBASColorsIOS(iosPath, oldColor, targetColor, oldRgb, newRgb);
        }
      } else if (platform === 'android') {
        const androidPath = path.join(root, 'platforms/android');
        if (fs.existsSync(androidPath)) {
          forceMBASColorsAndroid(androidPath, oldColor, targetColor, oldRgb, newRgb);
        }
      }
    }
    
    console.log('\n══════════════════════════════════════════════');
    console.log('✅ MABS color override completed!');
    console.log('   Your color now overrides MABS theme');
    console.log('══════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error in forceMBASSplashColor hook:', error.message);
    console.error(error.stack);
  }
};
