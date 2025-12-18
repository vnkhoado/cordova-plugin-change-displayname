#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

/**
 * SIMPLIFIED: JSON-only config storage (NO SQLite)
 * 
 * Stores build configuration in:
 *   - www/.cordova-app-data/build-config.json (current config)
 *   - www/.cordova-app-data/build-history.json (build history - max 50)
 * 
 * Copies config-loader-mobile.js to www/js/
 * Injects script tag into index.html
 * 
 * ENHANCED:
 *   - Read API_HOSTNAME from environment variables (MABS)
 *   - Read from Cordova preferences (fallback)
 *   - Support multiple config sources
 */

/**
 * Get config value from multiple sources (priority order)
 */
function getConfigValue(envName, prefName, config, defaultValue = '') {
  // 1. Try environment variable (MABS builds)
  if (process.env[envName]) {
    console.log(`   ฿ Found ${prefName} from env: ${process.env[envName]}`);
    return process.env[envName];
  }
  
  // 2. Try Cordova preference
  const prefValue = config.getPreference(prefName);
  if (prefValue) {
    console.log(`   ฿ Found ${prefName} from preference: ${prefValue}`);
    return prefValue;
  }
  
  // 3. Default value
  if (defaultValue) {
    console.log(`   ⚠️  ${prefName} not found, using default: ${defaultValue}`);
  } else {
    console.log(`   ⚠️  ${prefName} not found, using empty string`);
  }
  return defaultValue;
}

/**
 * Write JSON file with verification
 */
function writeJSONWithVerification(filePath, data, description) {
  try {
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`   📁 Created directory: ${dir}`);
    }
    
    // Write file
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString, { encoding: 'utf8', flag: 'w' });
    
    // Immediate verification
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.length > 0 && stats.size > 0) {
        console.log(`   ✅ ${description}: ${stats.size} bytes`);
        return true;
      } else {
        console.error(`   ❌ ${description}: File is empty!`);
        return false;
      }
    } else {
      console.error(`   ❌ ${description}: File does not exist after write!`);
      console.error(`   📍 Path: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error writing ${description}:`, error.message);
    console.error(`   📍 Path: ${filePath}`);
    return false;
  }
}

/**
 * Create JSON build config file in multiple locations
 */
function createBuildConfigJSON(buildInfo, configPath, root, wwwPath) {
  const data = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    config: {
      appName: buildInfo.appName,
      appId: buildInfo.packageName,
      appVersion: buildInfo.versionNumber,
      appDescription: buildInfo.appDescription || '',
      platform: buildInfo.platform,
      author: buildInfo.author || '',
      buildDate: buildInfo.buildTime,
      buildTimestamp: buildInfo.buildTimestamp,
      environment: buildInfo.environment || 'production',
      apiHostname: buildInfo.apiHostname || '',
      cdnIcon: buildInfo.cdnIcon || ''
    }
  };
  
  // Primary location: platforms/android/app/src/main/assets/www/.cordova-app-data/
  const success1 = writeJSONWithVerification(configPath, data, 'build-config.json (platforms)');
  
  // Backup location 1: root www/.cordova-app-data/
  const rootWwwDir = path.join(root, 'www', '.cordova-app-data');
  const rootConfigPath = path.join(rootWwwDir, 'build-config.json');
  const success2 = writeJSONWithVerification(rootConfigPath, data, 'build-config.json (root www)');
  
  // Backup location 2: directly in www/ for easy access
  const wwwConfigPath = path.join(wwwPath, 'build-config.json');
  const success3 = writeJSONWithVerification(wwwConfigPath, data, 'build-config.json (www root)');
  
  if (!success1 && !success2 && !success3) {
    throw new Error('Failed to create build-config.json in any location!');
  }
}

/**
 * Update build history (max 50 entries)
 */
