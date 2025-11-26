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

module.exports = {
  getConfigPath,
  getConfigParser,
  isCordovaAbove,
  getCordovaVersion,
  isIOS,
  isAndroid,
  getIOSAppFolderName,
  getAndroidPackageName,
  safeWriteFile,
  isFileReadable,
  ensureDirectoryExists,
  logWithTimestamp
};