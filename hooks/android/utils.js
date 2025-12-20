#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Normalize hex color format
 * Accepts: #001833, 001833, #001833FF, etc.
 * Returns: #001833 (without alpha)
 */
function normalizeHexColor(color) {
  if (!color) return '#001833';
  
  // Remove # if present
  let hex = color.replace(/^#/, '');
  
  // Remove alpha channel if present (last 2 chars if 8 chars long)
  if (hex.length === 8) {
    hex = hex.substring(0, 6);
  }
  
  // Ensure 6 characters
  if (hex.length !== 6) {
    return '#001833'; // Fallback to default
  }
  
  return '#' + hex.toLowerCase();
}

/**
 * Get background color preference from config.xml
 * Looks for preference: <preference name="AndroidWindowSplashScreenBackgroundColor" value="#001833" />
 */
function getBackgroundColorPreference(root) {
  try {
    const configPath = path.join(root, 'config.xml');
    
    if (!fs.existsSync(configPath)) {
      return '#001833'; // Default fallback
    }
    
    const content = fs.readFileSync(configPath, 'utf8');
    
    // Try to find Android splash background color preference
    const patterns = [
      /name="AndroidWindowSplashScreenBackgroundColor"\s+value="([^"]+)"/,
      /name="SplashScreenDelay"\s+value="([^"]+)"/,
      /name="SplashMaintainAspectRatio"\s+value="([^"]+)"/
    ];
    
    // Look for background color specifically
    const bgColorMatch = content.match(/name="AndroidWindowSplashScreenBackgroundColor"\s+value="([^"]+)"/);
    
    if (bgColorMatch && bgColorMatch[1]) {
      return normalizeHexColor(bgColorMatch[1]);
    }
    
    // Fallback to default
    return '#001833';
  } catch (error) {
    console.error('Error reading config.xml:', error.message);
    return '#001833'; // Safe fallback
  }
}

/**
 * Ensure file/directory exists, create if missing
 */
function ensurePathExists(filePath) {
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read XML file safely
 */
function readXmlFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Write XML file safely
 */
function writeXmlFile(filePath, content) {
  try {
    ensurePathExists(filePath);
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Create minimal cdvcolors.xml template
 */
function createCdvColorsTemplate(backgroundColor) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<resources>
    <color name="cdv_splashscreen_background_color">${backgroundColor}</color>
</resources>
`;
}

/**
 * Create minimal cdvthemes.xml template
 */
function createCdvThemesTemplate() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<resources>
    <style name="cdv_splashscreen" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowBackground">@color/cdv_splashscreen_background_color</item>
        <item name="android:windowNoTitle">true</item>
    </style>
</resources>
`;
}

module.exports = {
  normalizeHexColor,
  getBackgroundColorPreference,
  ensurePathExists,
  readXmlFile,
  writeXmlFile,
  createCdvColorsTemplate,
  createCdvThemesTemplate
};
