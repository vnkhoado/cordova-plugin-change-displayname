#!/usr/bin/env node

/**
 * Force MABS Splash Color Override (Post-Compile)
 * 
 * FIX: Delete old storyboard files to prevent color cache
 * 
 * Problem: MABS optimizes by reusing existing files
 * - Build 1: Creates storyboard with #FF8751
 * - Build 2: Config changed to #001833
 * - But storyboard file still exists
 * - MABS: "File exists? Reuse it!" (ignores new color)
 * - Result: Orange still shows
 * 
 * Solution: DELETE old files → Force fresh generation
 * - Remove old storyboard
 * - Remove old color assets
 * - Let generateIcons.js recreate with NEW color
 * - Scan & replace final colors
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

function deleteFileOrDir(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false; // File doesn't exist
    }
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Recursive delete
      const files = fs.readdirSync(filePath);
      for (const file of files) {
        deleteFileOrDir(path.join(filePath, file));
      }
      fs.rmdirSync(filePath);
    } else {
      fs.unlinkSync(filePath);
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

function deleteOldStoryboardFilesIOS(iosPath) {
  console.log('\n   🗑️  Deleting old storyboard files to force fresh generation...');
  
  // Find app folder
  const appFolders = fs.readdirSync(iosPath).filter(f => {
    const fullPath = path.join(iosPath, f);
    return fs.statSync(fullPath).isDirectory() && 
           f !== "CordovaLib" && 
           f !== "www" && 
           f !== "cordova" &&
           f !== "build" &&
           f !== "Pods";
  });
  
  if (appFolders.length === 0) {
    console.log('   ⚠️  No app folder found');
    return 0;
  }
  
  const appPath = path.join(iosPath, appFolders[0]);
  let deletedCount = 0;
  
  // Paths to delete
  const pathsToDelete = [
    path.join(appPath, 'LaunchScreen.storyboard'),
    path.join(appPath, 'CDVLaunchScreen.storyboard'),
    path.join(appPath, 'Base.lproj', 'LaunchScreen.storyboard'),
    path.join(appPath, 'Base.lproj', 'LaunchScreen.storyboardc'),
    path.join(appPath, 'Assets.xcassets'),  // Delete ALL color assets
  ];
  
  for (const filePath of pathsToDelete) {
    if (deleteFileOrDir(filePath)) {
      const relPath = path.relative(iosPath, filePath);
      console.log(`   ✓ Deleted: ${relPath}`);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`   ✅ Deleted ${deletedCount} old file(s) - will force fresh generation`);
  }
  
  return deletedCount;
}

function deleteOldSplashFilesAndroid(androidPath) {
  console.log('\n   🗑️  Deleting old splash files to force fresh generation...');
  
  const resPath = path.join(androidPath, 'app/src/main/res') || 
                 path.join(androidPath, 'res');
  
  if (!fs.existsSync(resPath)) {
    return 0;
  }
  
  let deletedCount = 0;
  
  // Delete splash drawables
  const drawableFolders = fs.readdirSync(resPath)
    .filter(f => f.startsWith('drawable'))
    .map(f => path.join(resPath, f));
  
  for (const folder of drawableFolders) {
    const splashPath = path.join(folder, 'splash.xml');
    if (deleteFileOrDir(splashPath)) {
      console.log(`   ✓ Deleted: ${path.basename(folder)}/splash.xml`);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`   ✅ Deleted ${deletedCount} old file(s) - will force fresh generation`);
  }
  
  return deletedCount;
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
          if (!['node_modules', 'build', 'Pods', '.git', 'DerivedData'].includes(item)) {
            results.push(...findAllFilesRecursive(fullPath, maxDepth, currentDepth + 1));
          }
        }
      } catch (e) {
        // Skip
      }
    }
  } catch (e) {
    // Skip
  }
  
  return results;
}

function replaceColorInFile(filePath, oldColor, newColor, oldRgb, newRgb) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let replacementCount = 0;
    
    // Strategy 1: Replace hex values
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
    
    // Strategy 3: Replace RGB decimal values
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
    
    // Strategy 5: Replace in CSS/SVG
    const cssColorRegex = new RegExp(`['\"]${oldColor}['\"]`, 'gi');
    const cssReplacements = (content.match(cssColorRegex) || []).length;
    if (cssReplacements > 0) {
      content = content.replace(cssColorRegex, `"${newColor}"`);
      replacementCount++;
    }
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return replacementCount;
    }
    
    return 0;
  } catch (error) {
    return 0;
  }
}

function deepScanAndReplace(platformPath, oldColor, newColor, oldRgb, newRgb, filePattern) {
  console.log(`\n   🔍 Scanning for ${oldColor} to replace with ${newColor}...`);
  
  const allFiles = findAllFilesRecursive(platformPath);
  let totalReplacements = 0;
  let filesModified = 0;
  
  let filesToProcess = allFiles;
  if (filePattern) {
    filesToProcess = allFiles.filter(f => filePattern.test(f));
  }
  
  console.log(`   📄 Scanning ${filesToProcess.length} file(s)...`);
  
  for (const filePath of filesToProcess) {
    const replacements = replaceColorInFile(filePath, oldColor, newColor, oldRgb, newRgb);
    if (replacements > 0) {
      totalReplacements += replacements;
      filesModified++;
      const relPath = path.relative(platformPath, filePath);
      console.log(`   ✓ ${relPath}`);
    }
  }
  
  if (filesModified > 0) {
    console.log(`   ✅ Modified ${filesModified} file(s) with ${totalReplacements} replacement(s)`);
  } else {
    console.log(`   ℹ️  No color references found`);
  }
  
  return { filesModified, totalReplacements };
}

function forceMBASColorsIOS(iosPath, oldColor, newColor, oldRgb, newRgb) {
  console.log(`\n📱 iOS: Force MABS Color Override`);
  console.log(`   Old: ${oldColor}`);
  console.log(`   New: ${newColor}`);
  
  // CRITICAL: Delete old storyboard files FIRST!
  deleteOldStoryboardFilesIOS(iosPath);
  
  // Then scan & replace any remaining references
  const results = deepScanAndReplace(
    iosPath,
    oldColor,
    newColor,
    oldRgb,
    newRgb,
    /\.(storyboard|plist|xcconfig|swift|m|h|json)$/
  );
  
  if (results.filesModified > 0 || deleteOldStoryboardFilesIOS.called) {
    console.log(`   ✅ iOS color override complete`);
  }
}

function forceMBASColorsAndroid(androidPath, oldColor, newColor, oldRgb, newRgb) {
  console.log(`\n📱 Android: Force MABS Color Override`);
  console.log(`   Old: ${oldColor}`);
  console.log(`   New: ${newColor}`);
  
  // CRITICAL: Delete old splash files FIRST!
  deleteOldSplashFilesAndroid(androidPath);
  
  // Then scan & replace any remaining references
  const results = deepScanAndReplace(
    androidPath,
    oldColor,
    newColor,
    oldRgb,
    newRgb,
    /\.(xml|gradle|properties)$/
  );
  
  if (results.filesModified > 0) {
    console.log(`   ✅ Android color override complete`);
  }
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  
  try {
    const config = getConfigParser(context, path.join(root, 'config.xml'));
    
    const newColor = config.getPreference("SplashScreenBackgroundColor") ||
                     config.getPreference("BackgroundColor");
    
    if (!newColor) {
      console.log('\n⏭️  No splash color configured, skipping');
      return;
    }
    
    const targetColor = newColor.startsWith('#') ? newColor : '#' + newColor;
    const oldColorPref = config.getPreference("OLD_COLOR") || "#FF8751";
    const oldColor = oldColorPref.startsWith('#') ? oldColorPref : '#' + oldColorPref;
    
    console.log('\n' + '═'.repeat(60));
    console.log('  🔒 FORCE MABS SPLASH COLOR OVERRIDE (WITH FILE DELETE)');
    console.log('═'.repeat(60));
    console.log(`Stage: post_compile (FINAL - after all processing)`);
    console.log(`Target Color: ${targetColor}`);
    console.log(`Old Color: ${oldColor}`);
    console.log(`Strategy: DELETE old files → Force fresh generation\n`);
    
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
    
    console.log('\n' + '═'.repeat(60));
    console.log('✅ MABS color override completed!');
    console.log('   Old files deleted, new colors applied');
    console.log('═'.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error in forceMBASSplashColor hook:', error.message);
  }
};
