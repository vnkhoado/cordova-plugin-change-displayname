#!/usr/bin/env node

/**
 * iOS Unified Prepare Hook - STANDALONE VERSION
 * Fixed: App name and splash screen color override
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

module.exports = async function(context) {
  const platforms = context.opts.platforms;
  
  if (!platforms.includes('ios')) {
    return;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  🔧 iOS Unified Prepare Phase (Standalone)');
  console.log('═══════════════════════════════════════');

  try {
    const root = context.opts.projectRoot;
    const iosPath = path.join(root, 'platforms/ios');
    
    await safeBackup(context, iosPath);
    await changeAppInfo(context, iosPath);
    await generateIcons(context, iosPath);
    await injectBuildInfo(context, iosPath);
    await customizeUI(context, iosPath);
    
    console.log('✅ iOS Prepare Phase Complete!');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error in iOS Prepare Phase:', error.message);
    console.log('⚠️  Continuing build with partial changes...\n');
  }
};

async function safeBackup(context, iosPath) {
  console.log('📦 Step 1: Safe Backup');
  try {
    const backupPath = path.join(iosPath, '.plugin-backup');
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const plistPath = path.join(iosPath, projectName, `${projectName}-Info.plist`);
    const storyboardPath = path.join(iosPath, projectName, 'LaunchScreen.storyboard');
    
    if (fs.existsSync(plistPath)) {
      fs.copyFileSync(plistPath, path.join(backupPath, 'Info.plist.backup'));
      console.log('   ✅ Backed up Info.plist');
    }
    
    if (fs.existsSync(storyboardPath)) {
      fs.copyFileSync(storyboardPath, path.join(backupPath, 'LaunchScreen.storyboard.backup'));
      console.log('   ✅ Backed up LaunchScreen.storyboard');
    }
  } catch (error) {
    console.log('   ⚠️  Backup failed:', error.message);
  }
}

async function changeAppInfo(context, iosPath) {
  console.log('📝 Step 2: Change App Info');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    
    const appName = config.getPreference('APP_NAME');
    const versionNumber = config.getPreference('VERSION_NUMBER');
    const versionCode = config.getPreference('VERSION_CODE');
    
    if (!appName && !versionNumber && !versionCode) {
      console.log('   ℹ️  Using config.xml defaults');
      return;
    }
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) return;
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const plistPath = path.join(iosPath, projectName, `${projectName}-Info.plist`);
    
    if (!fs.existsSync(plistPath)) {
      console.log('   ⚠️  Info.plist not found');
      return;
    }
    
    let plistContent = fs.readFileSync(plistPath, 'utf8');
    let modified = false;
    
    if (appName) {
      // Update CFBundleDisplayName (displayed app name)
      if (plistContent.includes('<key>CFBundleDisplayName</key>')) {
        plistContent = plistContent.replace(
          /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/g,
          `$1${appName}$2`
        );
      } else {
        // Add CFBundleDisplayName if not exists
        plistContent = plistContent.replace(
          '</dict>\n</plist>',
          `  <key>CFBundleDisplayName</key>\n  <string>${appName}</string>\n</dict>\n</plist>`
        );
      }
      
      // Also update CFBundleName (internal name)
      if (plistContent.includes('<key>CFBundleName</key>')) {
        plistContent = plistContent.replace(
          /(<key>CFBundleName<\/key>\s*<string>)[^<]*(<\/string>)/g,
          `$1${appName}$2`
        );
      }
      
      console.log(`   ✅ App name: ${appName}`);
      console.log(`      - CFBundleDisplayName: ${appName}`);
      console.log(`      - CFBundleName: ${appName}`);
      modified = true;
    }
    
    if (versionNumber) {
      plistContent = plistContent.replace(
        /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/g,
        `$1${versionNumber}$2`
      );
      console.log(`   ✅ Version: ${versionNumber}`);
      modified = true;
    }
    
    if (versionCode) {
      plistContent = plistContent.replace(
        /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/g,
        `$1${versionCode}$2`
      );
      console.log(`   ✅ Build: ${versionCode}`);
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(plistPath, plistContent, 'utf8');
      console.log('   ✅ Info.plist updated successfully');
    }
  } catch (error) {
    console.log('   ⚠️  Failed:', error.message);
    console.error(error.stack);
  }
}

async function generateIcons(context, iosPath) {
  console.log('🎨 Step 3: Generate Icons');
  
  const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
  const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
  const cdnIcon = config.getPreference('CDN_ICON');
  
  if (!cdnIcon) {
    console.log('   ℹ️  No CDN_ICON, using existing icons');
    return;
  }
  
  console.log(`   🌐 CDN: ${cdnIcon}`);
  
  let sharp, Jimp;
  try {
    sharp = require('sharp');
    console.log('   ✅ Using sharp for image processing');
  } catch (e) {
    try {
      Jimp = require('jimp');
      console.log('   ✅ Using jimp for image processing');
    } catch (e2) {
      console.log('   ⚠️  No image processor available (sharp/jimp)');
      console.log('   💡 Install: npm install sharp');
      return;
    }
  }
  
  try {
    const iconBuffer = await downloadFile(cdnIcon);
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) return;
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const assetsPath = path.join(iosPath, projectName, 'Images.xcassets/AppIcon.appiconset');
    
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath, { recursive: true });
    }
    
    const sizes = [
      { size: 20, scale: 2, idiom: 'iphone' },
      { size: 20, scale: 3, idiom: 'iphone' },
      { size: 29, scale: 2, idiom: 'iphone' },
      { size: 29, scale: 3, idiom: 'iphone' },
      { size: 40, scale: 2, idiom: 'iphone' },
      { size: 40, scale: 3, idiom: 'iphone' },
      { size: 60, scale: 2, idiom: 'iphone' },
      { size: 60, scale: 3, idiom: 'iphone' },
      { size: 1024, scale: 1, idiom: 'ios-marketing' }
    ];
    
    const images = [];
    
    for (const icon of sizes) {
      const actualSize = icon.size * icon.scale;
      const filename = `icon-${actualSize}.png`;
      const filepath = path.join(assetsPath, filename);
      
      if (sharp) {
        await sharp(iconBuffer)
          .resize(actualSize, actualSize)
          .toFile(filepath);
      } else if (Jimp) {
        const image = await Jimp.read(iconBuffer);
        await image.resize(actualSize, actualSize).writeAsync(filepath);
      }
      
      images.push({
        size: `${icon.size}x${icon.size}`,
        idiom: icon.idiom,
        filename: filename,
        scale: `${icon.scale}x`
      });
    }
    
    const contentsJson = {
      images: images,
      info: {
        version: 1,
        author: 'cordova-plugin-change-app-info'
      }
    };
    
    fs.writeFileSync(
      path.join(assetsPath, 'Contents.json'),
      JSON.stringify(contentsJson, null, 2)
    );
    
    console.log(`   ✅ Generated ${sizes.length} icon sizes`);
  } catch (error) {
    console.log('   ⚠️  Icon generation failed:', error.message);
  }
}

async function injectBuildInfo(context, iosPath) {
  console.log('💾 Step 4: Inject Build Info');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    
    const environment = config.getPreference('ENVIRONMENT') || 'production';
    const apiHostname = config.getPreference('API_HOSTNAME') || '';
    
    console.log(`   ℹ️  Environment: ${environment}`);
    if (apiHostname) console.log(`   ℹ️  API: ${apiHostname}`);
    
    const pluginsPath = path.join(context.opts.projectRoot, 'plugins');
    const hasSQLite = fs.existsSync(path.join(pluginsPath, 'cordova-sqlite-storage'));
    
    if (!hasSQLite) {
      console.log('   ℹ️  SQLite plugin not found, skipping database creation');
      return;
    }
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) return;
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const dbPath = path.join(iosPath, projectName, 'Resources/buildInfo.db');
    
    const resourcesDir = path.dirname(dbPath);
    if (!fs.existsSync(resourcesDir)) {
      fs.mkdirSync(resourcesDir, { recursive: true });
    }
    
    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(dbPath);
    
    db.serialize(() => {
      db.run('CREATE TABLE IF NOT EXISTS build_info (key TEXT PRIMARY KEY, value TEXT)');
      db.run('INSERT OR REPLACE INTO build_info VALUES (?, ?)', ['environment', environment]);
      db.run('INSERT OR REPLACE INTO build_info VALUES (?, ?)', ['api_hostname', apiHostname]);
      db.run('INSERT OR REPLACE INTO build_info VALUES (?, ?)', ['build_date', new Date().toISOString()]);
    });
    
    db.close();
    
    console.log('   ✅ Created build info database');
  } catch (error) {
    console.log('   ⚠️  Build info skipped:', error.message);
  }
}

async function customizeUI(context, iosPath) {
  console.log('🎨 Step 5: Customize UI (Splash & Webview)');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    
    const splashBg = config.getPreference('SplashScreenBackgroundColor');
    const webviewBg = config.getPreference('WEBVIEW_BACKGROUND_COLOR');
    
    if (!splashBg && !webviewBg) {
      console.log('   ℹ️  No UI customization');
      return;
    }
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) return;
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    
    if (splashBg) {
      console.log(`   🎨 Splash color: ${splashBg}`);
      
      // 1. Override LaunchScreen.storyboard
      const storyboardPath = path.join(iosPath, projectName, 'LaunchScreen.storyboard');
      
      if (fs.existsSync(storyboardPath)) {
        let storyboard = fs.readFileSync(storyboardPath, 'utf8');
        
        const colorHex = splashBg.replace('#', '');
        const r = (parseInt(colorHex.substr(0, 2), 16) / 255).toFixed(3);
        const g = (parseInt(colorHex.substr(2, 2), 16) / 255).toFixed(3);
        const b = (parseInt(colorHex.substr(4, 2), 16) / 255).toFixed(3);
        
        const colorXML = `<color key="backgroundColor" red="${r}" green="${g}" blue="${b}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`;
        
        // Replace ALL backgroundColor in storyboard
        storyboard = storyboard.replace(
          /<color key="backgroundColor"[^>]*\/>/g,
          colorXML
        );
        
        // Also replace system colors
        storyboard = storyboard.replace(
          /<color key="backgroundColor" systemColor="[^"]*"\s*\/>/g,
          colorXML
        );
        
        fs.writeFileSync(storyboardPath, storyboard, 'utf8');
        console.log('   ✅ Updated LaunchScreen.storyboard');
      } else {
        console.log('   ⚠️  LaunchScreen.storyboard not found');
      }
      
      // 2. Override CDVLaunchScreen.storyboard (if exists)
      const cdvStoryboardPath = path.join(iosPath, projectName, 'CDVLaunchScreen.storyboard');
      if (fs.existsSync(cdvStoryboardPath)) {
        let cdvStoryboard = fs.readFileSync(cdvStoryboardPath, 'utf8');
        
        const colorHex = splashBg.replace('#', '');
        const r = (parseInt(colorHex.substr(0, 2), 16) / 255).toFixed(3);
        const g = (parseInt(colorHex.substr(2, 2), 16) / 255).toFixed(3);
        const b = (parseInt(colorHex.substr(4, 2), 16) / 255).toFixed(3);
        
        const colorXML = `<color key="backgroundColor" red="${r}" green="${g}" blue="${b}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`;
        
        cdvStoryboard = cdvStoryboard.replace(
          /<color key="backgroundColor"[^>]*\/>/g,
          colorXML
        );
        
        fs.writeFileSync(cdvStoryboardPath, cdvStoryboard, 'utf8');
        console.log('   ✅ Updated CDVLaunchScreen.storyboard');
      }
      
      // 3. Add to Info.plist for native splash override
      const plistPath = path.join(iosPath, projectName, `${projectName}-Info.plist`);
      if (fs.existsSync(plistPath)) {
        let plistContent = fs.readFileSync(plistPath, 'utf8');
        
        // Add UILaunchScreen background color
        if (!plistContent.includes('<key>UILaunchScreen</key>')) {
          plistContent = plistContent.replace(
            '</dict>\n</plist>',
            `  <key>UILaunchScreen</key>\n  <dict>\n    <key>UIColorName</key>\n    <string>SplashBackgroundColor</string>\n    <key>UIImageName</key>\n    <string></string>\n  </dict>\n</dict>\n</plist>`
          );
          fs.writeFileSync(plistPath, plistContent, 'utf8');
          console.log('   ✅ Added UILaunchScreen to Info.plist');
        }
      }
    }
    
    if (webviewBg) {
      console.log(`   🎨 Webview color: ${webviewBg}`);
      console.log('   ℹ️  Webview background applied at runtime');
    }
    
  } catch (error) {
    console.log('   ⚠️  UI customization skipped:', error.message);
    console.error(error.stack);
  }
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed: ${response.statusCode}`));
      }
      
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}
