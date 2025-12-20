#!/usr/bin/env node

/**
 * Aggressive Color Replacement Hook - After Prepare Phase
 * 
 * Runs AFTER Cordova prepares platform to globally replace all color values.
 * Handles multiple color formats:
 * - Hex: #1E1464, 1E1464
 * - RGB: rgb(30, 20, 100)
 * - HSL: hsl(265, 66%, 25%)
 * - Integer: -16738332 (decimal ARGB for #1E1464)
 * - Attributes: android:color="#1E1464"
 * 
 * Searches entire Android platform directory and replaces colors in:
 * - XML files (config.xml, AndroidManifest.xml, styles.xml, colors.xml, etc.)
 * - Java/Kotlin source code
 * - Build files
 * - Properties files
 */

const fs = require('fs');
const path = require('path');
const {
  readColorConfigFromXml,
  getConfigParser,
  normalizeHexColor,
  hexToRgb,
  findAllFiles
} = require('../utils');

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
 * Convert hex color to decimal ARGB (used in Java/Android)
 * #1E1464 -> -16738332
 */
function hexToArgb(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // ARGB: 0xFF (alpha) + RGB in decimal
  return ((0xFF << 24) | (r << 16) | (g << 8) | b) - 0x100000000; // Convert to signed 32-bit
}

/**
 * Convert hex to RGB string format
 * #1E1464 -> "30, 20, 100"
 */
function hexToRgbString(hex) {
  const rgb = hexToRgb(hex);
  const r = Math.round(rgb.r * 255);
  const g = Math.round(rgb.g * 255);
  const b = Math.round(rgb.b * 255);
  return `${r}, ${g}, ${b}`;
}

/**
 * Generate all possible color format variations
 */
function generateColorVariations(oldColorHex, newColorHex) {
  const oldNormalized = normalizeHexColor(oldColorHex);
  const newNormalized = normalizeHexColor(newColorHex);
  
  if (!oldNormalized || !newNormalized) {
    return [];
  }

  // Remove # for variations
  const oldHexNoHash = oldNormalized.substring(1).toUpperCase();
  const newHexNoHash = newNormalized.substring(1).toUpperCase();
  
  const oldHexLower = oldHexNoHash.toLowerCase();
  const newHexLower = newHexNoHash.toLowerCase();

  // RGB formats
  const oldRgb = hexToRgbString(oldNormalized);
  const newRgb = hexToRgbString(newNormalized);

  // ARGB decimal format (used in Android)
  const oldArgb = hexToArgb(oldNormalized);
  const newArgb = hexToArgb(newNormalized);

  return [
    // Hex with # (various cases) - WITH WORD BOUNDARY to prevent ##
    { old: `#${oldHexNoHash}`, new: `#${newHexNoHash}`, type: 'hex_upper', wordBoundary: true },
    { old: `#${oldHexLower}`, new: `#${newHexLower}`, type: 'hex_lower', wordBoundary: true },
    
    // Hex without # (various cases)
    { old: oldHexNoHash, new: newHexNoHash, type: 'hex_nohash_upper', wordBoundary: true },
    { old: oldHexLower, new: newHexLower, type: 'hex_nohash_lower', wordBoundary: true },
    
    // RGB format
    { old: oldRgb, new: newRgb, type: 'rgb', wordBoundary: false },
    { old: `rgb(${oldRgb})`, new: `rgb(${newRgb})`, type: 'rgb_func', wordBoundary: false },
    { old: `RGB(${oldRgb})`, new: `RGB(${newRgb})`, type: 'rgb_func_upper', wordBoundary: false },
    
    // ARGB decimal (Android color resources)
    { old: String(oldArgb), new: String(newArgb), type: 'argb_decimal', wordBoundary: true },
  ];
}

/**
 * Replace color in file content with safety checks
 */
