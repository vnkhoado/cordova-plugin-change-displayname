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
 * Removed:
 *   - better-sqlite3 dependency
 *   - SQLite database creation
 *   - Xcode project modification
 *   - SQLite fallback logic (JSON is now primary)
 */

/**
 * Create JSON build config file
 */
function createBuildConfigJSON(buildInfo, configPath) {
  const configDir = path.dirname(configPath);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
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
  
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`   ✅ Created: build-config.json`);
}

/**
 * Update build history (max 50 entries)
 */
function updateBuildHistory(buildInfo, historyPath) {
  const historyDir = path.dirname(historyPath);
  
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  
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
  
  fs.writeFileSync(historyPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`   ✅ Updated: build-history.json (${history.length} entries)`);
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
      fs.copyFileSync(source, dest);
      console.log(`   ✅ Copied: ${file}`);
    } else {
      console.log(`   ⚠️  Not found: ${file}`);
    }
  }
}

/**
 * Inject config-loader-mobile.js script tag into index.html
 */
function injectScriptTag(wwwPath) {
  const indexPath = path.join(wwwPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.log('   ⚠️  index.html not found, skipping injection');
    return;
  }
  
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Remove old script tags (if any from previous versions)
  html = html.replace(/<script[^>]*src=['"]build-info\.js['"][^>]*><\/script>\s*/g, '');
  html = html.replace(/<script[^>]*src=['"]app_build_info\.js['"][^>]*><\/script>\s*/g, '');
  
  // Check if already injected
  if (html.includes('config-loader-mobile.js')) {
    console.log('   ℹ️  Script tag already present');
    return;
  }
  
  // Create script tag
  const scriptTag = '    <script src="js/config-loader-mobile.js"></script>';
  
  // Try to insert before cordova.js
  if (html.includes('cordova.js')) {
    html = html.replace(
      /<script[^>]*src=['"]cordova\.js['"][^>]*><\/script>/,
      scriptTag + '\n    $&'
    );
  }
  // Otherwise insert before </head>
  else if (html.includes('</head>')) {
    html = html.replace('</head>', scriptTag + '\n  </head>');
  }
  // Otherwise insert before </body>
  else if (html.includes('</body>')) {
    html = html.replace('</body>', scriptTag + '\n</body>');
  } else {
    console.log('   ⚠️  Could not find insertion point in HTML');
    return;
  }
  
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('   ✅ Injected: <script src="js/config-loader-mobile.js"></script>');
}

/**
 * Main inject function
 */
function injectBuildInfo(context, platform) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Prepare build info
  const buildInfo = {
    appName: config.getPreference('APP_NAME') || config.name() || 'Unknown',
    versionNumber: config.getPreference('VERSION_NUMBER') || config.version() || '0.0.0',
    versionCode: config.getPreference('VERSION_CODE') || '0',
    packageName: config.packageName() || 'unknown',
    appDescription: config.getPreference('APP_DESCRIPTION') || '',
    author: config.getPreference('AUTHOR') || '',
    platform: platform,
    buildTime: new Date().toISOString(),
    buildTimestamp: Date.now(),
    apiHostname: config.getPreference('API_HOSTNAME') || '',
    environment: config.getPreference('ENVIRONMENT') || 'production',
    cdnIcon: config.getPreference('CDN_ICON') || ''
  };
  
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
  
  if (!fs.existsSync(wwwPath)) {
    console.log(`   ⚠️  www directory not found: ${wwwPath}`);
    return;
  }
  
  // Create config storage directory
  const cordovaDataDir = path.join(wwwPath, '.cordova-app-data');
  const configPath = path.join(cordovaDataDir, 'build-config.json');
  const historyPath = path.join(cordovaDataDir, 'build-history.json');
  
  // Create JSON configs
  createBuildConfigJSON(buildInfo, configPath);
  updateBuildHistory(buildInfo, historyPath);
  
  // Copy config loaders
  copyConfigLoaders(wwwPath, root);
  
  // Inject script tag
  injectScriptTag(wwwPath);
}

/**
 * Module export
 */
module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  INJECT BUILD INFO (JSON Only - No SQLite)');
  console.log('══════════════════════════════════════════════');
  
  for (const platform of platforms) {
    console.log(`\n📱 ${platform}...`);
    try {
      injectBuildInfo(context, platform);
    } catch (error) {
      console.error(`\n❌ Error:`, error.message);
      throw error;
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Completed!\n');
};
