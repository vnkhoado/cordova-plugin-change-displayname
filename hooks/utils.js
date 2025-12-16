#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

/**
 * Get config.xml path for platform
 */
function getConfigPath(context, platform) {
  const root = context.opts.projectRoot;
  const platformPath = path.join(root, "platforms", platform);
  
  if (!fs.existsSync(platformPath)) {
    return null;
  }
  
  // Try platform-specific config first
  let configPath = path.join(platformPath, "config.xml");
  if (fs.existsSync(configPath)) {
    return configPath;
  }
  
  // Fallback to root config.xml
  configPath = path.join(root, "config.xml");
  if (fs.existsSync(configPath)) {
    return configPath;
  }
  
  return null;
}

/**
 * Get ConfigParser instance
 */
function getConfigParser(context, configPath) {
  const ConfigParser = context.requireCordovaModule("cordova-common").ConfigParser;
  return new ConfigParser(configPath);
}

/**
 * Check if Cordova version is above a specific version
 * @param {Object} context - Cordova context
 * @param {string} version - Version to compare (e.g., "9.0.0")
 * @returns {boolean}
 */
function isCordovaAbove(context, version) {
  try {
    const cordovaVersion = context.opts.cordova.version;
    
    if (!cordovaVersion) {
      return false;
    }
    
    const current = cordovaVersion.split('.').map(Number);
    const target = version.split('.').map(Number);
    
    for (let i = 0; i < Math.max(current.length, target.length); i++) {
      const currentPart = current[i] || 0;
      const targetPart = target[i] || 0;
      
      if (currentPart > targetPart) return true;
      if (currentPart < targetPart) return false;
    }
    
    return true; // Equal versions
  } catch (err) {
    console.warn("⚠ Could not determine Cordova version:", err.message);
    return true; // Assume modern version
  }
}

/**
 * Get Cordova version
 * @param {Object} context - Cordova context
 * @returns {string}
 */
function getCordovaVersion(context) {
  try {
    return context.opts.cordova.version || "unknown";
  } catch (err) {
    return "unknown";
  }
}

/**
 * Check if platform is iOS
 * @param {string} platform - Platform name
 * @returns {boolean}
 */
function isIOS(platform) {
  return platform === "ios";
}

/**
 * Check if platform is Android
 * @param {string} platform - Platform name
 * @returns {boolean}
 */
function isAndroid(platform) {
  return platform === "android";
}

/**
 * Get iOS app folder name
 * @param {string} root - Project root path
 * @returns {string|null}
 */
function getIOSAppFolderName(root) {
  const platformPath = path.join(root, "platforms/ios");
  
  if (!fs.existsSync(platformPath)) {
    return null;
  }
  
  const folders = fs.readdirSync(platformPath).filter(f => {
    const fullPath = path.join(platformPath, f);
    return (
      fs.statSync(fullPath).isDirectory() &&
      f !== "CordovaLib" &&
      f !== "www" &&
      f !== "cordova" &&
      f !== "build" &&
      f !== "DerivedData"
    );
  });
  
  return folders.length > 0 ? folders[0] : null;
}

/**
 * Get Android package name from build.gradle
 * @param {string} root - Project root path
 * @returns {string|null}
 */
function getAndroidPackageName(root) {
  const buildGradlePath = path.join(
    root,
    "platforms/android/app/build.gradle"
  );
  
  if (!fs.existsSync(buildGradlePath)) {
    return null;
  }
  
  try {
    const content = fs.readFileSync(buildGradlePath, "utf8");
    const match = content.match(/applicationId\s+"([^"]+)"/);
    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
}

/**
 * Safe file write with backup
 * @param {string} filePath - File path to write
 * @param {string} content - Content to write
 */
function safeWriteFile(filePath, content) {
  // Create backup if file exists
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + ".backup";
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch (err) {
      console.warn("⚠ Could not create backup:", err.message);
    }
  }
  
  // Write file
  fs.writeFileSync(filePath, content, "utf8");
}

/**
 * Check if file exists and is readable
 * @param {string} filePath - File path to check
 * @returns {boolean}
 */
function isFileReadable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Log with timestamp
 * @param {string} message - Message to log
 */
function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Convert hex color to RGB object (0.0 - 1.0 range)
 * @param {string} hex - Hex color (e.g., "#001833" or "001833")
 * @returns {{r: number, g: number, b: number}}
 */
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255.0;
  const g = parseInt(hex.substring(2, 4), 16) / 255.0;
  const b = parseInt(hex.substring(4, 6), 16) / 255.0;
  return { r, g, b };
}

/**
 * Convert RGB object to XML attribute string
 * @param {{r: number, g: number, b: number}} rgb - RGB object (0.0 - 1.0)
 * @param {number} precision - Decimal precision
 * @returns {string} - Format: 'red="0.000" green="0.000" blue="0.000"'
 */
function rgbToString(rgb, precision = 3) {
  return `red="${rgb.r.toFixed(precision)}" green="${rgb.g.toFixed(precision)}" blue="${rgb.b.toFixed(precision)}"`;
}

