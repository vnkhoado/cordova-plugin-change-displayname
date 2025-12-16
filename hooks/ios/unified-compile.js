#!/usr/bin/env node

/**
 * iOS Unified Compile Hook
 * Runs BEFORE Xcode compile, AFTER OutSystems modifications
 * This is the LAST chance to override any settings!
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
    
    // CRITICAL: Force regenerate icons AFTER OutSystems modifications
    await forceRegenerateIcons(context, iosPath);
    
    // Clean compiled assets
    await cleanCompiledAssets(iosPath);
    
    // Validate final state
    await validateIcons(iosPath);
    
    console.log('✅ iOS Compile Phase Complete!');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error in iOS Compile Phase:', error.message);
    console.log('⚠️  Continuing with Xcode build...\n');
  }
};

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
    
    // Find Images.xcassets (could be in different locations)
    const appPath = path.join(iosPath, projectName);
    let assetsPath = path.join(appPath, 'Images.xcassets/AppIcon.appiconset');
    
    // Check alternative location (Assets.xcassets)
    if (!fs.existsSync(path.join(appPath, 'Images.xcassets'))) {
      const altPath = path.join(appPath, 'Assets.xcassets');
      if (fs.existsSync(altPath)) {
        assetsPath = path.join(altPath, 'AppIcon.appiconset');
      }
    }
    
    if (!fs.existsSync(path.dirname(assetsPath))) {
      console.log('   ⚠️  .xcassets folder not found');
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
    
    // Check both possible locations
    const possiblePaths = [
      path.join(appPath, 'Images.xcassets/AppIcon.appiconset'),
      path.join(appPath, 'Assets.xcassets/AppIcon.appiconset')
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
