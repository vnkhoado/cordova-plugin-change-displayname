/**
 * Utility Functions for Cordova Plugin Color Management
 * 
 * Provides reusable functions for:
 * - Reading preferences from config.xml
 * - Color normalization and formatting
 * - Color preference retrieval with fallbacks
 */

const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

/**
 * Log helper function
 * @param {string} color - ANSI color code
 * @param {string} message - Message to log
 */
function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Extract preference value from config.xml by name
 * Searches for: <preference name="PREF_NAME" value="VALUE" />
 * 
 * @param {string} configContent - Content of config.xml
 * @param {string} preferenceName - Preference name to search for
 * @param {string} defaultValue - Default value if preference not found (default: '')
 * @returns {string} - Preference value or defaultValue
 * 
 * @example
 * getPreferenceValue(content, 'SplashScreenBackgroundColor', '#001833')
 * // Returns: value from config.xml or '#001833' if not found
 */
function getPreferenceValue(configContent, preferenceName, defaultValue = '') {
  if (!configContent || !preferenceName) return defaultValue;
  
  // Match: <preference name="PREF_NAME" value="VALUE" />
  // Also handles single quotes and extra whitespace
  const pattern = new RegExp(
    `<preference\\s+name=["']${preferenceName}["']\\s+value=["']([^"']+)["']`,
    'i'
  );
  
  const match = configContent.match(pattern);
  return match ? match[1].trim() : defaultValue;
}

/**
 * Normalize color format (with or without #)
 * 
 * @param {string} color - Color value
 * @returns {string} - Normalized color with #
 * 
 * @example
 * normalizeColor('#001833')  // Returns: '#001833'
 * normalizeColor('001833')   // Returns: '#001833'
 * normalizeColor('')         // Returns: '#001833' (default fallback)
 */
function normalizeColor(color) {
  if (!color) return '#001833';
  const trimmed = color.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Extract hex color without # prefix
 * 
 * @param {string} color - Color value
 * @returns {string} - Hex color without #
 * 
 * @example
 * getHexWithoutHash('#001833')  // Returns: '001833'
 * getHexWithoutHash('001833')   // Returns: '001833'
 */
function getHexWithoutHash(color) {
  const normalized = normalizeColor(color);
  return normalized.replace('#', '');
}

/**
 * Get background color preference from config.xml
 * Reads SplashScreenBackgroundColor preference with fallback to default
 * 
 * @param {string} configPath - Path to config.xml
 * @param {string} defaultColor - Default color if not found (default: #001833)
 * @returns {string} - Normalized color value with #
 * 
 * @example
 * getBackgroundColorPreference('/path/to/config.xml')
 * // Returns: color from config.xml or '#001833' if not found
 */
function getBackgroundColorPreference(configPath, defaultColor = '#001833') {
  if (!fs.existsSync(configPath)) {
    log(colors.yellow, `⚠️  config.xml not found: ${configPath}`);
    return normalizeColor(defaultColor);
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const colorValue = getPreferenceValue(
      configContent,
      'SplashScreenBackgroundColor',
      defaultColor
    );
    
    return normalizeColor(colorValue);
  } catch (error) {
    log(colors.yellow, `⚠️  Error reading config.xml: ${error.message}`);
    return normalizeColor(defaultColor);
  }
}

/**
 * Get old color preference from config.xml
 * Reads OLD_COLOR preference with fallback to default Cordova color
 * 
 * @param {string} configPath - Path to config.xml
 * @param {string} defaultColor - Default color if not found (default: #1E1464)
 * @returns {string} - Normalized color value with #
 * 
 * @example
 * getOldColorPreference('/path/to/config.xml')
 * // Returns: color from config.xml or '#1E1464' if not found
 */
function getOldColorPreference(configPath, defaultColor = '#1E1464') {
  if (!fs.existsSync(configPath)) {
    return normalizeColor(defaultColor);
  }

  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const colorValue = getPreferenceValue(
      configContent,
      'OLD_COLOR',
      defaultColor
    );
    
    return normalizeColor(colorValue);
  } catch (error) {
    return normalizeColor(defaultColor);
  }
}

/**
 * Read all color configuration from config.xml
 * Retrieves both OLD_COLOR and SplashScreenBackgroundColor
 * 
 * @param {string} configPath - Path to config.xml
 * @returns {object} - { oldColor, newColor } both normalized with #
 * 
 * @example
 * readColorConfigFromXml('/path/to/config.xml')
 * // Returns: { oldColor: '#1E1464', newColor: '#001833' }
 */
function readColorConfigFromXml(configPath) {
  if (!fs.existsSync(configPath)) {
    log(colors.yellow, `⚠️  config.xml not found: ${configPath}`);
    return { 
      oldColor: normalizeColor('#1E1464'), 
      newColor: normalizeColor('#001833') 
    };
  }

  try {
    const oldColor = getOldColorPreference(configPath);
    const newColor = getBackgroundColorPreference(configPath);
    
    log(colors.blue, `📖 Config.xml colors:`);
    log(colors.reset, `   OLD_COLOR (to replace): ${oldColor}`);
    log(colors.reset, `   SplashScreenBackgroundColor (new): ${newColor}`);
    
    return { oldColor, newColor };
  } catch (error) {
    log(colors.yellow, `⚠️  Error reading config.xml: ${error.message}`);
    return { 
      oldColor: normalizeColor('#1E1464'), 
      newColor: normalizeColor('#001833') 
    };
  }
}

// Export all utility functions
module.exports = {
  getPreferenceValue,
  normalizeColor,
  getHexWithoutHash,
  getBackgroundColorPreference,
  getOldColorPreference,
  readColorConfigFromXml,
  log,
  colors
};
