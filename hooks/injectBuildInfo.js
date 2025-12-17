#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getConfigParser } = require("./utils");

let Database;
let hasBetterSqlite3 = true;

try {
  Database = require("better-sqlite3");
} catch (e) {
  hasBetterSqlite3 = false;
  console.log("\n⚠️  better-sqlite3 not available.");
  console.log("   Build will continue with fallback handlers.");
  console.log("   To enable SQLite database: npm install better-sqlite3\n");
}

/**
 * Creat SQLite database READ-ONLY with build info (minimal)
 * Falls back to file-based storage if better-sqlite3 unavailable
 */
function createBuildInfoDatabase(buildInfo, dbPath) {
  if (!hasBetterSqlite3) {
    // Fallback: Create JSON file instead
    const jsonPath = dbPath.replace('.db', '.json');
    console.log(`📁 Creating fallback JSON build info: ${jsonPath}`);
    
    const jsonData = {
      id: 1,
      app_name: buildInfo.appName,
      version_number: buildInfo.versionNumber,
      version_code: buildInfo.versionCode,
      package_name: buildInfo.packageName,
      platform: buildInfo.platform,
      build_time: buildInfo.buildTime,
      build_timestamp: buildInfo.buildTimestamp,
      api_hostname: buildInfo.apiHostname,
      environment: buildInfo.environment,
      updated_at: new Date().toISOString(),
      storage_type: 'json-fallback'
    };
    
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`   ✅ Fallback JSON created`);
    return;
  }
  
  console.log(`📦 Creating READ-ONLY SQLite database: ${dbPath}`);
  
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`   Removed old database`);
  }
  
  const db = new Database(dbPath);
  
  try {
    db.pragma('journal_mode = WAL');
    
    // Simplified schema - only essential build info
    db.exec(`
      CREATE TABLE IF NOT EXISTS build_info (
        id INTEGER PRIMARY KEY,
        app_name TEXT,
        version_number TEXT,
        version_code TEXT,
        package_name TEXT,
        platform TEXT,
        build_time TEXT,
        build_timestamp INTEGER,
        api_hostname TEXT,
        environment TEXT,
        updated_at TEXT
      )
    `);
    
    console.log(`   ✅ Table created (minimal schema)`);
    
    const insertBuildInfo = db.prepare(`
      INSERT INTO build_info 
      (id, app_name, version_number, version_code, package_name, platform, 
       build_time, build_timestamp, api_hostname, environment, updated_at) 
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertBuildInfo.run(
      buildInfo.appName,
      buildInfo.versionNumber,
      buildInfo.versionCode,
      buildInfo.packageName,
      buildInfo.platform,
      buildInfo.buildTime,
      buildInfo.buildTimestamp,
      buildInfo.apiHostname,
      buildInfo.environment,
      new Date().toISOString()
    );
    
    console.log(`   ✅ Build info inserted`);
    
    const row = db.prepare('SELECT * FROM build_info WHERE id = 1').get();
    if (row) {
      console.log(`   ✅ Verified: ${row.app_name} v${row.version_number}`);
    }
    
    db.close();
    console.log(`   ✅ READ-ONLY database created`);
    
  } catch (error) {
    db.close();
    throw error;
  }
}

function copyDatabaseToAndroid(dbPath, root) {
  const assetsPath = path.join(root, "platforms/android/app/src/main/assets");
  
  if (!fs.existsSync(assetsPath)) {
    fs.mkdirSync(assetsPath, { recursive: true });
  }
  
  // Copy SQLite DB if exists
  if (fs.existsSync(dbPath)) {
    const destPath = path.join(assetsPath, "app_build_info.db");
    fs.copyFileSync(dbPath, destPath);
    console.log(`   ✅ Copied SQLite DB to Android assets`);
  }
  
  // Also copy JSON fallback if exists
  const jsonPath = dbPath.replace('.db', '.json');
  if (fs.existsSync(jsonPath)) {
    const jsonDestPath = path.join(assetsPath, "app_build_info.json");
    fs.copyFileSync(jsonPath, jsonDestPath);
    console.log(`   ✅ Copied JSON fallback to Android assets`);
  }
}

function copyDatabaseToIOS(dbPath, root, config) {
  const xcode = require('xcode');
  const iosPath = path.join(root, "platforms/ios");
  
  if (!fs.existsSync(iosPath)) {
    console.log("   ⚠️  iOS platform not found");
    return;
  }
  
  const projectName = config.name();
  const resourcesPath = path.join(iosPath, projectName, "Resources");
  
  if (!fs.existsSync(resourcesPath)) {
    fs.mkdirSync(resourcesPath, { recursive: true });
  }
  
  // Copy SQLite DB if exists
  if (fs.existsSync(dbPath)) {
    const destPath = path.join(resourcesPath, "app_build_info.db");
    fs.copyFileSync(dbPath, destPath);
    console.log(`   ✅ Copied SQLite DB to iOS Resources`);
  }
  
  // Also copy JSON fallback if exists
  const jsonPath = dbPath.replace('.db', '.json');
  if (fs.existsSync(jsonPath)) {
    const jsonDestPath = path.join(resourcesPath, "app_build_info.json");
    fs.copyFileSync(jsonPath, jsonDestPath);
    console.log(`   ✅ Copied JSON fallback to iOS Resources`);
  }
  
  try {
    const pbxprojPath = path.join(iosPath, `${projectName}.xcodeproj/project.pbxproj`);
    
    if (fs.existsSync(pbxprojPath)) {
      const proj = xcode.project(pbxprojPath);
      proj.parseSync();
      
      // Add DB file
      if (fs.existsSync(dbPath)) {
        const dbFileRelPath = `${projectName}/Resources/app_build_info.db`;
        const existingFile = proj.hasFile(dbFileRelPath);
        
        if (!existingFile) {
          proj.addResourceFile(dbFileRelPath);
          fs.writeFileSync(pbxprojPath, proj.writeSync());
          console.log(`   ✅ Added DB to Xcode project`);
        }
      }
      
      // Add JSON fallback file
      if (fs.existsSync(jsonPath)) {
        const jsonFileRelPath = `${projectName}/Resources/app_build_info.json`;
        const existingJsonFile = proj.hasFile(jsonFileRelPath);
        
        if (!existingJsonFile) {
          proj.addResourceFile(jsonFileRelPath);
          fs.writeFileSync(pbxprojPath, proj.writeSync());
          console.log(`   ✅ Added JSON fallback to Xcode project`);
        }
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Xcode update skipped`);
  }
}

