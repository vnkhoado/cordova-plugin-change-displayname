#!/usr/bin/env node

/**
 * Force Override Native Colors Hook
 * 
 * Overrides native background colors in iOS and Android that appear
 * BEFORE the splash screen (window background, theme colors).
 * 
 * iOS:
 * - MainViewController.m background color
 * - LaunchScreen.storyboard background (DEEP SCAN - all nested views)
 * - Assets.xcassets color assets (named colors) - CREATE if not exists
 * - Info.plist UILaunchStoryboardBackgroundColor
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

function rgbToString(rgb, precision = 3) {
  return `red="${rgb.r.toFixed(precision)}" green="${rgb.g.toFixed(precision)}" blue="${rgb.b.toFixed(precision)}"`;
}

function findFile(baseDir, patterns) {
  // Recursively search for file matching patterns
  function searchDir(dir, depth = 0) {
    if (depth > 3) return null; // Max depth
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          for (const pattern of patterns) {
            if (item === pattern || item.endsWith(pattern)) {
              return fullPath;
            }
          }
        } else if (stat.isDirectory()) {
          // Skip common excluded directories
          if (['node_modules', 'build', 'Pods', '.git'].includes(item)) {
            continue;
          }
          const found = searchDir(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Skip permission errors
    }
    
    return null;
  }
  
  return searchDir(baseDir);
}

function findAllFiles(baseDir, patterns, maxDepth = 3) {
  const results = [];
  
  function searchDir(dir, depth = 0) {
    if (depth > maxDepth) return;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          for (const pattern of patterns) {
            if (item === pattern || item.endsWith(pattern)) {
              results.push(fullPath);
            }
          }
        } else if (stat.isDirectory()) {
          if (['node_modules', 'build', 'Pods', '.git'].includes(item)) {
            continue;
          }
          searchDir(fullPath, depth + 1);
        }
      }
    } catch (error) {
      // Skip permission errors
    }
  }
  
  searchDir(baseDir);
  return results;
}

function createOrUpdateColorSet(xcassetsPath, colorSetName, newColor, newRgb) {
  const colorSetDir = path.join(xcassetsPath, `${colorSetName}.colorset`);
  const contentsJsonPath = path.join(colorSetDir, 'Contents.json');
  
  // Create colorset directory if not exists
  if (!fs.existsSync(colorSetDir)) {
    console.log(`   📁 Creating new color set: ${colorSetName}`);
    fs.mkdirSync(colorSetDir, { recursive: true });
  }
  
  // Create Contents.json with color values
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
  console.log(`   ✅ ${fs.existsSync(contentsJsonPath) ? 'Updated' : 'Created'} ${colorSetName} → ${newColor}`);
  
  return true;
}

function overrideIOSColorAssets(appPath, newColor, newRgb) {
  console.log('\n   🎨 Managing Color Assets in Assets.xcassets...');
  
  // Find Assets.xcassets folder
  const xcassetsPaths = findAllFiles(appPath, ['Assets.xcassets']);
  
  if (xcassetsPaths.length === 0) {
    console.log('   ⚠️  Assets.xcassets not found');
    return 0;
  }
  
  const xcassetsPath = xcassetsPaths[0].replace('/Contents.json', '');
  console.log(`   📂 Found Assets.xcassets at: ${path.basename(path.dirname(xcassetsPath))}`);
  
  let updatedAssets = 0;
  
  // 1. CRITICAL: Create or update SplashScreenBackgroundColor color set
  console.log('\n   🎯 Ensuring SplashScreenBackgroundColor exists...');
  if (createOrUpdateColorSet(xcassetsPath, 'SplashScreenBackgroundColor', newColor, newRgb)) {
    updatedAssets++;
  }
  
  // 2. Update any other existing color sets
  const colorAssetPaths = findAllFiles(appPath, ['Contents.json']);
  const colorSetFiles = colorAssetPaths.filter(p => 
    p.includes('.colorset') && 
    p.endsWith('Contents.json') &&
    !p.includes('SplashScreenBackgroundColor') // Skip the one we just created
  );
  
  if (colorSetFiles.length > 0) {
    console.log(`\n   🔍 Found ${colorSetFiles.length} additional color set(s)`);
    
    for (const colorFile of colorSetFiles) {
      try {
        const colorName = path.basename(path.dirname(colorFile));
        console.log(`   📝 Processing: ${colorName}`);
        
        let content = fs.readFileSync(colorFile, 'utf8');
        const original = content;
        
        // Parse JSON
        const colorData = JSON.parse(content);
        
        // Update color components for all appearances
        if (colorData.colors && Array.isArray(colorData.colors)) {
          colorData.colors.forEach(colorEntry => {
            if (colorEntry.color && colorEntry.color.components) {
              colorEntry.color.components.red = newRgb.r.toFixed(3);
              colorEntry.color.components.green = newRgb.g.toFixed(3);
              colorEntry.color.components.blue = newRgb.b.toFixed(3);
              if (!colorEntry.color.components.alpha) {
                colorEntry.color.components.alpha = "1.000";
              }
            }
          });
          
          const newContent = JSON.stringify(colorData, null, 2);
          if (newContent !== original) {
            fs.writeFileSync(colorFile, newContent, 'utf8');
            console.log(`   ✅ Updated ${colorName} to ${newColor}`);
            updatedAssets++;
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Error updating ${path.basename(path.dirname(colorFile))}: ${error.message}`);
      }
    }
  }
  
  return updatedAssets;
}

function overrideIOSNativeColors(iosPath, newColor, oldColor) {
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
  
  const newRgb = hexToRgb(newColor);
  const oldRgb = oldColor ? hexToRgb(oldColor) : null;
  let updatedCount = 0;
  
  // 1. Override MainViewController.m
  console.log('\n   🔍 Searching for MainViewController.m...');
  const vcPath = findFile(appPath, ['MainViewController.m']);
  
  if (vcPath) {
    console.log(`   ✓ Found at: ${path.relative(iosPath, vcPath)}`);
    try {
      let content = fs.readFileSync(vcPath, 'utf8');
      
      // Remove existing backgroundColor lines
      const beforeLines = content.split('\n').length;
      content = content.replace(/\s*self\.view\.backgroundColor = \[UIColor[^;]+;/g, '');
      const removedLines = beforeLines - content.split('\n').length;
      if (removedLines > 0) {
        console.log(`   ℹ️  Removed ${removedLines} existing backgroundColor line(s)`);
      }
      
      // Find viewDidLoad method
      const viewDidLoadRegex = /(-\s*\(void\)\s*viewDidLoad\s*\{)/;
      
      if (viewDidLoadRegex.test(content)) {
        const bgColorCode = `\n    // Plugin: Force background color\n    self.view.backgroundColor = [UIColor colorWithRed:${newRgb.r.toFixed(3)} green:${newRgb.g.toFixed(3)} blue:${newRgb.b.toFixed(3)} alpha:1.0];`;
        
        content = content.replace(
          viewDidLoadRegex,
          `$1${bgColorCode}`
        );
        
        fs.writeFileSync(vcPath, content, 'utf8');
        console.log(`   ✅ Updated MainViewController.m background to ${newColor}`);
        updatedCount++;
      } else {
        console.log('   ⚠️  viewDidLoad method not found in MainViewController.m');
      }
    } catch (error) {
      console.log(`   ❌ Error updating MainViewController.m: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  MainViewController.m not found');
  }
  
  // 2. Override Color Assets in Assets.xcassets (CREATES SplashScreenBackgroundColor if missing)
  const colorAssetsUpdated = overrideIOSColorAssets(appPath, newColor, newRgb);
  if (colorAssetsUpdated > 0) {
    console.log(`   🎯 Managed ${colorAssetsUpdated} color asset(s)`);
    updatedCount++;
  }
  
  // 3. Override LaunchScreen.storyboard - KEEP name attribute if color set exists
  console.log('\n   🔍 Searching for LaunchScreen.storyboard...');
  const storyboardPath = findFile(appPath, ['LaunchScreen.storyboard', 'CDVLaunchScreen.storyboard']);
  
  if (storyboardPath) {
    console.log(`   ✓ Found at: ${path.relative(iosPath, storyboardPath)}`);
    try {
      let content = fs.readFileSync(storyboardPath, 'utf8');
      const originalContent = content;
      let totalReplaced = 0;
      
      console.log('   🔬 SMART REPLACEMENT: Analyzing storyboard...');
      
      // Strategy: Replace color tags but KEEP name="SplashScreenBackgroundColor" 
      // since we just created/updated that color set!
      const allColorRegex = /<color\s+[^>]*\/>/g;
      const allColorMatches = content.match(allColorRegex);
      
      if (allColorMatches && allColorMatches.length > 0) {
        console.log(`   ℹ️  Found ${allColorMatches.length} color tag(s) total`);
        console.log('   📋 Existing colors:');
        allColorMatches.slice(0, 5).forEach((match, idx) => {
          console.log(`      ${idx + 1}. ${match.substring(0, 100)}${match.length > 100 ? '...' : ''}`);
        });
        if (allColorMatches.length > 5) {
          console.log(`      ... and ${allColorMatches.length - 5} more`);
        }
        
        // Replace each color tag
        content = content.replace(allColorRegex, (match) => {
          // If it references SplashScreenBackgroundColor, keep the reference 
          // (we just updated that color set)
          if (match.includes('name="SplashScreenBackgroundColor"')) {
            console.log('   ✓ Keeping SplashScreenBackgroundColor reference (color set updated)');
            return match; // Keep as is
          }
          
          // Otherwise, replace with inline RGB
          return `<color key="backgroundColor" red="${newRgb.r.toFixed(3)}" green="${newRgb.g.toFixed(3)}" blue="${newRgb.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`;
        });
        
        totalReplaced = allColorMatches.length;
        console.log(`   ✅ Processed ${totalReplaced} color tag(s)`);
      }
      
      // Strategy 2: If NO color tags found, inject into ALL view elements
      if (totalReplaced === 0) {
        console.log('   ⚠️  No color tags found, injecting backgroundColor into views...');
        
        const viewOpenTagRegex = /<view([^>]*)>/g;
        let viewMatches = content.match(viewOpenTagRegex);
        
        if (viewMatches && viewMatches.length > 0) {
          console.log(`   ℹ️  Found ${viewMatches.length} view opening tag(s)`);
          
          const colorInjection = `\n                <color key="backgroundColor" name="SplashScreenBackgroundColor"/>`;
          
          content = content.replace(
            viewOpenTagRegex,
            `<view$1>${colorInjection}`
          );
          
          totalReplaced = viewMatches.length;
          console.log(`   ✅ Injected SplashScreenBackgroundColor reference into ${totalReplaced} view(s)`);
        } else {
          console.log('   ⚠️  No view tags found in storyboard');
        }
      }
      
      // Write back if any changes made
      if (content !== originalContent) {
        fs.writeFileSync(storyboardPath, content, 'utf8');
        console.log(`   🎯 Total modifications in storyboard: ${totalReplaced}`);
        console.log(`   ✅ LaunchScreen.storyboard updated to ${newColor}`);
        updatedCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error updating LaunchScreen.storyboard: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  LaunchScreen.storyboard not found');
  }
  
  // 4. Override Info.plist
  console.log('\n   🔍 Searching for Info.plist...');
  const plistPath = findFile(appPath, ['-Info.plist', 'Info.plist']);
  
  if (plistPath) {
    console.log(`   ✓ Found at: ${path.relative(iosPath, plistPath)}`);
    try {
      let content = fs.readFileSync(plistPath, 'utf8');
      
      // Add or update UILaunchStoryboardBackgroundColor
      const bgColorKey = 'UILaunchStoryboardBackgroundColor';
      const bgColorValue = `\n\t<key>${bgColorKey}</key>\n\t<string>${newColor}</string>`;
      
      if (content.includes(bgColorKey)) {
        // Update existing
        const regex = new RegExp(`<key>${bgColorKey}</key>\n\t<string>[^<]+</string>`);
        content = content.replace(regex, `<key>${bgColorKey}</key>\n\t<string>${newColor}</string>`);
        console.log(`   ✅ Updated ${bgColorKey} in Info.plist`);
        updatedCount++;
      } else {
        // Add new - insert before </dict>
        content = content.replace(/<\/dict>\s*<\/plist>/, `${bgColorValue}\n</dict>\n</plist>`);
        console.log(`   ✅ Added ${bgColorKey} to Info.plist`);
        updatedCount++;
      }
      
      fs.writeFileSync(plistPath, content, 'utf8');
    } catch (error) {
      console.log(`   ❌ Error updating Info.plist: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  Info.plist not found');
  }
  
  console.log(`\n   📊 Total iOS files updated: ${updatedCount}`);
  
  if (oldColor) {
    console.log(`   🎯 Old color RGB: red=${oldRgb.r.toFixed(3)} green=${oldRgb.g.toFixed(3)} blue=${oldRgb.b.toFixed(3)}`);
  }
  console.log(`   🎯 New color: ${newColor}`);
  console.log(`   🎯 New color RGB: red=${newRgb.r.toFixed(3)} green=${newRgb.g.toFixed(3)} blue=${newRgb.b.toFixed(3)}`);
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
  let updatedCount = 0;
  
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
        const beforeCount = (content.match(new RegExp(oldColorUpper, 'g')) || []).length;
        content = content.replace(new RegExp(oldColorUpper, 'g'), newColor);
        content = content.replace(new RegExp(oldColorLower, 'g'), newColor);
        const afterCount = (content.match(new RegExp(oldColorUpper, 'g')) || []).length;
        changeCount += (beforeCount - afterCount);
      }
      
      if (changeCount > 0) {
        fs.writeFileSync(colorsXmlPath, content, 'utf8');
        console.log(`   ✅ Updated colors.xml (${changeCount} changes)`);
        updatedCount++;
      }
    } catch (error) {
      console.log(`   ❌ Error updating colors.xml: ${error.message}`);
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
          console.log(`   ✅ Updated styles.xml (${beforeCount - afterCount} changes)`);
          updatedCount++;
        }
      }
    } catch (error) {
      console.log(`   ❌ Error updating styles.xml: ${error.message}`);
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
          updatedCount++;
        }
      } catch (error) {
        // Skip
      }
    }
  }
  
  console.log(`\n   📊 Total Android files updated: ${updatedCount}`);
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
        overrideIOSNativeColors(iosPath, newColor, oldColor);
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