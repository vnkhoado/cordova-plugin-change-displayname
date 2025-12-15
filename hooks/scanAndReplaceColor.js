#!/usr/bin/env node

/**
 * Color Scanner and Replacer Hook
 * 
 * Scans all generated files in platforms folder and replaces
 * old theme colors with new colors from preferences.
 * 
 * USE CASE: OutSystems caching old primary color in various files
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

// Files and patterns to scan
const FILE_PATTERNS = [
  '**/*.xml',
  '**/*.java',
  '**/*.kt',
  '**/*.m',
  '**/*.swift',
  '**/*.plist',
  '**/*.storyboard',
  '**/*.html',
  '**/*.css',
  '**/*.json'
];

// Directories to scan
const SCAN_DIRS = [
  'platforms/android/app/src/main/res',
  'platforms/android/app/src/main/java',
  'platforms/ios',
  'platforms/android/CordovaLib/res',
  'www'
];

function scanDirectory(dir, oldColor, newColor, stats) {
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
      scanDirectory(fullPath, oldColor, newColor, stats);
    } else if (stat.isFile()) {
      // Check if file extension matches patterns
      const ext = path.extname(item);
      const validExts = ['.xml', '.java', '.kt', '.m', '.swift', '.plist', 
                        '.storyboard', '.html', '.css', '.json'];
      
      if (validExts.includes(ext)) {
        scanAndReplaceFile(fullPath, oldColor, newColor, stats);
      }
    }
  }
}

function scanAndReplaceFile(filePath, oldColor, newColor, stats) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Case-insensitive search for color
    const regex = new RegExp(oldColor.replace('#', '#?'), 'gi');
    const matches = content.match(regex);
    
    if (matches && matches.length > 0) {
      stats.filesFound++;
      stats.occurrences += matches.length;
      
      console.log(`   🔍 Found ${matches.length}x in: ${path.relative(stats.rootDir, filePath)}`);
      
      // Replace all occurrences
      content = content.replace(regex, newColor);
      fs.writeFileSync(filePath, content, 'utf8');
      
      stats.filesReplaced++;
      console.log(`      ✅ Replaced with ${newColor}`);
    }
  } catch (error) {
    // Skip binary files or permission errors
    if (!error.message.includes('EISDIR') && !error.message.includes('EACCES')) {
      console.log(`   ⚠️  Error scanning ${filePath}: ${error.message}`);
    }
  }
}

function hexToRgb(hex) {
  // Also search for RGB equivalents
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Get colors from config
  const newColor = config.getPreference("SplashScreenBackgroundColor") ||
                   config.getPreference("BackgroundColor");
  
  if (!newColor) {
    console.log('\n⏭️  No color configured for scanner, skipping');
    return;
  }
  
  // Colors to search for (common OutSystems theme colors)
  const OLD_COLORS = [
    '#59ABE3',  // Default blue
    '#5aabe3',  // Lowercase variant
    '59ABE3',   // Without #
    'rgb(89, 171, 227)',  // RGB format
    'rgba(89, 171, 227',  // RGBA format (partial match)
  ];
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🔍 COLOR SCANNER & REPLACER');
  console.log('══════════════════════════════════════════════');
  console.log(`New Color: ${newColor}`);
  console.log(`Scanning for old colors: ${OLD_COLORS.join(', ')}`);
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
    
    // Scan each old color
    for (const oldColor of OLD_COLORS) {
      const platformDir = path.join(root, `platforms/${platform}`);
      if (fs.existsSync(platformDir)) {
        scanDirectory(platformDir, oldColor, newColor, stats);
      }
    }
    
    // Also scan www folder
    const wwwDir = path.join(root, 'www');
    if (fs.existsSync(wwwDir)) {
      for (const oldColor of OLD_COLORS) {
        scanDirectory(wwwDir, oldColor, newColor, stats);
      }
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  if (stats.filesFound > 0) {
    console.log(`✅ Scan complete!`);
    console.log(`   Files scanned: ${stats.filesFound}`);
    console.log(`   Occurrences found: ${stats.occurrences}`);
    console.log(`   Files replaced: ${stats.filesReplaced}`);
    console.log(`\n   OLD: #59ABE3 → NEW: ${newColor}`);
  } else {
    console.log('✅ No old colors found - all clean!');
  }
  console.log('══════════════════════════════════════════════\n');
};
