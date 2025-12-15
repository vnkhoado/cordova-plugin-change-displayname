#!/usr/bin/env node

/**
 * Color Scanner and Replacer Hook
 * 
 * Scans all generated files in platforms folder and replaces
 * old theme colors with new colors from preferences.
 * 
 * USE CASE: OutSystems caching old primary color in various files
 * 
 * Configuration:
 * - SplashScreenBackgroundColor: New color to use (e.g., "#001833")
 * - OLD_COLOR: Old color to search for (e.g., "#59ABE3") - OPTIONAL
 *   If not specified, defaults to common OutSystems blue (#59ABE3)
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

// Directories to scan
const SCAN_DIRS = [
  'platforms/android/app/src/main/res',
  'platforms/android/app/src/main/java',
  'platforms/ios',
  'platforms/android/CordovaLib/res',
  'www'
];

function scanDirectory(dir, oldColors, newColor, stats) {
  if (!fs.existsSync(dir)) {
    return;
  }
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, build, .git
      if (['node_modules', 'build', '.git', 'gradle'].includes(item)) {
        continue;
      }
      scanDirectory(fullPath, oldColors, newColor, stats);
    } else if (stat.isFile()) {
      // Check if file extension matches patterns
      const ext = path.extname(item);
      const validExts = ['.xml', '.java', '.kt', '.m', '.swift', '.plist', 
                        '.storyboard', '.html', '.css', '.json'];
      
      if (validExts.includes(ext)) {
        scanAndReplaceFile(fullPath, oldColors, newColor, stats);
      }
    }
  }
}

function scanAndReplaceFile(filePath, oldColors, newColor, stats) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let fileModified = false;
    let totalMatches = 0;
    
    // Try each old color pattern
    for (const oldColor of oldColors) {
      // Case-insensitive search for color
      const regex = new RegExp(escapeRegex(oldColor), 'gi');
      const matches = content.match(regex);
      
      if (matches && matches.length > 0) {
        totalMatches += matches.length;
        
        // Replace all occurrences
        content = content.replace(regex, newColor);
        fileModified = true;
      }
    }
    
    if (fileModified) {
      stats.filesFound++;
      stats.occurrences += totalMatches;
      
      console.log(`   🔍 Found ${totalMatches}x in: ${path.relative(stats.rootDir, filePath)}`);
      
      fs.writeFileSync(filePath, content, 'utf8');
      
      stats.filesReplaced++;
      console.log(`      ✅ Replaced with ${newColor}`);
    }
  } catch (error) {
    // Skip binary files or permission errors
    if (!error.message.includes('EISDIR') && !error.message.includes('EACCES')) {
      console.log(`   ⚠️  Error scanning ${path.basename(filePath)}: ${error.message}`);
    }
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hexToRgb(hex) {
  // Convert hex to RGB format for additional searching
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function generateColorVariants(baseColor) {
  // Generate all possible variants of the color
  const variants = [];
  
  // Normalize base color
  let normalized = baseColor.toUpperCase();
  if (!normalized.startsWith('#')) {
    normalized = '#' + normalized;
  }
  
  // Add hex variants
  variants.push(normalized);           // #59ABE3
  variants.push(normalized.toLowerCase()); // #5aabe3
  variants.push(normalized.substring(1)); // 59ABE3
  variants.push(normalized.substring(1).toLowerCase()); // 5aabe3
  
  // Add RGB variant
  try {
    const rgb = hexToRgb(normalized);
    variants.push(rgb);                // rgb(89, 171, 227)
    variants.push(rgb.replace(/\s/g, '')); // rgb(89,171,227)
    // RGBA partial match
    variants.push(rgb.replace(')', ''));  // rgb(89, 171, 227
  } catch (error) {
    // Skip RGB if hex is invalid
  }
  
  return variants;
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Get new color from config
  const newColor = config.getPreference("SplashScreenBackgroundColor") ||
                   config.getPreference("BackgroundColor");
  
  if (!newColor) {
    console.log('\n⏭️  No new color configured for scanner, skipping');
    return;
  }
  
  // Get old color from config (or use default)
  let oldColorBase = config.getPreference("OLD_COLOR") || "#59ABE3";
  
  // Generate all variants of the old color
  const oldColors = generateColorVariants(oldColorBase);
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🔍 COLOR SCANNER & REPLACER');
  console.log('══════════════════════════════════════════════');
  console.log(`Old Color: ${oldColorBase}`);
  console.log(`New Color: ${newColor}`);
  console.log(`Variants: ${oldColors.length} patterns`);
  console.log('');
  
  const stats = {
    rootDir: root,
    filesFound: 0,
    filesReplaced: 0,
    occurrences: 0
  };
  
  for (const platform of platforms) {
    if (platform !== 'android' && platform !== 'ios') continue;
    
    console.log(`📱 Scanning ${platform}...\n`);
    
    const platformDir = path.join(root, `platforms/${platform}`);
    if (fs.existsSync(platformDir)) {
      scanDirectory(platformDir, oldColors, newColor, stats);
    }
    
    // Also scan www folder
    const wwwDir = path.join(root, 'www');
    if (fs.existsSync(wwwDir)) {
      scanDirectory(wwwDir, oldColors, newColor, stats);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  if (stats.filesFound > 0) {
    console.log(`✅ Scan complete!`);
    console.log(`   Files scanned: ${stats.filesFound}`);
    console.log(`   Occurrences found: ${stats.occurrences}`);
    console.log(`   Files replaced: ${stats.filesReplaced}`);
    console.log(`\n   OLD: ${oldColorBase} → NEW: ${newColor}`);
  } else {
    console.log('✅ No old colors found - all clean!');
  }
  console.log('══════════════════════════════════════════════\n');
};
