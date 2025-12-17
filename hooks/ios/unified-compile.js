#!/usr/bin/env node

/**
 * iOS Unified Compile Hook
 * Runs BEFORE Xcode compile, AFTER OutSystems modifications
 * This is the LAST chance to override any settings!
 * 
 * MABS 12 FIX: Assets.xcassets path priority + UIImageName in UILaunchScreen
 * STORYBOARD FIX: Force override ALL background colors (including MABS defaults)
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
  console.log('  🔨 iOS Unified Compile Phase');
  console.log('  ⚠️  LAST OVERRIDE before Xcode compilation');
  console.log('═══════════════════════════════════════');

  try {
    const root = context.opts.projectRoot;
    const iosPath = path.join(root, 'platforms/ios');
    
    // CRITICAL: Force override storyboard colors
    await forceStoryboardColors(context, iosPath);
    
    // CRITICAL: Ensure color asset exists and is valid
    await ensureColorAsset(context, iosPath);
    
    // CRITICAL: Force regenerate icons AFTER OutSystems modifications
    await forceRegenerateIcons(context, iosPath);
    
    // Clean compiled assets
    await cleanCompiledAssets(iosPath);
    
    // Validate final state
    await validateIcons(iosPath);
    await validateColorAsset(iosPath);
    
    console.log('✅ iOS Compile Phase Complete!');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error in iOS Compile Phase:', error.message);
    console.log('⚠️  Continuing with Xcode build...\n');
  }
};

async function forceStoryboardColors(context, iosPath) {
  console.log('🎨 FORCE Override Storyboard Colors');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    const splashBg = config.getPreference('SplashScreenBackgroundColor');
    
    if (!splashBg) {
      console.log('   ℹ️  No splash color configured');
      return;
    }
    
    console.log(`   🎨 Target color: ${splashBg}`);
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    
    // Parse color
    const colorHex = splashBg.replace('#', '');
    const r = (parseInt(colorHex.substr(0, 2), 16) / 255).toFixed(3);
    const g = (parseInt(colorHex.substr(2, 2), 16) / 255).toFixed(3);
    const b = (parseInt(colorHex.substr(4, 2), 16) / 255).toFixed(3);
    
    const colorXML = `<color key="backgroundColor" red="${r}" green="${g}" blue="${b}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`;
    
    // 1. FORCE override LaunchScreen.storyboard (Native pre-splash)
    const storyboardPath = path.join(iosPath, projectName, 'LaunchScreen.storyboard');
    if (fs.existsSync(storyboardPath)) {
      let storyboard = fs.readFileSync(storyboardPath, 'utf8');
      const originalLength = storyboard.length;
      
      // AGGRESSIVE REPLACE: Remove ALL color definitions
      storyboard = storyboard.replace(
        /<color key="backgroundColor"[^>]*\/>/g,
        colorXML
      );
      
      storyboard = storyboard.replace(
        /<color key="backgroundColor"[^>]*>[\s\S]*?<\/color>/g,
        colorXML
      );
      
      const changed = storyboard.length !== originalLength;
      fs.writeFileSync(storyboardPath, storyboard, 'utf8');
      console.log(`   ✅ FORCE updated LaunchScreen.storyboard${changed ? ' (OVERRIDDEN)' : ''}`);
    } else {
      console.log('   ⚠️  LaunchScreen.storyboard not found');
    }
    
    // 2. FORCE override CDVLaunchScreen.storyboard (Cordova splash)
    const cdvStoryboardPath = path.join(iosPath, projectName, 'CDVLaunchScreen.storyboard');
    if (fs.existsSync(cdvStoryboardPath)) {
      let cdvStoryboard = fs.readFileSync(cdvStoryboardPath, 'utf8');
      
      cdvStoryboard = cdvStoryboard.replace(
        /<color key="backgroundColor"[^>]*\/>/g,
        colorXML
      );
      
      cdvStoryboard = cdvStoryboard.replace(
        /<color key="backgroundColor"[^>]*>[\s\S]*?<\/color>/g,
        colorXML
      );
      
      fs.writeFileSync(cdvStoryboardPath, cdvStoryboard, 'utf8');
      console.log('   ✅ FORCE updated CDVLaunchScreen.storyboard');
    }
    
  } catch (error) {
    console.log('   ⚠️  Storyboard override failed:', error.message);
  }
}

async function ensureColorAsset(context, iosPath) {
  console.log('🎨 Ensuring Color Asset Exists');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    const splashBg = config.getPreference('SplashScreenBackgroundColor');
    
    if (!splashBg) {
      console.log('   ℹ️  No splash color configured');
      return;
    }
    
    console.log(`   🎨 Target color: ${splashBg}`);
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const appPath = path.join(iosPath, projectName);
    
    // Find .xcassets folder - PRIORITIZE Assets.xcassets (MABS 12)
    const xcassetsFolders = fs.readdirSync(appPath)
      .filter(f => {
        const xcassetsPath = path.join(appPath, f);
        return f.endsWith('.xcassets') && fs.statSync(xcassetsPath).isDirectory();
      })
      .sort((a, b) => {
        // Prioritize Assets.xcassets over Images.xcassets
        if (a === 'Assets.xcassets') return -1;
        if (b === 'Assets.xcassets') return 1;
        return 0;
      });
    
    if (xcassetsFolders.length === 0) {
      console.log('   ⚠️  No .xcassets folder found');
      return;
    }
    
    const xcassetsPath = path.join(appPath, xcassetsFolders[0]);
    console.log(`   📁 Using: ${xcassetsFolders[0]}`);
    
    const colorSetPath = path.join(xcassetsPath, 'SplashBackgroundColor.colorset');
    const contentsPath = path.join(colorSetPath, 'Contents.json');
    
    // Check if color asset exists
    let needsCreation = false;
    
    if (!fs.existsSync(colorSetPath)) {
      console.log('   ⚠️  SplashBackgroundColor.colorset NOT FOUND!');
      needsCreation = true;
    } else if (!fs.existsSync(contentsPath)) {
      console.log('   ⚠️  Contents.json missing in colorset!');
      needsCreation = true;
    } else {
      // Validate Contents.json
      try {
        const contents = JSON.parse(fs.readFileSync(contentsPath, 'utf8'));
        if (!contents.colors || contents.colors.length === 0) {
          console.log('   ⚠️  Contents.json invalid (no colors)');
          needsCreation = true;
        } else {
          console.log('   ✅ Color asset exists and is valid');
        }
      } catch (e) {
        console.log('   ⚠️  Contents.json corrupted:', e.message);
        needsCreation = true;
      }
    }
    
    if (needsCreation) {
      console.log('   🔧 FORCE recreating color asset...');
      
      // Create directory
      if (!fs.existsSync(colorSetPath)) {
        fs.mkdirSync(colorSetPath, { recursive: true });
      }
      
      // Parse color
      const colorHex = splashBg.replace('#', '');
      const r = (parseInt(colorHex.substr(0, 2), 16) / 255).toFixed(3);
      const g = (parseInt(colorHex.substr(2, 2), 16) / 255).toFixed(3);
      const b = (parseInt(colorHex.substr(4, 2), 16) / 255).toFixed(3);
      
      // Create Contents.json
      const colorContents = {
        "colors": [
          {
            "idiom": "universal",
            "color": {
              "color-space": "srgb",
              "components": {
                "red": r,
                "green": g,
                "blue": b,
                "alpha": "1.000"
              }
            }
          }
        ],
        "info": {
          "author": "cordova-plugin-change-app-info",
          "version": 1
        }
      };
      
      fs.writeFileSync(contentsPath, JSON.stringify(colorContents, null, 2), 'utf8');
      console.log('   ✅ Created SplashBackgroundColor.colorset');
      console.log(`   ✅ RGB: (${r}, ${g}, ${b})`);
    }
    
    // CRITICAL: Ensure Info.plist references the color asset with BOTH keys
    const plistPath = path.join(iosPath, projectName, `${projectName}-Info.plist`);
    if (fs.existsSync(plistPath)) {
      let plistContent = fs.readFileSync(plistPath, 'utf8');
      let modified = false;
      
      // Remove old UILaunchScreen if exists
      if (plistContent.includes('<key>UILaunchScreen</key>')) {
        console.log('   🔧 Updating existing UILaunchScreen...');
        plistContent = plistContent.replace(
          /<key>UILaunchScreen<\/key>\s*<dict>[\s\S]*?<\/dict>/,
          ''
        );
        modified = true;
      }
      
      // Add new UILaunchScreen with BOTH UIColorName AND UIImageName
      // UIImageName is CRITICAL for iOS to load the color asset properly
      const uiLaunchScreen = `  <key>UILaunchScreen</key>\n  <dict>\n    <key>UIColorName</key>\n    <string>SplashBackgroundColor</string>\n    <key>UIImageName</key>\n    <string></string>\n    <key>UIImageRespectsSafeAreaInsets</key>\n    <false/>\n  </dict>`;
      
      plistContent = plistContent.replace(
        '</dict>\n</plist>',
        `${uiLaunchScreen}\n</dict>\n</plist>`
      );
      
      fs.writeFileSync(plistPath, plistContent, 'utf8');
      console.log('   ✅ Added/Updated UILaunchScreen in Info.plist');
      console.log('   ✅ Included UIImageName (critical for color loading)');
    }
    
  } catch (error) {
    console.log('   ⚠️  Color asset check failed:', error.message);
    console.error(error.stack);
  }
}

async function forceRegenerateIcons(context, iosPath) {
  console.log('🔄 FORCE Regenerating Icons from CDN');
  console.log('   🎯 This overrides ANY previous icon changes (including OutSystems)');
  
  try {
    const ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, 'config.xml'));
    const cdnIcon = config.getPreference('CDN_ICON');
    
    if (!cdnIcon) {
      console.log('   ℹ️  No CDN_ICON preference, skipping force regeneration');
      return;
    }
    
    console.log(`   🌐 CDN URL: ${cdnIcon}`);
    
    // Check for image processor
    let sharp, Jimp, processor;
    try {
      sharp = require('sharp');
      processor = 'sharp';
      console.log('   ✅ Using sharp (recommended)');
    } catch (e) {
      try {
        Jimp = require('jimp');
        processor = 'jimp';
        console.log('   ✅ Using jimp (fallback)');
      } catch (e2) {
        console.log('   ❌ No image processor available!');
        console.log('   💡 Install: npm install sharp OR npm install jimp');
        console.log('   ⚠️  Icons will NOT be regenerated - using existing icons');
        return;
      }
    }
    
    // Download icon
    console.log('   💾 Downloading icon from CDN...');
    let iconBuffer;
    try {
      iconBuffer = await downloadFile(cdnIcon);
      console.log(`   ✅ Downloaded ${(iconBuffer.length / 1024).toFixed(2)} KB`);
    } catch (downloadError) {
      console.log('   ❌ Download failed:', downloadError.message);
      console.log('   ⚠️  Icons will NOT be regenerated - using existing icons');
      return;
    }
    
    if (!iconBuffer || iconBuffer.length === 0) {
      console.log('   ❌ Downloaded file is empty');
      return;
    }
    
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const appPath = path.join(iosPath, projectName);
    
    // Find .xcassets - PRIORITIZE Assets.xcassets (MABS 12)
    const possiblePaths = [
      path.join(appPath, 'Assets.xcassets/AppIcon.appiconset'),  // MABS 12 uses this
      path.join(appPath, 'Images.xcassets/AppIcon.appiconset')   // Legacy/fallback
    ];
    
    let assetsPath = null;
    let foundPath = null;
    
    for (const p of possiblePaths) {
      const parentDir = path.dirname(p);
      if (fs.existsSync(parentDir)) {
        assetsPath = p;
        foundPath = parentDir;
        console.log(`   ✅ Found: ${path.basename(parentDir)}`);
        break;
      }
    }
    
    if (!assetsPath) {
      console.log('   ⚠️  .xcassets folder not found');
      console.log('   💡 Searched paths:');
      possiblePaths.forEach(p => console.log(`      - ${p}`));
      return;
    }
    
    // Create AppIcon.appiconset if not exists
    if (!fs.existsSync(assetsPath)) {
      fs.mkdirSync(assetsPath, { recursive: true });
      console.log('   📁 Created AppIcon.appiconset');
    }
    
    // FORCE delete ALL existing icons
    console.log('   🧹 FORCE cleaning ALL existing icons...');
    const existingIcons = fs.readdirSync(assetsPath).filter(f => f.endsWith('.png'));
    existingIcons.forEach(icon => {
      try {
        fs.unlinkSync(path.join(assetsPath, icon));
      } catch (e) {}
    });
    console.log(`   ✅ Deleted ${existingIcons.length} existing icon(s)`);
    
    // All iOS icon sizes
    const sizes = [
      { size: 20, scale: 2, idiom: 'iphone' },
      { size: 20, scale: 3, idiom: 'iphone' },
      { size: 29, scale: 2, idiom: 'iphone' },
      { size: 29, scale: 3, idiom: 'iphone' },
      { size: 40, scale: 2, idiom: 'iphone' },
      { size: 40, scale: 3, idiom: 'iphone' },
      { size: 60, scale: 2, idiom: 'iphone' },
      { size: 60, scale: 3, idiom: 'iphone' },
      { size: 20, scale: 1, idiom: 'ipad' },
      { size: 20, scale: 2, idiom: 'ipad' },
      { size: 29, scale: 1, idiom: 'ipad' },
      { size: 29, scale: 2, idiom: 'ipad' },
      { size: 40, scale: 1, idiom: 'ipad' },
      { size: 40, scale: 2, idiom: 'ipad' },
      { size: 76, scale: 1, idiom: 'ipad' },
      { size: 76, scale: 2, idiom: 'ipad' },
      { size: 83.5, scale: 2, idiom: 'ipad' },
      { size: 1024, scale: 1, idiom: 'ios-marketing' }
    ];
    
    console.log(`   🎨 FORCE generating ${sizes.length} icon sizes...`);
    
    const images = [];
    let successCount = 0;
    
    for (const icon of sizes) {
      const actualSize = Math.floor(icon.size * icon.scale);
      const filename = `icon-${icon.size}@${icon.scale}x.png`;
      const filepath = path.join(assetsPath, filename);
      
      try {
        if (processor === 'sharp') {
          await sharp(iconBuffer)
            .resize(actualSize, actualSize, {
              fit: 'cover',
              position: 'center'
            })
            .png()
            .toFile(filepath);
        } else if (processor === 'jimp') {
          const image = await Jimp.read(iconBuffer);
          await image.resize(actualSize, actualSize).writeAsync(filepath);
        }
        
        if (fs.existsSync(filepath)) {
          const stats = fs.statSync(filepath);
          if (stats.size > 0) {
            successCount++;
            images.push({
              size: `${icon.size}x${icon.size}`,
              idiom: icon.idiom,
              filename: filename,
              scale: `${icon.scale}x`
            });
          }
        }
      } catch (resizeError) {
        console.log(`   ⚠️  Failed ${actualSize}x${actualSize}:`, resizeError.message);
      }
    }
    
    if (successCount === 0) {
      console.log('   ❌ No icons generated!');
      return;
    }
    
    // FORCE overwrite Contents.json
    const contentsJson = {
      images: images,
      info: {
        version: 1,
        author: 'cordova-plugin-change-app-info (FORCE OVERRIDE)'
      }
    };
    
    fs.writeFileSync(
      path.join(assetsPath, 'Contents.json'),
      JSON.stringify(contentsJson, null, 2),
      'utf8'
    );
    
    console.log(`   ✅ FORCE generated ${successCount}/${sizes.length} icon sizes`);
    console.log(`   ✅ FORCE updated Contents.json`);
    console.log(`   ✅ Icons FINAL and ready for Xcode compilation!`);
    
  } catch (error) {
    console.log('   ❌ Force regeneration failed:', error.message);
    console.error(error.stack);
  }
}

async function cleanCompiledAssets(iosPath) {
  console.log('🧹 Cleaning Compiled Assets');
  
  try {
    const { execSync } = require('child_process');
    
    const findStoryboards = `find "${iosPath}" -name "*.storyboardc" -type d 2>/dev/null || true`;
    const storyboards = execSync(findStoryboards, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim());
    
    let cleaned = 0;
    storyboards.forEach(dir => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        cleaned++;
      } catch (err) {}
    });
    
    if (cleaned > 0) {
      console.log(`   ✅ Cleaned ${cleaned} compiled storyboard(s)`);
    } else {
      console.log('   ℹ️  No compiled assets to clean');
    }
    
  } catch (error) {
    console.log('   ⚠️  Cleaning skipped:', error.message);
  }
}

async function validateIcons(iosPath) {
  console.log('🔍 Validating Final Icon State');
  
  try {
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const appPath = path.join(iosPath, projectName);
    
    // Check both possible locations - PRIORITIZE Assets.xcassets
    const possiblePaths = [
      path.join(appPath, 'Assets.xcassets/AppIcon.appiconset'),
      path.join(appPath, 'Images.xcassets/AppIcon.appiconset')
    ];
    
    let assetsPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        assetsPath = p;
        break;
      }
    }
    
    if (!assetsPath) {
      console.log('   ❌ AppIcon.appiconset NOT FOUND!');
      return;
    }
    
    console.log(`   ✅ Found: ${path.basename(path.dirname(assetsPath))}/AppIcon.appiconset`);
    
    const contents = path.join(assetsPath, 'Contents.json');
    if (fs.existsSync(contents)) {
      const json = JSON.parse(fs.readFileSync(contents, 'utf8'));
      console.log(`   ✅ Contents.json: ${json.images.length} icon definitions`);
      console.log(`   ℹ️  Author: ${json.info.author || 'unknown'}`);
    }
    
    const files = fs.readdirSync(assetsPath).filter(f => f.endsWith('.png'));
    console.log(`   ✅ Found ${files.length} PNG file(s)`);
    
    if (files.length === 0) {
      console.log('   ❌ WARNING: No PNG files found!');
      console.log('   💡 Icons may not display in app');
    } else {
      console.log('   ✅ Icons ready for compilation');
    }
    
  } catch (error) {
    console.log('   ⚠️  Validation skipped:', error.message);
  }
}

async function validateColorAsset(iosPath) {
  console.log('🔍 Validating Color Asset');
  
  try {
    const xcodeProjects = fs.readdirSync(iosPath).filter(f => f.endsWith('.xcodeproj'));
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const appPath = path.join(iosPath, projectName);
    
    // Find .xcassets - PRIORITIZE Assets.xcassets
    const xcassetsFolders = fs.readdirSync(appPath)
      .filter(f => {
        const xcassetsPath = path.join(appPath, f);
        return f.endsWith('.xcassets') && fs.statSync(xcassetsPath).isDirectory();
      })
      .sort((a, b) => {
        if (a === 'Assets.xcassets') return -1;
        if (b === 'Assets.xcassets') return 1;
        return 0;
      });
    
    if (xcassetsFolders.length === 0) {
      console.log('   ⚠️  No .xcassets folder found');
      return;
    }
    
    const xcassetsPath = path.join(appPath, xcassetsFolders[0]);
    const colorSetPath = path.join(xcassetsPath, 'SplashBackgroundColor.colorset');
    const contentsPath = path.join(colorSetPath, 'Contents.json');
    
    if (!fs.existsSync(colorSetPath)) {
      console.log('   ❌ SplashBackgroundColor.colorset NOT FOUND!');
      console.log('   💡 Native splash color will not work');
      return;
    }
    
    if (!fs.existsSync(contentsPath)) {
      console.log('   ❌ Contents.json missing!');
      return;
    }
    
    const contents = JSON.parse(fs.readFileSync(contentsPath, 'utf8'));
    if (contents.colors && contents.colors.length > 0) {
      const color = contents.colors[0].color.components;
      console.log(`   ✅ SplashBackgroundColor.colorset exists`);
      console.log(`   ✅ RGB: (${color.red}, ${color.green}, ${color.blue})`);
      console.log('   ✅ Native splash color ready for compilation');
    } else {
      console.log('   ❌ Invalid color data!');
    }
    
    // Check Info.plist
    const plistPath = path.join(iosPath, projectName, `${projectName}-Info.plist`);
    if (fs.existsSync(plistPath)) {
      const plistContent = fs.readFileSync(plistPath, 'utf8');
      if (plistContent.includes('<key>UILaunchScreen</key>')) {
        const hasUIImageName = plistContent.includes('<key>UIImageName</key>');
        console.log(`   ✅ Info.plist has UILaunchScreen reference`);
        if (hasUIImageName) {
          console.log('   ✅ UIImageName key present (critical for color loading)');
        } else {
          console.log('   ⚠️  UIImageName missing (may affect color loading)');
        }
      } else {
        console.log('   ❌ Info.plist missing UILaunchScreen!');
      }
    }
    
  } catch (error) {
    console.log('   ⚠️  Validation skipped:', error.message);
  }
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
      
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          return reject(new Error('Downloaded file is empty'));
        }
        resolve(buffer);
      });
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout after 30s'));
    });
  });
}
