#!/usr/bin/env node

/**
 * FINAL Color Override Hook - LAST RESORT
 * 
 * Runs on before_build (iOS only) - RIGHT BEFORE Xcode compilation
 * This is the LAST CHANCE to override colors before app is built.
 * 
 * This hook MUST run AFTER all OutSystems prepare steps that might override colors.
 * 
 * What it does:
 * 1. Finds Assets.xcassets color sets (SplashScreenBackgroundColor, BackgroundColor)
 * 2. Updates ALL color values to target color
 * 3. Updates LaunchScreen.storyboard to reference the color sets
 * 4. Updates MainViewController.m background color
 * 5. Updates Info.plist UILaunchStoryboardBackgroundColor
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255.0;
  const g = parseInt(hex.substring(2, 4), 16) / 255.0;
  const b = parseInt(hex.substring(4, 6), 16) / 255.0;
  return { r, g, b };
}

function updateColorSet(colorSetPath, colorName, newColor, newRgb) {
  const contentsJsonPath = path.join(colorSetPath, 'Contents.json');
  
  if (!fs.existsSync(contentsJsonPath)) {
    console.log(`   ⚠️  ${colorName} Contents.json not found`);
    return false;
  }
  
  try {
    const colorData = {
      "colors": [
        {
          "idiom": "universal",
          "color": {
            "color-space": "srgb",
            "components": {
              "red": newRgb.r.toFixed(3),
              "green": newRgb.g.toFixed(3),
              "blue": newRgb.b.toFixed(3),
              "alpha": "1.000"
            }
          }
        }
      ],
      "info": {
        "author": "xcode",
        "version": 1
      }
    };
    
    fs.writeFileSync(contentsJsonPath, JSON.stringify(colorData, null, 2), 'utf8');
    console.log(`   ✅ ${colorName} → ${newColor}`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error updating ${colorName}: ${error.message}`);
    return false;
  }
}

function findAppFolder(iosPath) {
  const folders = fs.readdirSync(iosPath);
  
  for (const folder of folders) {
    const fullPath = path.join(iosPath, folder);
    if (!fs.statSync(fullPath).isDirectory()) continue;
    
    // Skip known system folders
    if (['CordovaLib', 'www', 'cordova', 'build', 'Pods', 'platform_www'].includes(folder)) {
      continue;
    }
    
    // Check if this folder contains Assets.xcassets
    const xcassetsPath = path.join(fullPath, 'Assets.xcassets');
    if (fs.existsSync(xcassetsPath)) {
      return { appFolder: folder, appPath: fullPath };
    }
  }
  
  return null;
}

function updateMainViewController(appPath, newColor, newRgb) {
  // Search for MainViewController.m
  function findMainViewController(dir, depth = 0) {
    if (depth > 2) return null;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile() && item === 'MainViewController.m') {
          return fullPath;
        } else if (stat.isDirectory() && !['build', 'Pods', 'www'].includes(item)) {
          const found = findMainViewController(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Skip permission errors
    }
    
    return null;
  }
  
  const vcPath = findMainViewController(appPath);
  
  if (!vcPath) {
    console.log('   ⚠️  MainViewController.m not found');
    return false;
  }
  
  console.log(`   📄 Found MainViewController.m`);
  
  try {
    let content = fs.readFileSync(vcPath, 'utf8');
    
    // Remove any existing backgroundColor lines
    content = content.replace(/\s*self\.view\.backgroundColor = \[UIColor[^;]+;/g, '');
    
    // Find viewDidLoad method
    const viewDidLoadRegex = /(-\s*\(void\)\s*viewDidLoad\s*\{)/;
    
    if (viewDidLoadRegex.test(content)) {
      const bgColorCode = `\n    // FINAL Override: Background color\n    self.view.backgroundColor = [UIColor colorWithRed:${newRgb.r.toFixed(3)} green:${newRgb.g.toFixed(3)} blue:${newRgb.b.toFixed(3)} alpha:1.0];`;
      
      content = content.replace(
        viewDidLoadRegex,
        `$1${bgColorCode}`
      );
      
      fs.writeFileSync(vcPath, content, 'utf8');
      console.log(`   ✅ MainViewController.m background → ${newColor}`);
      return true;
    } else {
      console.log('   ⚠️  viewDidLoad method not found');
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error updating MainViewController.m: ${error.message}`);
    return false;
  }
}

function updateLaunchScreen(appPath, newColor, newRgb) {
  // Search for LaunchScreen.storyboard or CDVLaunchScreen.storyboard
  function findStoryboard(dir, depth = 0) {
    if (depth > 3) return null;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile() && (item === 'LaunchScreen.storyboard' || item === 'CDVLaunchScreen.storyboard')) {
          return fullPath;
        } else if (stat.isDirectory() && !['build', 'Pods', 'www'].includes(item)) {
          const found = findStoryboard(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Skip permission errors
    }
    
    return null;
  }
  
  const storyboardPath = findStoryboard(appPath);
  
  if (!storyboardPath) {
    console.log('   ⚠️  LaunchScreen.storyboard not found');
    return false;
  }
  
  console.log(`   📄 Found LaunchScreen.storyboard`);
  
  try {
    let content = fs.readFileSync(storyboardPath, 'utf8');
    const originalContent = content;
    
    // Strategy: Keep named color references if they exist
    // (we just updated those color sets)
    const namedColorRegex = /<color[^>]*name="(SplashScreenBackgroundColor|BackgroundColor)"[^>]*\/>/g;
    const hasNamedColors = namedColorRegex.test(content);
    
    if (hasNamedColors) {
      console.log('   ✓ Storyboard uses named colors (color sets updated)');
      return true;
    }
    
    // Otherwise, update all backgroundColor tags
    const colorPattern = /<color key="backgroundColor"[^/]*\/>/g;
    
    if (content.match(colorPattern)) {
      content = content.replace(
        colorPattern,
        `<color key="backgroundColor" red="${newRgb.r.toFixed(3)}" green="${newRgb.g.toFixed(3)}" blue="${newRgb.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`
      );
      
      if (content !== originalContent) {
        fs.writeFileSync(storyboardPath, content, 'utf8');
        console.log(`   ✅ LaunchScreen.storyboard colors updated → ${newColor}`);
        return true;
      }
    }
    
    console.log('   ℹ️  No backgroundColor tags to update in storyboard');
    return false;
  } catch (error) {
    console.log(`   ❌ Error updating LaunchScreen.storyboard: ${error.message}`);
    return false;
  }
}

function updateInfoPlist(appPath, newColor) {
  // Search for Info.plist
  function findInfoPlist(dir, depth = 0) {
    if (depth > 2) return null;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile() && (item.endsWith('-Info.plist') || item === 'Info.plist')) {
          return fullPath;
        } else if (stat.isDirectory() && !['build', 'Pods', 'www'].includes(item)) {
          const found = findInfoPlist(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Skip permission errors
    }
    
    return null;
  }
  
  const plistPath = findInfoPlist(appPath);
  
  if (!plistPath) {
    console.log('   ⚠️  Info.plist not found');
    return false;
  }
  
  console.log(`   📄 Found Info.plist`);
  
  try {
    let content = fs.readFileSync(plistPath, 'utf8');
    
    const bgColorKey = 'UILaunchStoryboardBackgroundColor';
    const bgColorValue = `\n\t<key>${bgColorKey}</key>\n\t<string>${newColor}</string>`;
    
    if (content.includes(bgColorKey)) {
      // Update existing
      const regex = new RegExp(`<key>${bgColorKey}</key>\\n\\t<string>[^<]+</string>`);
      content = content.replace(regex, `<key>${bgColorKey}</key>\n\t<string>${newColor}</string>`);
      console.log(`   ✅ Updated ${bgColorKey} in Info.plist`);
    } else {
      // Add new - insert before </dict>
      content = content.replace(/<\/dict>\s*<\/plist>/, `${bgColorValue}\n</dict>\n</plist>`);
      console.log(`   ✅ Added ${bgColorKey} to Info.plist`);
    }
    
    fs.writeFileSync(plistPath, content, 'utf8');
    return true;
  } catch (error) {
    console.log(`   ❌ Error updating Info.plist: ${error.message}`);
    return false;
  }
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  // Only run for iOS
  if (!platforms.includes('ios')) {
    return;
  }
  
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  const newColor = config.getPreference("SplashScreenBackgroundColor") ||
                   config.getPreference("BackgroundColor");
  
  if (!newColor) {
    console.log('\n⏭️  No background color configured, skipping final override');
    return;
  }
  
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  🎨 FINAL COLOR OVERRIDE (Before Build)');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`Target Color: ${newColor}`);
  console.log('This is the LAST override before Xcode compilation');
  
  const iosPath = path.join(root, 'platforms/ios');
  
  if (!fs.existsSync(iosPath)) {
    console.log('\n❌ iOS platform folder not found');
    return;
  }
  
  // Find app folder
  const appInfo = findAppFolder(iosPath);
  
  if (!appInfo) {
    console.log('\n❌ Could not find app folder with Assets.xcassets');
    return;
  }
  
  console.log(`\n📁 App Folder: ${appInfo.appFolder}`);
  
  const xcassetsPath = path.join(appInfo.appPath, 'Assets.xcassets');
  console.log(`📁 Assets.xcassets: ${xcassetsPath}`);
  
  const newRgb = hexToRgb(newColor);
  let updatedCount = 0;
  
  // 1. Update SplashScreenBackgroundColor color set
  console.log('\n🎨 Updating Color Sets...');
  const splashColorSetPath = path.join(xcassetsPath, 'SplashScreenBackgroundColor.colorset');
  if (fs.existsSync(splashColorSetPath)) {
    if (updateColorSet(splashColorSetPath, 'SplashScreenBackgroundColor', newColor, newRgb)) {
      updatedCount++;
    }
  } else {
    console.log('   ⚠️  SplashScreenBackgroundColor.colorset not found - OutSystems might not have created it');
  }
  
  // 2. Update BackgroundColor color set
  const bgColorSetPath = path.join(xcassetsPath, 'BackgroundColor.colorset');
  if (fs.existsSync(bgColorSetPath)) {
    if (updateColorSet(bgColorSetPath, 'BackgroundColor', newColor, newRgb)) {
      updatedCount++;
    }
  } else {
    console.log('   ℹ️  BackgroundColor.colorset not found (optional)');
  }
  
  // 3. Update LaunchScreen.storyboard
  console.log('\n📄 Updating LaunchScreen.storyboard...');
  if (updateLaunchScreen(appInfo.appPath, newColor, newRgb)) {
    updatedCount++;
  }
  
  // 4. Update MainViewController.m
  console.log('\n📄 Updating MainViewController.m...');
  if (updateMainViewController(appInfo.appPath, newColor, newRgb)) {
    updatedCount++;
  }
  
  // 5. Update Info.plist
  console.log('\n📄 Updating Info.plist...');
  if (updateInfoPlist(appInfo.appPath, newColor)) {
    updatedCount++;
  }
  
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`✅ Final override completed! (${updatedCount} updates)`);
  console.log(`🎯 Color: ${newColor}`);
  console.log(`🎯 RGB: red=${newRgb.r.toFixed(3)} green=${newRgb.g.toFixed(3)} blue=${newRgb.b.toFixed(3)}`);
  console.log('══════════════════════════════════════════════════════════\n');
};