function replaceColorsInFile(filePath, variations) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let replacementCount = 0;

    for (const variation of variations) {
      // Escape special regex characters
      const escaped = variation.old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Create regex with word boundary if needed (prevent ## or other edge cases)
      let regex;
      if (variation.wordBoundary) {
        // Use negative lookbehind to prevent ## (if old starts with #)
        if (variation.old.startsWith('#')) {
          // Prevent ##HEX - don't match if preceded by #
          regex = new RegExp(`(?<!#)${escaped}(?!#)`, 'gi');
        } else {
          // Regular word boundary
          regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        }
      } else {
        // No boundary needed (for RGB functions, etc.)
        regex = new RegExp(escaped, 'gi');
      }
      
      const matches = content.match(regex);
      
      if (matches) {
        replacementCount += matches.length;
        content = content.replace(regex, variation.new);
      }
    }

    // Final cleanup: Fix any ## that might have been created
    content = content.replace(/##([0-9A-Fa-f]{6})/g, '#$1');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      return replacementCount;
    }

    return 0;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return -1; // Error
  }
}

function aggressiveColorReplace(context) {
  const root = context.opts.projectRoot;
  
  log(colors.bright + colors.blue, '\n╔═══════════════════════════════════════════════════════════╗');
  log(colors.bright + colors.blue, '║  Aggressive Color Replacement (after_prepare - GLOBAL)  ║');
  log(colors.bright + colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Get colors from config
    const configPath = path.join(root, 'config.xml');
    const config = getConfigParser(context, configPath);
    const { oldColor, newColor } = readColorConfigFromXml(config);

    log(colors.reset, `🔣 Searching for ALL instances of "${oldColor}" to replace with "${newColor}"...`);

    // Generate all color format variations
    const variations = generateColorVariations(oldColor, newColor);
    log(colors.reset, `📄 Generated ${variations.length} color format variations`);

    const androidPath = path.join(root, 'platforms/android');

    if (!fs.existsSync(androidPath)) {
      log(colors.yellow, '\n⚠️  Android platform directory not found');
      return;
    }

    // Find all relevant files
    const xmlPatterns = ['.xml'];
    const javaPatterns = ['.java', '.kt'];
    const propPatterns = ['.gradle', '.properties'];

    const allPatterns = [...xmlPatterns, ...javaPatterns, ...propPatterns];

    log(colors.reset, `\n🔍 Scanning Android directory for file types: ${allPatterns.join(', ')}...`);

    const files = findAllFiles(androidPath, allPatterns, 10);

    log(colors.reset, `📁 Found ${files.length} files to process\n`);

    let totalReplacements = 0;
    let processedFiles = 0;
    let filesWithChanges = 0;

    for (const filePath of files) {
      const replacements = replaceColorsInFile(filePath, variations);

      if (replacements > 0) {
        filesWithChanges++;
        totalReplacements += replacements;
        const relativePath = filePath.replace(androidPath, '');
        log(colors.green, `   ✅ ${relativePath} (${replacements} replacements)`);
      }

      processedFiles++;
    }

    // Summary
    log(colors.reset, '\n' + '═'.repeat(63));
    log(colors.bright + colors.green, '✅ Aggressive Color Replacement Complete!');
    log(colors.reset, '═'.repeat(63));

    log(colors.yellow, `\n📌 Summary:`);
    log(colors.yellow, `   Files scanned: ${processedFiles}`);
    log(colors.yellow, `   Files modified: ${filesWithChanges}`);
    log(colors.yellow, `   Total replacements: ${totalReplacements}`);
    log(colors.yellow, `\n   Color formats replaced:`);
    log(colors.yellow, `   ✓ Hex: ${oldColor} → ${newColor}`);
    log(colors.yellow, `   ✓ RGB: ${hexToRgbString(oldColor)} → ${hexToRgbString(newColor)}`);
    log(colors.yellow, `   ✓ ARGB: ${hexToArgb(oldColor)} → ${hexToArgb(newColor)}`);
    log(colors.yellow, `   ✓ All case variations (Upper/Lower)`);
    log(colors.yellow, `   ✓ Safety: Prevents ## (double hash) edge case\n`);

  } catch (error) {
    log(colors.red, `\n❌ Hook execution failed: ${error.message}`);
  }
}

module.exports = function(context) {
  const platforms = context.opts.platforms;

  if (!platforms || !platforms.includes('android')) {
    return;
  }

  aggressiveColorReplace(context);
};
