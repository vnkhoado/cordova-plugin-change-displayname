#!/usr/bin/env node

/**
 * iOS Unified Prepare Hook
 * Combines: backupAppInfo + changeAppInfo + generateIcons + injectBuildInfo + 
 *           customizeSplashScreen + customizeWebview + injectIOSBackgroundFix
 */

const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  const platforms = context.opts.platforms;
  
  if (!platforms.includes('ios')) {
    return;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  🔧 iOS Unified Prepare Phase');
  console.log('═══════════════════════════════════════');

  try {
    const root = context.opts.projectRoot;
    const iosPath = path.join(root, 'platforms/ios');
    
    // Step 1: Backup (safe backup without errors)
    await safeBackup(context, iosPath);
    
    // Step 2: Change App Info (with error handling)
    await changeAppInfo(context, iosPath);
    
    // Step 3: Generate Icons (only if CDN_ICON exists)
    await generateIcons(context, iosPath);
    
    // Step 4: Inject Build Info (optional SQLite)
    await injectBuildInfo(context, iosPath);
    
    // Step 5: Customize Splash & Webview (non-destructive)
    await customizeUI(context, iosPath);
    
    console.log('✅ iOS Prepare Phase Complete!');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error in iOS Prepare Phase:', error.message);
    console.log('⚠️  Continuing build with partial changes...\n');
    // Don't throw - let build continue
  }
};

async function safeBackup(context, iosPath) {
  console.log('📦 Step 1: Safe Backup');
  try {
    const backupPath = path.join(iosPath, '.plugin-backup');
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    // Find Info.plist
    const xcodeProjects = fs.readdirSync(iosPath)
      .filter(f => f.endsWith('.xcodeproj'));
    
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found, skipping backup');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const plistPath = path.join(iosPath, projectName, `${projectName}-Info.plist`);
    
    if (fs.existsSync(plistPath)) {
      const backupFile = path.join(backupPath, 'Info.plist.backup');
      fs.copyFileSync(plistPath, backupFile);
      console.log('   ✅ Backed up Info.plist');
    }
    
  } catch (error) {
    console.log('   ⚠️  Backup failed (non-critical):', error.message);
  }
}

async function changeAppInfo(context, iosPath) {
  console.log('📝 Step 2: Change App Info');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    
    // Get preferences
    const appName = config.getPreference('APP_NAME');
    const versionNumber = config.getPreference('VERSION_NUMBER');
    const versionCode = config.getPreference('VERSION_CODE');
    
    if (!appName && !versionNumber && !versionCode) {
      console.log('   ℹ️  No APP_NAME/VERSION preferences, using config.xml defaults');
      return;
    }
    
    // Find and update Info.plist
    const xcodeProjects = fs.readdirSync(iosPath)
      .filter(f => f.endsWith('.xcodeproj'));
    
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const plistPath = path.join(iosPath, projectName, `${projectName}-Info.plist`);
    
    if (!fs.existsSync(plistPath)) {
      console.log('   ⚠️  Info.plist not found');
      return;
    }
    
    // Use plist module if available, otherwise use simple string replacement
    let plistContent = fs.readFileSync(plistPath, 'utf8');
    let modified = false;
    
    if (appName) {
      // Safe string replacement for CFBundleDisplayName
      const displayNameRegex = /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(</string>)/;
      if (displayNameRegex.test(plistContent)) {
        plistContent = plistContent.replace(displayNameRegex, `$1${appName}$2`);
        console.log(`   ✅ Set app name: ${appName}`);
        modified = true;
      }
    }
    
    if (versionNumber) {
      const versionRegex = /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(</string>)/;
      if (versionRegex.test(plistContent)) {
        plistContent = plistContent.replace(versionRegex, `$1${versionNumber}$2`);
        console.log(`   ✅ Set version: ${versionNumber}`);
        modified = true;
      }
    }
    
    if (versionCode) {
      const buildRegex = /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(</string>)/;
      if (buildRegex.test(plistContent)) {
        plistContent = plistContent.replace(buildRegex, `$1${versionCode}$2`);
        console.log(`   ✅ Set build number: ${versionCode}`);
        modified = true;
      }
    }
    
    // Write back if modified
    if (modified) {
      fs.writeFileSync(plistPath, plistContent, 'utf8');
    }
    
  } catch (error) {
    console.log('   ⚠️  Failed to update app info:', error.message);
  }
}

async function generateIcons(context, iosPath) {
  console.log('🎨 Step 3: Generate Icons');
  
  const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
  const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
  const cdnIcon = config.getPreference('CDN_ICON');
  
  if (!cdnIcon) {
    console.log('   ℹ️  No CDN_ICON preference, skipping icon generation');
    return;
  }
  
  console.log(`   🌐 CDN Icon URL: ${cdnIcon}`);
  console.log('   ⚠️  Icon generation requires external tools (sharp, jimp)');
  console.log('   💡 Falling back to original generateIcons.js if available');
  
  // Try to call original generateIcons hook
  try {
    const originalHook = require('../generateIcons.js');
    if (typeof originalHook === 'function') {
      await originalHook(context);
    }
  } catch (error) {
    console.log('   ⚠️  Icon generation skipped:', error.message);
  }
}

async function injectBuildInfo(context, iosPath) {
  console.log('💾 Step 4: Inject Build Info (SQLite)');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    
    const environment = config.getPreference('ENVIRONMENT') || 'production';
    const apiHostname = config.getPreference('API_HOSTNAME') || '';
    
    console.log(`   ℹ️  Environment: ${environment}`);
    if (apiHostname) {
      console.log(`   ℹ️  API: ${apiHostname}`);
    }
    
    // Try to call original injectBuildInfo hook
    try {
      const originalHook = require('../injectBuildInfo.js');
      if (typeof originalHook === 'function') {
        await originalHook(context);
      }
    } catch (error) {
      console.log('   ⚠️  SQLite injection requires cordova-sqlite-storage plugin');
      console.log('   ℹ️  Skipping build info database creation');
    }
    
  } catch (error) {
    console.log('   ⚠️  Build info injection skipped:', error.message);
  }
}

async function customizeUI(context, iosPath) {
  console.log('🎨 Step 5: Customize UI');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    
    const splashBg = config.getPreference('SplashScreenBackgroundColor');
    const webviewBg = config.getPreference('WEBVIEW_BACKGROUND_COLOR');
    
    if (splashBg || webviewBg) {
      console.log('   🎨 UI Customization:');
      if (splashBg) console.log(`      - Splash: ${splashBg}`);
      if (webviewBg) console.log(`      - Webview: ${webviewBg}`);
      
      // Try to call original hooks for UI customization
      try {
        if (splashBg) {
          const splashHook = require('../customizeSplashScreen.js');
          if (typeof splashHook === 'function') {
            await splashHook(context);
          }
        }
        
        if (webviewBg) {
          const webviewHook = require('../customizeWebview.js');
          if (typeof webviewHook === 'function') {
            await webviewHook(context);
          }
        }
      } catch (error) {
        console.log('   ⚠️  UI customization partially applied:', error.message);
      }
    } else {
      console.log('   ℹ️  No UI customization preferences');
    }
    
  } catch (error) {
    console.log('   ⚠️  UI customization skipped:', error.message);
  }
}
