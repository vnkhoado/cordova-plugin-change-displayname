#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Đọc thông tin app gốc từ platform files
 */
function getOriginalAppInfo(context, platform) {
  const root = context.opts.projectRoot;
  const info = {
    platform: platform,
    appName: null,
    versionNumber: null,
    versionCode: null
  };

  if (platform === "android") {
    // Đọc AndroidManifest.xml
    const manifestPath = path.join(
      root,
      "platforms/android/app/src/main/AndroidManifest.xml"
    );
    
    if (fs.existsSync(manifestPath)) {
      const manifest = fs.readFileSync(manifestPath, "utf8");
      const versionName = manifest.match(/android:versionName="([^"]*)"/); 
      const versionCode = manifest.match(/android:versionCode="([^"]*)"/); 
      
      info.versionNumber = versionName ? versionName[1] : null;
      info.versionCode = versionCode ? versionCode[1] : null;
    }
    
    // Đọc strings.xml
    const stringsPath = path.join(
      root,
      "platforms/android/app/src/main/res/values/strings.xml"
    );
    
    if (fs.existsSync(stringsPath)) {
      const strings = fs.readFileSync(stringsPath, "utf8");
      const appName = strings.match(/<string name="app_name">(.*?)<\/string>/);
      info.appName = appName ? appName[1] : null;
    }
  } 
  else if (platform === "ios") {
    const platformPath = path.join(root, "platforms/ios");
    
    if (!fs.existsSync(platformPath)) {
      return info;
    }
    
    // Tìm iOS app folder
    const iosFolders = fs.readdirSync(platformPath).filter(f => {
      const fullPath = path.join(platformPath, f);
      return fs.statSync(fullPath).isDirectory() && 
             !["CordovaLib", "www", "cordova", "build"].includes(f);
    });
    
    if (iosFolders.length > 0) {
      const appFolderName = iosFolders[0];
      const plistPath = path.join(
        platformPath,
        appFolderName,
        `${appFolderName}-Info.plist`
      );
      
      if (fs.existsSync(plistPath)) {
        const plist = fs.readFileSync(plistPath, "utf8");
        const displayName = plist.match(/<key>CFBundleDisplayName<\/key>\s*<string>(.*?)<\/string>/);
        const versionNumber = plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>(.*?)<\/string>/);
        const buildNumber = plist.match(/<key>CFBundleVersion<\/key>\s*<string>(.*?)<\/string>/);
        
        info.appName = displayName ? displayName[1] : null;
        info.versionNumber = versionNumber ? versionNumber[1] : null;
        info.versionCode = buildNumber ? buildNumber[1] : null;
      }
    }
  }

  return info;
}

/**
 * Lưu backup vào file JSON
 */
function saveBackup(root, backupData) {
  const backupDir = path.join(root, ".cordova-build-backup");
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const backupFile = path.join(backupDir, "app-info-backup.json");
  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), "utf8");
  
  console.log(`💾 App info backed up to: ${backupFile}`);
}

/**
 * Hook chính - chạy TRƯỚC changeAppInfo
 */
module.exports = function(context) {
  const root = context.opts.projectRoot;
  const platforms = context.opts.platforms;

  console.log("\n══════════════════════════════════");
  console.log("       BACKUP APP INFO HOOK        ");
  console.log("══════════════════════════════════");

  const backupData = {
    timestamp: new Date().toISOString(),
    platforms: {}
  };

  for (const platform of platforms) {
    console.log(`\n📱 Backing up ${platform} info...`);
    
    const originalInfo = getOriginalAppInfo(context, platform);
    backupData.platforms[platform] = originalInfo;
    
    console.log(`   App Name: ${originalInfo.appName || 'N/A'}`);
    console.log(`   Version: ${originalInfo.versionNumber || 'N/A'} (${originalInfo.versionCode || 'N/A'})`);
  }

  // Lưu backup
  saveBackup(root, backupData);

  console.log("\n══════════════════════════════════");
  console.log("✅ Backup completed!");
  console.log("══════════════════════════════════\n");
};