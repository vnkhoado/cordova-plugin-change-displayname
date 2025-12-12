#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getConfigParser } = require("./utils");

let Database;
try {
  Database = require("better-sqlite3");
} catch (e) {
  console.error("\n⚠️  better-sqlite3 not installed. Run: npm install better-sqlite3");
  process.exit(1);
}

/**
 * Tạo SQLite database với build info
 */
function createBuildInfoDatabase(buildInfo, dbPath) {
  console.log(`📦 Creating SQLite database: ${dbPath}`);
  
  // Xóa database cũ nếu tồn tại
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log(`   Removed old database`);
  }
  
  // Tạo database mới
  const db = new Database(dbPath);
  
  try {
    // Bật WAL mode để cải thiện performance
    db.pragma('journal_mode = WAL');
    
    // Tạo bảng build_info
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
        api_base_url TEXT,
        environment TEXT,
        cdn_icon TEXT,
        updated_at TEXT
      )
    `);
    
    // Tạo bảng install_history
    db.exec(`
      CREATE TABLE IF NOT EXISTS install_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version_number TEXT,
        version_code TEXT,
        install_time TEXT,
        install_type TEXT,
        previous_version TEXT
      )
    `);
    
    // Tạo bảng user_data
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_data (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )
    `);
    
    // Tạo bảng app_settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      )
    `);
    
    console.log(`   ✓ Tables created`);
    
    // Insert build info
    const insertBuildInfo = db.prepare(`
      INSERT OR REPLACE INTO build_info 
      (id, app_name, version_number, version_code, package_name, platform, 
       build_time, build_timestamp, api_hostname, api_base_url, environment, 
       cdn_icon, updated_at) 
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      buildInfo.apiBaseUrl,
      buildInfo.environment,
      buildInfo.cdnIcon,
      new Date().toISOString()
    );
    
    console.log(`   ✓ Build info inserted`);
    
    // Insert initial install record
    const insertInstallHistory = db.prepare(`
      INSERT INTO install_history 
      (version_number, version_code, install_time, install_type, previous_version) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertInstallHistory.run(
      buildInfo.versionNumber,
      buildInfo.versionCode,
      buildInfo.buildTime,
      'build',
      null
    );
    
    console.log(`   ✓ Initial install record created`);
    
    // Verify data
    const row = db.prepare('SELECT * FROM build_info WHERE id = 1').get();
    if (row) {
      console.log(`   ✓ Verified: ${row.app_name} v${row.version_number}`);
    }
    
    db.close();
    console.log(`   ✓ Database created successfully`);
    
  } catch (error) {
    db.close();
    throw error;
  }
}

/**
 * Copy database vào assets folder cho Android
 */
function copyDatabaseToAndroid(dbPath, root) {
  const assetsPath = path.join(root, "platforms/android/app/src/main/assets");
  
  if (!fs.existsSync(assetsPath)) {
    fs.mkdirSync(assetsPath, { recursive: true });
  }
  
  const destPath = path.join(assetsPath, "app_build_info.db");
  fs.copyFileSync(dbPath, destPath);
  
  console.log(`   ✓ Copied to Android assets: ${destPath}`);
}

/**
 * Copy database vào Resources folder cho iOS và update Xcode project
 */
function copyDatabaseToIOS(dbPath, root, config) {
  const xcode = require('xcode');
  
  // Tìm project name
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
  
  const destPath = path.join(resourcesPath, "app_build_info.db");
  fs.copyFileSync(dbPath, destPath);
  
  console.log(`   ✓ Copied to iOS Resources: ${destPath}`);
  
  // Update Xcode project
  try {
    const pbxprojPath = path.join(iosPath, `${projectName}.xcodeproj/project.pbxproj`);
    
    if (fs.existsSync(pbxprojPath)) {
      const proj = xcode.project(pbxprojPath);
      proj.parseSync();
      
      // Add file reference nếu chưa có
      const dbFileRelPath = `${projectName}/Resources/app_build_info.db`;
      
      // Check xem file đã được add chưa
      const existingFile = proj.hasFile(dbFileRelPath);
      
      if (!existingFile) {
        proj.addResourceFile(dbFileRelPath);
        fs.writeFileSync(pbxprojPath, proj.writeSync());
        console.log(`   ✓ Added database to Xcode project`);
      } else {
        console.log(`   ✓ Database already in Xcode project`);
      }
    }
  } catch (error) {
    console.log(`   ⚠️  Could not update Xcode project: ${error.message}`);
    console.log(`   Note: Database file is copied, but you may need to add it manually in Xcode`);
  }
}

/**
 * Tạo helper JavaScript file để đọc database
 */
function createHelperJS(wwwPath) {
  const helperContent = `
// Auto-generated by cordova-plugin-change-app-info
// This file provides helpers to read build info from pre-built SQLite database

(function() {
  'use strict';
  
  var db = null;
  var buildInfoCache = null;
  
  // Wait for deviceready
  document.addEventListener('deviceready', function() {
    initDatabase();
  }, false);
  
  /**
   * Khởi tạo SQLite database
   */
  function initDatabase() {
    try {
      if (!window.sqlitePlugin) {
        console.warn('[Build Info] SQLite plugin not found');
        return;
      }
      
      // Mở database đã có sẵn từ build time
      db = window.sqlitePlugin.openDatabase({
        name: 'app_build_info.db',
        location: 'default',
        createFromLocation: 1, // Đọc từ www/assets
        androidDatabaseProvider: 'system'
      });
      
      console.log('[Build Info] SQLite database opened from build-time data');
      
      // Load build info
      loadBuildInfo();
      
    } catch (e) {
      console.error('[Build Info] Failed to open database:', e);
    }
  }
  
  /**
   * Đọc build info từ database
   */
  function loadBuildInfo() {
    if (!db) return;
    
    db.transaction(function(tx) {
      tx.executeSql('SELECT * FROM build_info WHERE id = 1', [], function(tx, result) {
        if (result.rows.length > 0) {
          var buildInfo = result.rows.item(0);
          
          // Check if this is first run after install/update
          checkAndRecordInstall(buildInfo);
          
          buildInfoCache = {
            appName: buildInfo.app_name,
            versionNumber: buildInfo.version_number,
            versionCode: buildInfo.version_code,
            packageName: buildInfo.package_name,
            platform: buildInfo.platform,
            buildTime: buildInfo.build_time,
            buildTimestamp: buildInfo.build_timestamp,
            apiHostname: buildInfo.api_hostname,
            apiBaseUrl: buildInfo.api_base_url,
            environment: buildInfo.environment,
            cdnIcon: buildInfo.cdn_icon,
            storageType: 'sqlite-prebuild'
          };
          
          window.APP_BUILD_INFO = buildInfoCache;
          
          console.log('[Build Info] Loaded from pre-built database:', buildInfoCache);
          console.log('[Build Info] API Hostname:', buildInfo.api_hostname);
          console.log('[Build Info] Environment:', buildInfo.environment);
          
          // Trigger event
          var event = new CustomEvent('buildInfoReady', { detail: buildInfoCache });
          document.dispatchEvent(event);
        }
      });
    });
  }
  
  /**
   * Kiểm tra và ghi lại install/update
   */
  function checkAndRecordInstall(currentBuildInfo) {
    db.transaction(function(tx) {
      // Lấy install record cuối cùng (không phải build type)
      tx.executeSql(
        "SELECT * FROM install_history WHERE install_type != 'build' ORDER BY id DESC LIMIT 1",
        [],
        function(tx, result) {
          var lastInstall = result.rows.length > 0 ? result.rows.item(0) : null;
          var installType = 'first_install';
          var previousVersion = null;
          
          if (lastInstall) {
            if (lastInstall.version_number === currentBuildInfo.version_number) {
              // Cùng version - skip
              return;
            } else {
              installType = 'update';
              previousVersion = lastInstall.version_number;
            }
          }
          
          // Ghi lại install record mới
          tx.executeSql(
            'INSERT INTO install_history (version_number, version_code, install_time, install_type, previous_version) VALUES (?, ?, ?, ?, ?)',
            [
              currentBuildInfo.version_number,
              currentBuildInfo.version_code,
              new Date().toISOString(),
              installType,
              previousVersion
            ],
            function() {
              console.log('[Build Info] Recorded ' + installType + ' event');
            }
          );
        }
      );
    });
  }
  
  // Helper functions
  window.updateAppUserData = function(key, value, callback) {
    if (!db) {
      if (callback) callback(new Error('Database not initialized'));
      return;
    }
    
    db.transaction(function(tx) {
      tx.executeSql(
        'INSERT OR REPLACE INTO user_data (key, value, updated_at) VALUES (?, ?, ?)',
        [key, JSON.stringify(value), new Date().toISOString()],
        function(tx, result) {
          if (callback) callback(null, result);
        },
        function(tx, error) {
          if (callback) callback(error);
        }
      );
    });
  };
  
  window.getAppUserData = function(key, callback) {
    if (!db) {
      if (callback) callback(new Error('Database not initialized'));
      return;
    }
    
    db.transaction(function(tx) {
      tx.executeSql('SELECT value FROM user_data WHERE key = ?', [key], function(tx, result) {
        if (result.rows.length > 0) {
          try {
            var value = JSON.parse(result.rows.item(0).value);
            if (callback) callback(null, value);
          } catch (e) {
            if (callback) callback(e);
          }
        } else {
          if (callback) callback(null, null);
        }
      });
    });
  };
  
  window.updateAppSettings = function(settings, callback) {
    if (!db) {
      if (callback) callback(new Error('Database not initialized'));
      return;
    }
    
    db.transaction(function(tx) {
      var now = new Date().toISOString();
      Object.keys(settings).forEach(function(key) {
        tx.executeSql(
          'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
          [key, JSON.stringify(settings[key]), now]
        );
      });
    }, function(error) {
      if (callback) callback(error);
    }, function() {
      if (callback) callback(null);
    });
  };
  
  window.getAppSetting = function(key, callback) {
    if (!db) {
      if (callback) callback(new Error('Database not initialized'));
      return;
    }
    
    db.transaction(function(tx) {
      tx.executeSql('SELECT value FROM app_settings WHERE key = ?', [key], function(tx, result) {
        if (result.rows.length > 0) {
          try {
            var value = JSON.parse(result.rows.item(0).value);
            if (callback) callback(null, value);
          } catch (e) {
            if (callback) callback(e);
          }
        } else {
          if (callback) callback(null, null);
        }
      });
    });
  };
  
  window.getInstallHistory = function(callback) {
    if (!db) {
      if (callback) callback(new Error('Database not initialized'));
      return;
    }
    
    db.transaction(function(tx) {
      tx.executeSql('SELECT * FROM install_history ORDER BY id DESC', [], function(tx, result) {
        var history = [];
        for (var i = 0; i < result.rows.length; i++) {
          history.push(result.rows.item(i));
        }
        if (callback) callback(null, history);
      });
    });
  };
  
})();
`;
  
  const helperPath = path.join(wwwPath, "build-info-helper.js");
  fs.writeFileSync(helperPath, helperContent, "utf8");
  console.log(`   ✓ Created helper JS: ${helperPath}`);
}

/**
 * Thêm <script> tag vào index.html
 */
function injectScriptTag(wwwPath) {
  const indexPath = path.join(wwwPath, "index.html");
  
  if (!fs.existsSync(indexPath)) {
    console.log("   ⚠️  index.html not found");
    return;
  }
  
  let html = fs.readFileSync(indexPath, "utf8");
  
  // Remove old build-info.js if exists
  html = html.replace(/<script[^>]*src=["']build-info\.js["'][^>]*><\/script>\s*/g, '');
  
  // Check xem đã có helper script chưa
  if (html.includes('build-info-helper.js')) {
    console.log("   Script tag already exists in index.html");
    return;
  }
  
  const scriptTag = `    <script src="build-info-helper.js"></script>`;
  
  // Thêm trước cordova.js
  if (html.includes('cordova.js')) {
    html = html.replace(
      /<script[^>]*src=["']cordova\.js["'][^>]*><\/script>/,
      `${scriptTag}\n    $&`
    );
  } else if (html.includes("</head>")) {
    html = html.replace("</head>", `${scriptTag}\n  </head>");
  } else if (html.includes("</body>")) {
    html = html.replace("</body>", `${scriptTag}\n  </body>");
  } else {
    console.log("   ⚠️  Could not find suitable location in index.html");
    return;
  }
  
  fs.writeFileSync(indexPath, html, "utf8");
  console.log(`   ✓ Added <script> tag to index.html`);
}

/**
 * Main injection function
 */
function injectBuildInfo(context, platform) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, "config.xml"));
  
  // Read config
  const apiHostname = config.getPreference("API_HOSTNAME") || "";
  const apiBaseUrl = config.getPreference("API_BASE_URL") || "";
  const environment = config.getPreference("ENVIRONMENT") || "production";
  
  const buildInfo = {
    appName: config.getPreference("APP_NAME") || config.name() || "Unknown",
    versionNumber: config.getPreference("VERSION_NUMBER") || config.version() || "0.0.0",
    versionCode: config.getPreference("VERSION_CODE") || "0",
    packageName: config.packageName() || "unknown",
    platform: platform,
    buildTime: new Date().toISOString(),
    buildTimestamp: Date.now(),
    apiHostname: apiHostname,
    apiBaseUrl: apiBaseUrl,
    environment: environment,
    cdnIcon: config.getPreference("CDN_ICON") || null
  };
  
  // Create temporary database
  const tmpDbPath = path.join(root, "app_build_info.db");
  createBuildInfoDatabase(buildInfo, tmpDbPath);
  
  // Đường dẫn www của platform
  let wwwPath;
  if (platform === "android") {
    wwwPath = path.join(root, "platforms/android/app/src/main/assets/www");
    copyDatabaseToAndroid(tmpDbPath, root);
  } else if (platform === "ios") {
    wwwPath = path.join(root, "platforms/ios/www");
    copyDatabaseToIOS(tmpDbPath, root, config);
  } else {
    console.log(`   ⚠️  Platform ${platform} not supported`);
    return;
  }
  
  // Clean up temp database
  fs.unlinkSync(tmpDbPath);
  
  if (!fs.existsSync(wwwPath)) {
    console.log(`   ⚠️  WWW path not found: ${wwwPath}`);
    return;
  }
  
  // Create helper JS and inject to index.html
  createHelperJS(wwwPath);
  injectScriptTag(wwwPath);
  
  console.log(`\n   ✅ Build info database created successfully!`);
  console.log(`   App: ${buildInfo.appName} v${buildInfo.versionNumber} (${buildInfo.versionCode})`);
  console.log(`   Environment: ${buildInfo.environment}`);
  console.log(`   API Hostname: ${buildInfo.apiHostname || 'Not configured'}`);
  console.log(`   API Base URL: ${buildInfo.apiBaseUrl || 'Not configured'}`);
  console.log(`   Build: ${buildInfo.buildTime}`);
  console.log(`   Storage: Pre-built SQLite database`);
  console.log(`   Note: Database is created at build time, no runtime injection needed`);
}

/**
 * Hook entry point
 */
module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  console.log("\n══════════════════════════════════════════");
  console.log("  INJECT BUILD INFO HOOK (Direct SQLite) ");
  console.log("══════════════════════════════════════════");
  
  for (const platform of platforms) {
    console.log(`\n📱 Processing ${platform}...`);
    try {
      injectBuildInfo(context, platform);
    } catch (error) {
      console.error(`\n❌ Error processing ${platform}:`, error);
      throw error;
    }
  }
  
  console.log("\n══════════════════════════════════════════");
  console.log("✅ Build info injection completed!");
  console.log("══════════════════════════════════════════\n");
};