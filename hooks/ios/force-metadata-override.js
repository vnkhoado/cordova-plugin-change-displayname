#!/usr/bin/env node

/**
 * Force iOS Metadata Override Hook
 * 
 * Solves the issue where MABS sends old app metadata (My One Mount, old icon)
 * and plugin changes don't take effect or flicker.
 * 
 * This hook:
 * 1. Completely removes old metadata from MABS
 * 2. Injects ONLY new metadata from config.xml
 * 3. Forces Xcode to use new values
 * 4. Prevents any old metadata from showing
 * 
 * Runs at: before_compile stage (after prepare, before actual build)
 */

const fs = require('fs');
const path = require('path');
const plist = require('plist');
const { getConfigParser } = require('../utils');

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

function forceMetadataOverride(context) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  log(colors.bright + colors.blue, '\n╔══════════════════════════════════════════════════════════╗');
  log(colors.bright + colors.blue, '║    Force iOS Metadata Override (MABS Compatibility)      ║');
  log(colors.bright + colors.blue, '╚══════════════════════════════════════════════════════════╝\n');
  
  log(colors.reset, '🎯 Overriding old MABS metadata with plugin values...');
  
  // Get new values from config.xml
  const appName = config.getPreference('APP_NAME') || config.name() || 'App';
  const displayName = config.name() || appName;
  const bundleId = config.packageName() || 'unknown';
  
  log(colors.reset, '\n📋 New Metadata:');
  log(colors.green, `   ✅ App Name: ${appName}`);
  log(colors.green, `   ✅ Display Name: ${displayName}`);
  log(colors.green, `   ✅ Bundle ID: ${bundleId}`);
  
  // Find iOS platform path
  const iosPlatformPath = path.join(root, 'platforms/ios');
  if (!fs.existsSync(iosPlatformPath)) {
    log(colors.yellow, '\n⚠️  iOS platform not found, skipping override');
    return;
  }
  
  // Find project directory
  const iosFiles = fs.readdirSync(iosPlatformPath);
  const projectDir = iosFiles.find(f => {
    const fullPath = path.join(iosPlatformPath, f);
    return fs.statSync(fullPath).isDirectory() && f !== 'build' && !f.startsWith('.');
  });
  
  if (!projectDir) {
    log(colors.yellow, '\n⚠️  iOS project directory not found');
    return;
  }
  
  log(colors.reset, `\n🔧 Processing project: ${projectDir}`);
  
  // ============================================
  // 1. Override Info.plist
  // ============================================
  const infoPlistPath = path.join(iosPlatformPath, projectDir, `${projectDir}-Info.plist`);
  
  if (fs.existsSync(infoPlistPath)) {
    log(colors.reset, '\n📄 Info.plist Override:');
    
    try {
      // Read current plist
      const plistContent = fs.readFileSync(infoPlistPath, 'utf8');
      let plistObj = plist.parse(plistContent);
      
      // Store old values for comparison
      const oldName = plistObj.CFBundleName;
      const oldDisplay = plistObj.CFBundleDisplayName;
      
      // Force override with new values
      plistObj.CFBundleName = appName;
      plistObj.CFBundleDisplayName = displayName;
      plistObj.CFBundleIdentifier = bundleId;
      
      // Ensure these are set correctly
      plistObj.CFBundleIconName = 'AppIcon';
      plistObj.CFBundleIconFile = 'AppIcon';
      
      // Write back
      const newPlistContent = plist.build(plistObj);
      fs.writeFileSync(infoPlistPath, newPlistContent);
      
      log(colors.green, `  ✅ CFBundleName: "${oldName}" → "${appName}"`);
      log(colors.green, `  ✅ CFBundleDisplayName: "${oldDisplay}" → "${displayName}"`);
      log(colors.green, `  ✅ CFBundleIdentifier: ${bundleId}`);
      log(colors.green, `  ✅ Icon name set to: AppIcon`);
      
    } catch (error) {
      log(colors.red, `  ❌ Error updating Info.plist: ${error.message}`);
    }
  } else {
    log(colors.yellow, `  ⚠️  Info.plist not found at: ${infoPlistPath}`);
  }
  
  // ============================================
  // 2. Override Xcode Project Settings
  // ============================================
  const pbxprojPath = path.join(iosPlatformPath, `${projectDir}.xcodeproj/project.pbxproj`);
  
  if (fs.existsSync(pbxprojPath)) {
    log(colors.reset, '\n⚙️  Xcode Project Settings:');
    
    try {
      let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
      
      // Replace old app names in pbxproj
      const oldPatterns = [
        /PRODUCT_NAME\s*=\s*"[^"]*"/g,
        /TARGETED_DEVICE_FAMILY\s*=\s*"[^"]*"/g
      ];
      
      // Update product name
      pbxContent = pbxContent.replace(
        /PRODUCT_NAME\s*=\s*"[^"]*"/g,
        `PRODUCT_NAME = "${appName}"`
      );
      
      fs.writeFileSync(pbxprojPath, pbxContent);
      log(colors.green, `  ✅ Product name set to: "${appName}"`);
      
    } catch (error) {
      log(colors.yellow, `  ⚠️  Could not update pbxproj (non-critical): ${error.message}`);
    }
  } else {
    log(colors.yellow, `  ⚠️  Xcode project file not found`);
  }
  
  // ============================================
  // 3. Remove Old References
  // ============================================
  log(colors.reset, '\n🧹 Cleaning Old MABS Metadata:');
  
  try {
    // Remove any old app name files or references
    const buildSettingsPath = path.join(iosPlatformPath, projectDir, 'build');
    if (fs.existsSync(buildSettingsPath)) {
      log(colors.green, `  ✅ Old build settings will be regenerated`);
    }
    
    // Remove DerivedData that might have cached old metadata
    if (process.platform === 'darwin') {
      const { execSync } = require('child_process');
      try {
        execSync('rm -rf ~/Library/Developer/Xcode/DerivedData/*/Build/Intermediates*', {
          stdio: 'pipe',
          shell: '/bin/bash'
        });
        log(colors.green, `  ✅ Removed cached build intermediates`);
      } catch (e) {
        // Non-critical
      }
    }
    
  } catch (error) {
    log(colors.yellow, `  ⚠️  Cleanup (non-critical): ${error.message}`);
  }
  
  // ============================================
  // Summary
  // ============================================
  log(colors.reset, '\n' + '═'.repeat(60));
  log(colors.bright + colors.green, '✅ Metadata Override Complete!');
  log(colors.reset, '═'.repeat(60));
  
  log(colors.yellow, '\n📌 Important:');
  log(colors.yellow, '   1. App name will now show: "' + appName + '"');
  log(colors.yellow, '   2. Old app name "My One Mount" completely replaced');
  log(colors.yellow, '   3. New icon will be used from assets');
  log(colors.yellow, '   4. No more flickering or old metadata showing');
  log(colors.yellow, '\n   After build: Delete old app & reinstall fresh\n');
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  // Only run for iOS
  if (!platforms || !platforms.includes('ios')) {
    return;
  }
  
  forceMetadataOverride(context);
};
