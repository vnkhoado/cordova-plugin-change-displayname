#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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
 * Read color preferences from config.xml
 * Supports both OLD_COLOR/SplashScreenBackgroundColor and AndroidWindowSplashScreenBackgroundColor
 * 
 * Priority:
 * 1. SplashScreenBackgroundColor (new color to set)
 * 2. AndroidWindowSplashScreenBackgroundColor (Cordova standard)
 * 3. Fallback to #001833
 */
function readColorConfigFromXml(configPath) {
  if (!fs.existsSync(configPath)) {
    log(colors.yellow, `⚠️  config.xml not found: ${configPath}`);
    return { 
      oldColor: '#1E1464',  // Cordova default to replace
      newColor: '#001833'   // Target color
    };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    
    // Read OLD_COLOR (Cordova default to replace)
    const oldColorMatch = content.match(
      /<preference\s+name=["']OLD_COLOR["']\s+value=["']([^"']+)["']/i
    );
    const oldColor = oldColorMatch ? oldColorMatch[1].trim() : '#1E1464';
    
    // Read NEW/TARGET color - try multiple preference names
    let newColor = '#001833'; // Safe default
    
    // Priority 1: SplashScreenBackgroundColor (custom preference)
    const bgColorMatch = content.match(
      /<preference\s+name=["']SplashScreenBackgroundColor["']\s+value=["']([^"']+)["']/i
    );
    if (bgColorMatch && bgColorMatch[1]) {
      newColor = bgColorMatch[1].trim();
    } else {
      // Priority 2: AndroidWindowSplashScreenBackgroundColor (Cordova standard)
      const androidBgMatch = content.match(
        /<preference\s+name=["']AndroidWindowSplashScreenBackgroundColor["']\s+value=["']([^"']+)["']/i
      );
      if (androidBgMatch && androidBgMatch[1]) {
        newColor = androidBgMatch[1].trim();
      }
    }
    
    // Normalize both colors
    const normalizedOldColor = normalizeHexColor(oldColor);
    const normalizedNewColor = normalizeHexColor(newColor);
    
    log(colors.blue, `📖 Config.xml colors:`);
    log(colors.reset, `   OLD_COLOR (to replace): ${normalizedOldColor}`);
    log(colors.reset, `   SplashScreenBackgroundColor (new): ${normalizedNewColor}`);
    
    return { 
      oldColor: normalizedOldColor, 
      newColor: normalizedNewColor 
    };
  } catch (error) {
    log(colors.yellow, `⚠️  Error reading config.xml: ${error.message}`);
    return { 
      oldColor: '#1E1464', 
      newColor: '#001833' 
    };
  }
}

/**
 * Get background color preference from config.xml
 * Wrapper around readColorConfigFromXml that returns just the new color
 */
function getBackgroundColorPreference(root) {
  const configPath = path.join(root, 'config.xml');
  const { newColor } = readColorConfigFromXml(configPath);
  return newColor;
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
  readColorConfigFromXml,
  getBackgroundColorPreference,
  ensurePathExists,
  readXmlFile,
  writeXmlFile,
  createCdvColorsTemplate,
  createCdvThemesTemplate,
  log,
  colors
};