function updateBuildHistory(buildInfo, historyPath, root, wwwPath) {
  let history = [];
  
  // Load existing history
  if (fs.existsSync(historyPath)) {
    try {
      const content = fs.readFileSync(historyPath, 'utf8');
      const data = JSON.parse(content);
      history = data.history || [];
    } catch (error) {
      console.log('   ⚠️  Could not read history, starting fresh');
      history = [];
    }
  }
  
  // Add new entry
  history.push({
    timestamp: new Date().toISOString(),
    buildId: `build_${Date.now()}`,
    platform: buildInfo.platform,
    appVersion: buildInfo.versionNumber,
    appName: buildInfo.appName,
    environment: buildInfo.environment || 'production',
    success: true
  });
  
  // Keep only last 50
  if (history.length > 50) {
    history = history.slice(-50);
  }
  
  const data = {
    version: '1.0',
    count: history.length,
    lastUpdated: new Date().toISOString(),
    history: history
  };
  
  // Write to primary location
  const success1 = writeJSONWithVerification(historyPath, data, `build-history.json (${history.length} entries)`);
  
  // Write to backup locations
  const rootWwwDir = path.join(root, 'www', '.cordova-app-data');
  const rootHistoryPath = path.join(rootWwwDir, 'build-history.json');
  writeJSONWithVerification(rootHistoryPath, data, 'build-history.json (root www)');
  
  if (!success1) {
    console.log('   ⚠️  Primary build-history.json failed, but backup created');
  }
}

/**
 * Copy config loaders to app www/js/
 */
function copyConfigLoaders(wwwPath, root) {
  const jsDir = path.join(wwwPath, 'js');
  
  if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true });
  }
  
  const pluginDir = path.join(root, 'plugins/cordova-plugin-change-app-info');
  
  const files = [
    'config-loader.js',
    'config-loader-mobile.js'
  ];
  
  for (const file of files) {
    const source = path.join(pluginDir, 'www/js', file);
    const dest = path.join(jsDir, file);
    
    if (fs.existsSync(source)) {
      try {
        fs.copyFileSync(source, dest);
        
        // Verify copy
        if (fs.existsSync(dest)) {
          const stats = fs.statSync(dest);
          console.log(`   ✅ Copied: ${file} (${stats.size} bytes)`);
        } else {
          console.log(`   ❌ Copy failed: ${file}`);
        }
      } catch (error) {
        console.log(`   ❌ Error copying ${file}:`, error.message);
      }
    } else {
      console.log(`   ⚠️  Not found: ${file} at ${source}`);
    }
  }
}

/**
 * Inject config-loader-mobile.js script tag into index.html
 * IMPROVED: Better HTML parsing and insertion logic
 */