function createHelperJS(wwwPath, buildInfo) {
  const isProduction = buildInfo.environment === 'production';
  const storageType = hasBetterSqlite3 ? 'sqlite-readonly' : 'json-fallback';
  
  const helperContent = `
// Auto-generated by cordova-plugin-change-app-info v2.9.10
// READ-ONLY version - Essential build info only
// Storage Type: ${storageType}

(function() {
  'use strict';
  
  var IS_PRODUCTION = ${isProduction};
  var STORAGE_TYPE = '${storageType}';
  var db = null;
  var buildInfoCache = null;
  var isInitialized = false;
  var eventFired = false;
  
  function safeLog(message, data) {
    if (!IS_PRODUCTION) {
      console.log(message, data || '');
    }
  }
  
  function safeError(message, error) {
    if (!IS_PRODUCTION) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
  
  document.addEventListener('deviceready', function() {
    if (STORAGE_TYPE === 'sqlite-readonly') {
      initDatabase();
    } else {
      initJSONFallback();
    }
  }, false);
  
  function initDatabase() {
    try {
      if (!window.sqlitePlugin) {
        safeError('[Build Info] SQLite plugin not found. Using fallback...');
        initJSONFallback();
        return;
      }
      
      db = window.sqlitePlugin.openDatabase({
        name: 'app_build_info.db',
        location: 'default',
        createFromLocation: 1,
        androidDatabaseProvider: 'system'
      });
      
      safeLog('[Build Info] Database opened (READ-ONLY)');
      loadBuildInfo();
      
    } catch (e) {
      safeError('[Build Info] Failed to open database:', e);
      initJSONFallback();
    }
  }
  
  function initJSONFallback() {
    safeLog('[Build Info] Using JSON fallback storage');
    loadBuildInfoFromJSON();
  }
  
  function loadBuildInfo() {
    if (!db) return;
    
    db.transaction(function(tx) {
      tx.executeSql('SELECT * FROM build_info WHERE id = 1', [], function(tx, result) {
        if (result.rows.length > 0) {
          var info = result.rows.item(0);
          
          buildInfoCache = {
            appName: info.app_name,
            versionNumber: info.version_number,
            versionCode: info.version_code,
            packageName: info.package_name,
            platform: info.platform,
            buildTime: info.build_time,
            buildTimestamp: info.build_timestamp,
            apiHostname: info.api_hostname,
            environment: info.environment,
            storageType: 'sqlite-readonly'
          };
          
          isInitialized = true;
          
          safeLog('[Build Info] Loaded');
          safeLog('[Build Info] ' + info.app_name + ' v' + info.version_number);
          
          fireReadyEvent();
        }
      }, function(tx, error) {
        safeError('[Build Info] Load failed:', error);
        initJSONFallback();
      });
    });
  }
  
  function loadBuildInfoFromJSON() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'app_build_info.json', false);
      xhr.send();
      
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        
        buildInfoCache = {
          appName: data.app_name,
          versionNumber: data.version_number,
          versionCode: data.version_code,
          packageName: data.package_name,
          platform: data.platform,
          buildTime: data.build_time,
          buildTimestamp: data.build_timestamp,
          apiHostname: data.api_hostname,
          environment: data.environment,
          storageType: 'json-fallback'
        };
        
        isInitialized = true;
        
        safeLog('[Build Info] Loaded from JSON');
        safeLog('[Build Info] ' + data.app_name + ' v' + data.version_number);
        
        fireReadyEvent();
      }
    } catch (e) {
      safeError('[Build Info] JSON fallback failed:', e);
    }
  }
  
  function fireReadyEvent() {
    if (eventFired) return;
    eventFired = true;
    
    var event = new CustomEvent('buildInfoReady', { 
      detail: Object.freeze(Object.assign({}, buildInfoCache))
    });
    document.dispatchEvent(event);
    
    safeLog('[Build Info] Event fired: buildInfoReady');
  }
  
  // PUBLIC API - READ-ONLY
  window.AppBuildInfo = {
    getData: function() {
      if (!isInitialized) {
        throw new Error('Not initialized. Wait for buildInfoReady event or use waitForReady().');
      }
      return Object.freeze(Object.assign({}, buildInfoCache));
    },
    
    isReady: function() {
      return isInitialized;
    },
    
    // NEW: Wait for initialization with promise
    waitForReady: function(timeout) {
      timeout = timeout || 5000; // 5 seconds default
      
      return new Promise(function(resolve, reject) {
        if (isInitialized) {
          resolve(Object.freeze(Object.assign({}, buildInfoCache)));
          return;
        }
        
        var timer = setTimeout(function() {
          document.removeEventListener('buildInfoReady', onReady);
          reject(new Error('Timeout waiting for build info'));
        }, timeout);
        
        function onReady(event) {
          clearTimeout(timer);
          resolve(event.detail);
        }
        
        document.addEventListener('buildInfoReady', onReady, { once: true });
      });
    },
    
    getBuildTimestamp: function() {
      return isInitialized ? buildInfoCache.buildTimestamp : null;
    },
    
    getApiHostname: function() {
      return isInitialized ? buildInfoCache.apiHostname : null;
    },
    
    isProduction: function() {
      return isInitialized && buildInfoCache.environment === 'production';
    },
    
    getStorageType: function() {
      return STORAGE_TYPE;
    }
  };
  
  Object.freeze(window.AppBuildInfo);
  
  // Legacy API (deprecated)
  if (!IS_PRODUCTION) {
    Object.defineProperty(window, 'APP_BUILD_INFO', {
      get: function() {
        console.warn('[DEPRECATED] Use AppBuildInfo.getData()');
        return buildInfoCache ? Object.freeze(Object.assign({}, buildInfoCache)) : null;
      },
      set: function() {
        console.error('[READONLY] Cannot modify');
      }
    });
  }
  
})();
`;
  
  const helperPath = path.join(wwwPath, "build-info-helper.js");
  fs.writeFileSync(helperPath, helperContent, "utf8");
  console.log(`   ✅ Created helper JS (${storageType})`);
}

