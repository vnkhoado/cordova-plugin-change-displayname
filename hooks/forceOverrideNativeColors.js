#!/usr/bin/env node

/**
 * Force Override Native Colors Hook
 * 
 * Overrides native background colors in iOS and Android that appear
 * BEFORE the splash screen (window background, theme colors).
 * 
 * iOS:
 * - MainViewController.m background color
 * - LaunchScreen.storyboard background
 * 
 * Android:
 * - colors.xml color resources (colorPrimary, colorPrimaryDark, etc.)
 * - styles.xml theme colors
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

function overrideIOSNativeColors(iosPath, newColor) {
  console.log('\n📱 iOS Native Color Override...');
  
  // Find app folder
  const appFolders = fs.readdirSync(iosPath).filter(f => {
    const fullPath = path.join(iosPath, f);
    return fs.statSync(fullPath).isDirectory() && 
           f !== "CordovaLib" && 
           f !== "www" && 
           f !== "cordova" &&
           f !== "build" &&
           f !== "Pods";
  });
  
  if (appFolders.length === 0) {
    console.log('   ❌ iOS app folder not found');
    return;
  }
  
  const appFolder = appFolders[0];
  const appPath = path.join(iosPath, appFolder);
  
  console.log(`   📁 App folder: ${appFolder}`);
  
  // 1. Override MainViewController.m
  const mainViewControllerPaths = [
    path.join(appPath, 'Classes/MainViewController.m'),
    path.join(appPath, 'Plugins/MainViewController.m'),
  ];
  
  for (const vcPath of mainViewControllerPaths) {
    if (fs.existsSync(vcPath)) {
      try {
        let content = fs.readFileSync(vcPath, 'utf8');
        const rgb = hexToRgb(newColor);
        
        // Find viewDidLoad method and add background color
        const viewDidLoadRegex = /(-\s*\(void\)\s*viewDidLoad\s*\{[^}]*)/;
        
        if (viewDidLoadRegex.test(content)) {
          const bgColorCode = `\n    // Force background color from plugin\n    self.view.backgroundColor = [UIColor colorWithRed:${rgb.r.toFixed(3)} green:${rgb.g.toFixed(3)} blue:${rgb.b.toFixed(3)} alpha:1.0];\n`;
          
          // Remove existing backgroundColor lines
          content = content.replace(/\s*self\.view\.backgroundColor = \[UIColor[^;]+;/g, '');
          
          // Add new backgroundColor after viewDidLoad opening brace
          content = content.replace(
            /(-\s*\(void\)\s*viewDidLoad\s*\{)/,
            `$1${bgColorCode}`
          );
          
          fs.writeFileSync(vcPath, content, 'utf8');
          console.log(`   ✅ Updated MainViewController.m background to ${newColor}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error updating MainViewController.m: ${error.message}`);
      }
      break;
    }
  }
  
  // 2. Override LaunchScreen.storyboard
  const launchScreenPaths = [
    path.join(appPath, 'Resources/LaunchScreen.storyboard'),
    path.join(appPath, 'LaunchScreen.storyboard'),
  ];
  
  for (const storyboardPath of launchScreenPaths) {
    if (fs.existsSync(storyboardPath)) {
      try {
        let content = fs.readFileSync(storyboardPath, 'utf8');
        const rgb = hexToRgb(newColor);
        
        // Replace backgroundColor in view definitions
        const colorRegex = /<color[^>]*key="backgroundColor"[^>]*\/>/g;
        const newColorTag = `<color key="backgroundColor" red="${rgb.r.toFixed(3)}" green="${rgb.g.toFixed(3)}" blue="${rgb.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`;
        
        if (colorRegex.test(content)) {
          content = content.replace(colorRegex, newColorTag);
          fs.writeFileSync(storyboardPath, content, 'utf8');
          console.log(`   ✅ Updated LaunchScreen.storyboard background to ${newColor}`);
        } else {
          console.log('   ℹ️  No backgroundColor found in LaunchScreen.storyboard');
        }
      } catch (error) {
        console.log(`   ⚠️  Error updating LaunchScreen.storyboard: ${error.message}`);
      }
      break;
    }
  }
}

function overrideAndroidNativeColors(androidPath, newColor, oldColor) {
  console.log('\n📱 Android Native Color Override...');
  
  // Find res folder
  const resPaths = [
    path.join(androidPath, 'app/src/main/res'),
    path.join(androidPath, 'res')
  ];
  
  let resPath = null;
  for (const p of resPaths) {
    if (fs.existsSync(p)) {
      resPath = p;
      break;
    }
  }
  
  if (!resPath) {
    console.log('   ❌ Android res folder not found');
    return;
  }
  
  console.log(`   📁 Res folder: ${resPath}`);
  
  // 1. Override colors.xml
  const colorsXmlPath = path.join(resPath, 'values/colors.xml');
  
  if (fs.existsSync(colorsXmlPath)) {
    try {
      let content = fs.readFileSync(colorsXmlPath, 'utf8');
      let changeCount = 0;
      
      // Replace specific color names
      const colorNames = [
        'colorPrimary',
        'colorPrimaryDark',
        'colorAccent',
        'color_primary',
        'primary_color'
      ];
      
      for (const colorName of colorNames) {
        const regex = new RegExp(`(<color name="${colorName}">)[^<]+(</color>)`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, `$1${newColor}$2`);
          changeCount++;
        }
      }
      
      // Also replace old color hex values
      if (oldColor) {
        const oldColorUpper = oldColor.toUpperCase();
        const oldColorLower = oldColor.toLowerCase();
        content = content.replace(new RegExp(oldColorUpper, 'g'), newColor);
        content = content.replace(new RegExp(oldColorLower, 'g'), newColor);
      }
      
      fs.writeFileSync(colorsXmlPath, content, 'utf8');
      console.log(`   ✅ Updated colors.xml (${changeCount} color names + hex values)`);
    } catch (error) {
      console.log(`   ⚠️  Error updating colors.xml: ${error.message}`);
    }
  }
  
  // 2. Override styles.xml
  const stylesXmlPath = path.join(resPath, 'values/styles.xml');
  
  if (fs.existsSync(stylesXmlPath)) {
    try {
      let content = fs.readFileSync(stylesXmlPath, 'utf8');
      
      // Replace color references and hex values
      if (oldColor) {
        const oldColorUpper = oldColor.toUpperCase();
        const oldColorLower = oldColor.toLowerCase();
        const beforeCount = (content.match(new RegExp(oldColorUpper, 'g')) || []).length;
        
        content = content.replace(new RegExp(oldColorUpper, 'g'), newColor);
        content = content.replace(new RegExp(oldColorLower, 'g'), newColor);
        
        const afterCount = (content.match(new RegExp(oldColorUpper, 'g')) || []).length;
        
        if (beforeCount > afterCount) {
          fs.writeFileSync(stylesXmlPath, content, 'utf8');
          console.log(`   ✅ Updated styles.xml (${beforeCount} occurrences)`);
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Error updating styles.xml: ${error.message}`);
    }
  }
  
  // 3. Override drawable splash backgrounds
  const drawableFolders = fs.readdirSync(resPath)
    .filter(f => f.startsWith('drawable'))
    .map(f => path.join(resPath, f));
  
  for (const drawableFolder of drawableFolders) {
    const splashXmlPath = path.join(drawableFolder, 'splash.xml');
    
    if (fs.existsSync(splashXmlPath)) {
      try {
        let content = fs.readFileSync(splashXmlPath, 'utf8');
        
        // Replace solid color in splash drawable
        const solidColorRegex = /<solid android:color="[^"]+"/g;
        const newSolidColor = `<solid android:color="${newColor}"`;
        
        if (solidColorRegex.test(content)) {
          content = content.replace(solidColorRegex, newSolidColor);
          fs.writeFileSync(splashXmlPath, content, 'utf8');
          console.log(`   ✅ Updated ${path.basename(drawableFolder)}/splash.xml`);
        }
      } catch (error) {
        // Skip
      }
    }
  }
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Get colors from config
  const newColor = config.getPreference("SplashScreenBackgroundColor") ||
                   config.getPreference("BackgroundColor");
  
  const oldColor = config.getPreference("OLD_COLOR");
  
  if (!newColor) {
    console.log('\n⏭️  No background color configured, skipping native override');
    return;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🎨 NATIVE COLOR OVERRIDE (Pre-Splash)');
  console.log('══════════════════════════════════════════════');
  console.log(`New Color: ${newColor}`);
  if (oldColor) {
    console.log(`Old Color: ${oldColor}`);
  }
  
  for (const platform of platforms) {
    if (platform === 'ios') {
      const iosPath = path.join(root, 'platforms/ios');
      if (fs.existsSync(iosPath)) {
        overrideIOSNativeColors(iosPath, newColor);
      }
    } else if (platform === 'android') {
      const androidPath = path.join(root, 'platforms/android');
      if (fs.existsSync(androidPath)) {
        overrideAndroidNativeColors(androidPath, newColor, oldColor);
      }
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Native color override completed!');
  console.log('══════════════════════════════════════════════\n');
};