function injectScriptTag(wwwPath) {
  const indexPath = path.join(wwwPath, 'index.html');
  
  console.log(`   📄 Checking index.html at: ${indexPath}`);
  
  if (!fs.existsSync(indexPath)) {
    console.log('   ⚠️  index.html not found, skipping injection');
    return false;
  }
  
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    const originalLength = html.length;
    
    console.log(`   📝 Read index.html: ${originalLength} bytes`);
    
    // Remove old script tags (if any from previous versions)
    html = html.replace(/<script[^>]*src=['"build-info\.js['"[^>]*><\/script>\s*/g, '');
    html = html.replace(/<script[^>]*src=['"app_build_info\.js['"[^>]*><\/script>\s*/g, '');
    
    // Check if already injected
    if (html.includes('config-loader-mobile.js')) {
      console.log('   ℹ️  Script tag already present in HTML');
      return true;
    }
    
    // Create script tag
    const scriptTag = '<script src="js/config-loader-mobile.js"></script>';
    let inserted = false;
    
    // Strategy 1: Insert right after <head> tag
    if (html.includes('<head>')) {
      html = html.replace(
        /<head>/i,
        '<head>\n    ' + scriptTag
      );
      inserted = true;
      console.log('   📍 Inserted after <head> tag');
    }
    // Strategy 2: Insert before cordova.js
    else if (html.includes('cordova.js')) {
      html = html.replace(
        /<script[^>]*src=['"cordova\.js['"[^>]*><\/script>/,
        scriptTag + '\n    $&'
      );
      inserted = true;
      console.log('   📍 Inserted before cordova.js');
    }
    // Strategy 3: Insert before </head>
    else if (html.includes('</head>')) {
      html = html.replace(
        /<\/head>/i,
        '    ' + scriptTag + '\n  </head>'
      );
      inserted = true;
      console.log('   📍 Inserted before </head> tag');
    }
    // Strategy 4: Insert at start of <body>
    else if (html.includes('<body>')) {
      html = html.replace(
        /<body[^>]*>/i,
        '$&\n    ' + scriptTag
      );
      inserted = true;
      console.log('   📍 Inserted at start of <body>');
    }
    // Strategy 5: Insert before </body>
    else if (html.includes('</body>')) {
      html = html.replace(
        /<\/body>/i,
        '    ' + scriptTag + '\n</body>'
      );
      inserted = true;
      console.log('   📍 Inserted before </body> tag');
    }
    
    if (!inserted) {
      console.log('   ⚠️  Could not find insertion point in HTML');
      console.log('   📄 HTML structure:', html.substring(0, 500));
      return false;
    }
    
    // Write updated HTML
    fs.writeFileSync(indexPath, html, 'utf8');
    
    // Verify the write
    const verifyHtml = fs.readFileSync(indexPath, 'utf8');
    if (verifyHtml.includes('config-loader-mobile.js')) {
      console.log(`   ✅ Injected and verified: ${verifyHtml.length} bytes (was ${originalLength})`);
      return true;
    } else {
      console.log('   ❌ Injection verification failed!');
      return false;
    }
  } catch (error) {
    console.error('   ❌ Error injecting script:', error.message);
    return false;
  }
}

/**
 * Main inject function
 */
function injectBuildInfo(context, platform) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  console.log(`   📂 Project root: ${root}`);
  
  // Log all environment variables starting with API, APP, or MABS
  console.log('\n   🔍 Environment variables:');
  Object.keys(process.env)
    .filter(key => key.startsWith('API_') || key.startsWith('APP_') || key.startsWith('MABS_'))
    .forEach(key => {
      console.log(`   - ${key}: ${process.env[key]}`);
    });
  
  // Prepare build info with fallback chain
  const buildInfo = {
    appName: getConfigValue('APP_NAME', 'APP_NAME', config, config.name() || 'Unknown'),
    versionNumber: getConfigValue('VERSION_NUMBER', 'VERSION_NUMBER', config, config.version() || '0.0.0'),
    versionCode: getConfigValue('VERSION_CODE', 'VERSION_CODE', config, '0'),
    packageName: config.packageName() || 'unknown',
    appDescription: getConfigValue('APP_DESCRIPTION', 'APP_DESCRIPTION', config),
    author: getConfigValue('AUTHOR', 'AUTHOR', config),
    platform: platform,
    buildTime: new Date().toISOString(),
    buildTimestamp: Date.now(),
    apiHostname: getConfigValue('API_HOSTNAME', 'API_HOSTNAME', config),
    environment: getConfigValue('ENVIRONMENT', 'ENVIRONMENT', config, 'production'),
    cdnIcon: getConfigValue('CDN_ICON', 'CDN_ICON', config)
  };
  
  console.log('\n   📦 Build Info:');
  console.log(`   - appName: ${buildInfo.appName}`);
  console.log(`   - apiHostname: ${buildInfo.apiHostname || '(empty)'}`);
  console.log(`   - environment: ${buildInfo.environment}`);
  
  // Determine www path
  let wwwPath;
  if (platform === 'android') {
    wwwPath = path.join(root, 'platforms/android/app/src/main/assets/www');
  } else if (platform === 'ios') {
    wwwPath = path.join(root, 'platforms/ios/www');
  } else {
    console.log(`   ⚠️  Unknown platform: ${platform}`);
    return;
  }
  
  console.log(`   📂 WWW path: ${wwwPath}`);
  
  if (!fs.existsSync(wwwPath)) {
    console.log(`   ⚠️  www directory not found: ${wwwPath}`);
    return;
  }
  
  // Create config storage directory
  const cordovaDataDir = path.join(wwwPath, '.cordova-app-data');
  const configPath = path.join(cordovaDataDir, 'build-config.json');
  const historyPath = path.join(cordovaDataDir, 'build-history.json');
  
  console.log(`   📂 Config directory: ${cordovaDataDir}`);
  
  // Create JSON configs
  createBuildConfigJSON(buildInfo, configPath, root, wwwPath);
  updateBuildHistory(buildInfo, historyPath, root, wwwPath);
  
  // Copy config loaders
  copyConfigLoaders(wwwPath, root);
  
  // Inject script tag
  const injected = injectScriptTag(wwwPath);
  
  if (!injected) {
    console.log('   ⚠️  Script injection may have failed - check manually');
  }
}

/**
 * Module export
 */
module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  INJECT BUILD INFO (JSON Only - Enhanced)');
  console.log('══════════════════════════════════════════════');
  
  for (const platform of platforms) {
    console.log(`\n📱 ${platform}...`);
    try {
      injectBuildInfo(context, platform);
    } catch (error) {
      console.error(`\n❌ Error:`, error.message);
      console.error(error.stack);
      throw error;
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Completed!\n');
};