function injectScriptTag(wwwPath) {
  const indexPath = path.join(wwwPath, "index.html");
  
  if (!fs.existsSync(indexPath)) {
    return;
  }
  
  let html = fs.readFileSync(indexPath, "utf8");
  html = html.replace(/<script[^>]*src=["']build-info\.js["'][^>]*><\/script>\s*/g, '');
  
  if (html.includes('build-info-helper.js')) {
    return;
  }
  
  const scriptTag = '    <script src="build-info-helper.js"></script>';
  
  if (html.includes('cordova.js')) {
    html = html.replace(
      /<script[^>]*src=["']cordova\.js["'][^>]*><\/script>/,
      scriptTag + '\n    $&'
    );
  } else if (html.includes("</head>")) {
    html = html.replace("</head>", scriptTag + '\n  </head>');
  }
  
  fs.writeFileSync(indexPath, html, "utf8");
  console.log(`   ✅ Injected script tag`);
}

function injectBuildInfo(context, platform) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, "config.xml"));
  
  const buildInfo = {
    appName: config.getPreference("APP_NAME") || config.name() || "Unknown",
    versionNumber: config.getPreference("VERSION_NUMBER") || config.version() || "0.0.0",
    versionCode: config.getPreference("VERSION_CODE") || "0",
    packageName: config.packageName() || "unknown",
    platform: platform,
    buildTime: new Date().toISOString(),
    buildTimestamp: Date.now(),
    apiHostname: config.getPreference("API_HOSTNAME") || "",
    environment: config.getPreference("ENVIRONMENT") || "production"
  };
  
  const tmpDbPath = path.join(root, "app_build_info.db");
  createBuildInfoDatabase(buildInfo, tmpDbPath);
  
  let wwwPath;
  if (platform === "android") {
    wwwPath = path.join(root, "platforms/android/app/src/main/assets/www");
    copyDatabaseToAndroid(tmpDbPath, root);
  } else if (platform === "ios") {
    wwwPath = path.join(root, "platforms/ios/www");
    copyDatabaseToIOS(tmpDbPath, root, config);
  }
  
  // Clean up temp files
  if (fs.existsSync(tmpDbPath)) fs.unlinkSync(tmpDbPath);
  const tmpJsonPath = tmpDbPath.replace('.db', '.json');
  if (fs.existsSync(tmpJsonPath)) fs.unlinkSync(tmpJsonPath);
  
  if (fs.existsSync(wwwPath)) {
    createHelperJS(wwwPath, buildInfo);
    injectScriptTag(wwwPath);
  }
  
  console.log(`\n   ✅ Build info created (${hasBetterSqlite3 ? 'SQLite' : 'JSON Fallback'})`);
  console.log(`   ${buildInfo.appName} v${buildInfo.versionNumber}`);
  console.log(`   Environment: ${buildInfo.environment}`);
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  console.log("\n══════════════════════════════════════════════");
  console.log(`  BUILD INFO v2.9.10 (${hasBetterSqlite3 ? 'SQLite' : 'JSON Fallback'})`);
  console.log("\u2550═════════════════════════════════════════════");
  
  for (const platform of platforms) {
    console.log(`\n📱 ${platform}...`);
    try {
      injectBuildInfo(context, platform);
    } catch (error) {
      console.error(`\n❌ Error:`, error);
      throw error;
    }
  }
  
  console.log("\n══════════════════════════════════════════════");
  console.log("✅ Completed!\n");
};