/**
 * Convert hex color to Swift UIColor code
 * @param {string} hex - Hex color (e.g., "#001833")
 * @returns {string} - Swift UIColor initialization code
 */
function hexToSwiftUIColor(hex) {
  const rgb = hexToRgb(hex);
  return `UIColor(red: ${rgb.r.toFixed(3)}, green: ${rgb.g.toFixed(3)}, blue: ${rgb.b.toFixed(3)}, alpha: 1.0)`;
}

/**
 * Convert hex color to Objective-C UIColor code
 * @param {string} hex - Hex color (e.g., "#001833")
 * @returns {string} - Objective-C UIColor code
 */
function hexToObjCUIColor(hex) {
  const rgb = hexToRgb(hex);
  return `[UIColor colorWithRed:${rgb.r.toFixed(3)} green:${rgb.g.toFixed(3)} blue:${rgb.b.toFixed(3)} alpha:1.0]`;
}

/**
 * Get background color preference from config
 * Tries multiple preference keys in order
 * @param {Object} config - ConfigParser instance
 * @returns {string|null} - Hex color or null
 */
function getBackgroundColorPreference(config) {
  return config.getPreference('SplashScreenBackgroundColor') ||
         config.getPreference('BackgroundColor') ||
         config.getPreference('WEBVIEW_BACKGROUND_COLOR') ||
         null;
}

// ============================================================================
// FILE SEARCH UTILITIES
// ============================================================================

/**
 * Find first file matching patterns in directory tree
 * @param {string} baseDir - Base directory to search
 * @param {string[]} patterns - Array of file name patterns to match
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {string|null} - Full path to first matching file, or null
 */
function findFile(baseDir, patterns, maxDepth = 3) {
  function searchDir(dir, depth = 0) {
    if (depth > maxDepth) return null;
    
    let items;
    try {
      items = fs.readdirSync(dir);
    } catch (error) {
      return null; // Skip permission errors
    }
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      let stat;
      
      try {
        stat = fs.statSync(fullPath);
      } catch (error) {
        continue; // Skip if can't stat
      }
      
      if (stat.isFile()) {
        for (const pattern of patterns) {
          if (item === pattern || item.endsWith(pattern)) {
            return fullPath;
          }
        }
      } else if (stat.isDirectory()) {
        // Skip common excluded directories
        if (['node_modules', 'build', 'Pods', '.git', 'DerivedData'].includes(item)) {
          continue;
        }
        const found = searchDir(fullPath, depth + 1);
        if (found) return found;
      }
    }
    
    return null;
  }
  
  return searchDir(baseDir);
}

/**
 * Find all files matching patterns in directory tree
 * @param {string} baseDir - Base directory to search
 * @param {string[]} patterns - Array of file name patterns to match
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {string[]} - Array of full paths to matching files
 */
function findAllFiles(baseDir, patterns, maxDepth = 3) {
  const results = [];
  
  function searchDir(dir, depth = 0) {
    if (depth > maxDepth) return;
    
    let items;
    try {
      items = fs.readdirSync(dir);
    } catch (error) {
      return; // Skip permission errors
    }
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      let stat;
      
      try {
        stat = fs.statSync(fullPath);
      } catch (error) {
        continue; // Skip if can't stat
      }
      
      if (stat.isFile()) {
        for (const pattern of patterns) {
          if (item === pattern || item.endsWith(pattern)) {
            results.push(fullPath);
            break; // Only add once per file
          }
        }
      } else if (stat.isDirectory()) {
        // Skip common excluded directories
        if (['node_modules', 'build', 'Pods', '.git', 'DerivedData'].includes(item)) {
          continue;
        }
        searchDir(fullPath, depth + 1);
      }
    }
  }
  
  searchDir(baseDir);
  return results;
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Log a formatted section header
 * @param {string} title - Section title
 */
function logSection(title) {
  console.log('\n══════════════════════════════════════════════');
  console.log(`  ${title}`);
  console.log('══════════════════════════════════════════════');
}

/**
 * Log section completion
 * @param {string} message - Completion message
 */
function logSectionComplete(message) {
  console.log('\n══════════════════════════════════════════════');
  console.log(message);
  console.log('══════════════════════════════════════════════\n');
}

module.exports = {
  // Config utilities
  getConfigPath,
  getConfigParser,
  isCordovaAbove,
  getCordovaVersion,
  
  // Platform utilities
  isIOS,
  isAndroid,
  getIOSAppFolderName,
  getAndroidPackageName,
  
  // File utilities
  safeWriteFile,
  isFileReadable,
  ensureDirectoryExists,
  findFile,
  findAllFiles,
  
  // Color utilities
  hexToRgb,
  rgbToString,
  hexToSwiftUIColor,
  hexToObjCUIColor,
  getBackgroundColorPreference,
  
  // Logging utilities
  logWithTimestamp,
  logSection,
  logSectionComplete
};