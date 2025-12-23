#!/usr/bin/env node

/**
 * UNIFIED HOOK: Customize native colors (splash screen + webview)
 * 
 * Replaces:
 * - customizeSplashScreen.js
 * - forceOverrideSplashColor.js
 * - forceOverrideNativeColors.js
 * - scanAndReplaceColor.js
 * - native-gradient-splash.js
 * - forceMBASSplashColor.js
 * 
 * This is the SINGLE source of truth for color customization.
 */

const fs = require('fs');
const path = require('path');
const { 
  getConfigParser, 
  normalizeHexColor, 
  validateHexColor,
  hexToRgb,
  safeWriteFile 
} = require('./utils');

/**
 * Replace ALL occurrences of old hex color with new color
 * Handles: #RRGGBB, #RGB, #rrggbb, #rgb formats
 */
function replaceAllColors(content, oldColor, newColor) {
  // Normalize both colors to uppercase #RRGGBB format
  oldColor = normalizeHexColor(oldColor).toUpperCase();
  newColor = normalizeHexColor(newColor).toUpperCase();
  
  if (oldColor === newColor) return content;
  
  // Also handle 3-digit format (#RGB)
  const oldColor3 = oldColor.substring(0, 4); // e.g., #667 from #667eea
  const shortOld = oldColor3.replace('#', '').split('').join(''); // e.g., 667
  
  let result = content;
  let count = 0;
  
  // Replace all format variations
  const patterns = [
    // Full 6-digit hex (case insensitive)
    { regex: new RegExp(oldColor, 'gi'), desc: 'uppercase hex' },
    { regex: new RegExp(oldColor.toLowerCase(), 'gi'), desc: 'lowercase hex' },
    // In strings with quotes
    { regex: new RegExp(`"${oldColor}"`, 'gi'), desc: 'in double quotes' },
    { regex: new RegExp(`'${oldColor}'`, 'gi'), desc: 'in single quotes' },
  ];
  
  for (const pattern of patterns) {
    const matches = result.match(pattern.regex);
    if (matches) {
      result = result.replace(pattern.regex, newColor);
      count += matches.length;
    }
  }
  
  return { result, count };
}

/**
 * Customize Android splash & webview colors
 */
function customizeAndroidColors(root, backgroundColor, webviewBackgroundColor) {
  // 1. Update colors.xml - Force override ALL color values
  const colorsPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/colors.xml'
  );
  
  if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf8');
    let updated = false;
    
    if (backgroundColor) {
      // Strategy 1: Replace individual named colors
      const colorNames = [
        'colorPrimary',
        'colorPrimaryDark',
        'colorAccent',
        'splash_background',
        'splashColor',
        'primary_color',
        'primary_dark_color'
      ];
      
      for (const colorName of colorNames) {
        const regex = new RegExp(
          `<color name="${colorName}">[^<]*</color>`,
          'i'
        );
        
        if (colors.match(regex)) {
          colors = colors.replace(
            regex,
            `<color name="${colorName}">${backgroundColor}</color>`
          );
          console.log(`   ✓ Overrode ${colorName}`);
          updated = true;
        }
      }
      
      // Strategy 2: Add splash_background if not exists
      if (!colors.includes('splash_background')) {
        colors = colors.replace(
          '</resources>',
          `    <color name="splash_background">${backgroundColor}</color>\n</resources>`
        );
        console.log(`   ✓ Added splash_background`);
        updated = true;
      }
      
      // Strategy 3: Replace ALL hex colors matching known splash colors
      // Common OutSystems splash colors that need replacing
      const commonSplashColors = [
        '#0366d6', '#003D66', '#001833', '#2E5090',
        '#ffffff', '#FFFFFF', '#FFF', '#f0f0f0',
        '#eeeeee', '#e8e8e8'
      ];
      
      for (const oldColor of commonSplashColors) {
        const { result: newContent, count } = replaceAllColors(colors, oldColor, backgroundColor);
        if (count > 0) {
          colors = newContent;
          console.log(`   ✓ Replaced ${count} occurrence(s) of ${oldColor}`);
          updated = true;
        }
      }
    }
    
    if (webviewBackgroundColor) {
      // Add or update webview_background
      if (!colors.includes('webview_background')) {
        colors = colors.replace(
          '</resources>',
          `    <color name="webview_background">${webviewBackgroundColor}</color>\n</resources>`
        );
        console.log(`   ✓ Added webview_background`);
      } else {
        colors = colors.replace(
          /<color name="webview_background">[^<]*<\/color>/i,
          `<color name="webview_background">${webviewBackgroundColor}</color>`
        );
        console.log(`   ✓ Updated webview_background`);
      }
      updated = true;
    }
    
    if (updated) {
      safeWriteFile(colorsPath, colors);
      console.log(`   📝 Saved colors.xml`);
    }
  }
  
  // 2. Update styles.xml - Force window backgrounds
  const stylesPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/styles.xml'
  );
  
  if (fs.existsSync(stylesPath)) {
    let styles = fs.readFileSync(stylesPath, 'utf8');
    let updated = false;
    
    if (backgroundColor) {
      // Update AppTheme
      const appThemeRegex = /(<style name="AppTheme"[^>]*>)(.*?)(<\/style>)/s;
      const match = styles.match(appThemeRegex);
      
      if (match) {
        let themeContent = match[2];
        
        // Replace or add windowBackground
        if (themeContent.includes('android:windowBackground')) {
          themeContent = themeContent.replace(
            /<item name="android:windowBackground">[^<]*<\/item>/,
            `<item name="android:windowBackground">${backgroundColor}</item>`
          );
        } else {
          themeContent = `\n        <item name="android:windowBackground">${backgroundColor}</item>${themeContent}`;
        }
        
        styles = styles.replace(appThemeRegex, `$1${themeContent}$3`);
        console.log(`   ✓ Updated AppTheme windowBackground`);
        updated = true;
      }
      
      // Update AppTheme.Launcher if exists
      if (styles.includes('AppTheme.Launcher')) {
        const launcherRegex = /(<style name="AppTheme\.Launcher"[^>]*>)(.*?)(<\/style>)/s;
        const launcherMatch = styles.match(launcherRegex);
        
        if (launcherMatch) {
          let themeContent = launcherMatch[2];
          
          if (themeContent.includes('android:windowBackground')) {
            themeContent = themeContent.replace(
              /<item name="android:windowBackground">[^<]*<\/item>/,
              `<item name="android:windowBackground">${backgroundColor}</item>`
            );
          } else {
            themeContent = `\n        <item name="android:windowBackground">${backgroundColor}</item>${themeContent}`;
          }
          
          styles = styles.replace(launcherRegex, `$1${themeContent}$3`);
          console.log(`   ✓ Updated AppTheme.Launcher windowBackground`);
          updated = true;
        }
      }
      
      // Replace ALL color references in all items
      const colorReferences = backgroundColor.toUpperCase();
      const oldPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g;
      const allMatches = styles.match(oldPattern) || [];
      
      // Get unique old colors
      const uniqueOldColors = [...new Set(allMatches)];
      
      for (const oldColor of uniqueOldColors) {
        if (oldColor.toUpperCase() !== backgroundColor.toUpperCase()) {
          const { result: newContent, count } = replaceAllColors(styles, oldColor, backgroundColor);
          if (count > 0) {
            styles = newContent;
            console.log(`   ✓ Replaced ${count} color reference(s): ${oldColor}`);
            updated = true;
          }
        }
      }
    }
    
    if (updated) {
      safeWriteFile(stylesPath, styles);
      console.log(`   📝 Saved styles.xml`);
    }
  }
  
  // 3. Update splash.xml drawable if exists
  const splashXmlPath = path.join(
    root,
    'platforms/android/app/src/main/res/drawable/splash.xml'
  );
  
  if (backgroundColor && fs.existsSync(splashXmlPath)) {
    let splash = fs.readFileSync(splashXmlPath, 'utf8');
    let updated = false;
    
    // Replace ALL solid colors
    if (splash.includes('<solid')) {
      splash = splash.replace(
        /<solid android:color="[^"]*"/g,
        `<solid android:color="${backgroundColor}"`
      );
      console.log(`   ✓ Updated splash.xml drawable colors`);
      updated = true;
    }
    
    // Also replace any remaining hex colors in splash
    const oldPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g;
    const allMatches = splash.match(oldPattern) || [];
    const uniqueOldColors = [...new Set(allMatches)];
    
    for (const oldColor of uniqueOldColors) {
      if (oldColor.toUpperCase() !== backgroundColor.toUpperCase()) {
        const { result: newContent, count } = replaceAllColors(splash, oldColor, backgroundColor);
        if (count > 0) {
          splash = newContent;
          updated = true;
        }
      }
    }
    
    if (updated) {
      safeWriteFile(splashXmlPath, splash);
      console.log(`   📝 Saved splash.xml`);
    }
  }
  
  // 4. Update all drawable colors.xml files in other value folders
  const valuesDir = path.join(
    root,
    'platforms/android/app/src/main/res'
  );
  
  if (backgroundColor && fs.existsSync(valuesDir)) {
    const dirs = fs.readdirSync(valuesDir).filter(d => d.startsWith('values'));
    
    for (const dir of dirs) {
      const colorsPath = path.join(valuesDir, dir, 'colors.xml');
      
      if (fs.existsSync(colorsPath)) {
        let colors = fs.readFileSync(colorsPath, 'utf8');
        let updated = false;
        
        // Replace all hex colors
        const oldPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g;
        const allMatches = colors.match(oldPattern) || [];
        const uniqueOldColors = [...new Set(allMatches)];
        
        for (const oldColor of uniqueOldColors) {
          if (oldColor.toUpperCase() !== backgroundColor.toUpperCase()) {
            const { result: newContent, count } = replaceAllColors(colors, oldColor, backgroundColor);
            if (count > 0) {
              colors = newContent;
              updated = true;
            }
          }
        }
        
        if (updated) {
          safeWriteFile(colorsPath, colors);
          console.log(`   📝 Saved ${dir}/colors.xml`);
        }
      }
    }
  }
  
  if (backgroundColor) {
    console.log(`   ✅ Android splash configured: ${backgroundColor}`);
  }
  if (webviewBackgroundColor) {
    console.log(`   ✅ Android webview configured: ${webviewBackgroundColor}`);
  }
}

/**
 * Customize iOS splash & webview colors
 */
function customizeIOSColors(root, config, backgroundColor, webviewBackgroundColor) {
  const projectName = config.name();
  const platformPath = path.join(root, 'platforms/ios');
  
  if (!fs.existsSync(platformPath)) {
    console.log('⚠ iOS platform folder not found');
    return;
  }
  
  // iOS LaunchScreen.storyboard
  if (backgroundColor) {
    const storyboardPath = path.join(
      platformPath,
      projectName,
      'Resources/LaunchScreen.storyboard'
    );
    
    if (fs.existsSync(storyboardPath)) {
      const rgb = hexToRgb(backgroundColor);
      let storyboard = fs.readFileSync(storyboardPath, 'utf8');
      
      // Update ALL backgroundColor in storyboard (multiple occurrences)
      const colorPattern = /<color key="backgroundColor"[^/]*\/>/g;
      const matches = storyboard.match(colorPattern) || [];
      
      if (matches.length > 0) {
        storyboard = storyboard.replace(
          colorPattern,
          `<color key="backgroundColor" red="${rgb.r.toFixed(3)}" green="${rgb.g.toFixed(3)}" blue="${rgb.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`
        );
        
        safeWriteFile(storyboardPath, storyboard);
        console.log(`   ✓ Updated ${matches.length} backgroundColor entries in LaunchScreen.storyboard`);
      }
      
      // Also replace any remaining old hex colors
      const oldPattern = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})/g;
      const allMatches = storyboard.match(oldPattern) || [];
      const uniqueOldColors = [...new Set(allMatches)];
      
      for (const oldColor of uniqueOldColors) {
        if (oldColor.toUpperCase() !== backgroundColor.toUpperCase()) {
          const { result: newContent, count } = replaceAllColors(storyboard, oldColor, backgroundColor);
          if (count > 0) {
            storyboard = newContent;
            console.log(`   ✓ Replaced ${count} occurrence(s) of ${oldColor}`);
          }
        }
      }
      
      safeWriteFile(storyboardPath, storyboard);
      console.log(`   📝 Saved LaunchScreen.storyboard`);
    }
    
    console.log(`   ✅ iOS splash configured: ${backgroundColor}`);
  }
  
  if (webviewBackgroundColor) {
    // Update webview background color in plist or code if needed
    console.log(`   ℹ️  iOS webview background color: ${webviewBackgroundColor}`);
  }
}

/**
 * Main hook
 */
module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Get preferences
  let splashColor = config.getPreference('SplashScreenBackgroundColor') ||
                    config.getPreference('AndroidWindowSplashScreenBackground') ||
                    config.getPreference('SPLASH_BACKGROUND_COLOR');
                    
  let webviewColor = config.getPreference('WEBVIEW_BACKGROUND_COLOR') ||
                     config.getPreference('WebviewBackgroundColor');
  
  // Validate colors
  if (splashColor && !validateHexColor(splashColor)) {
    console.error('\n❌ Invalid splash color format. Use hex color (e.g., #FFFFFF)');
    return;
  }
  
  if (webviewColor && !validateHexColor(webviewColor)) {
    console.error('\n❌ Invalid webview color format. Use hex color (e.g., #FFFFFF)');
    return;
  }
  
  // Normalize colors
  if (splashColor) {
    splashColor = normalizeHexColor(splashColor);
  }
  if (webviewColor) {
    webviewColor = normalizeHexColor(webviewColor);
  }
  
  // Skip if no colors configured
  if (!splashColor && !webviewColor) {
    console.log('\n🎨 No custom colors configured, skipping');
    return;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🎨 CUSTOMIZE COLORS (Splash + Webview)');
  console.log('══════════════════════════════════════════════');
  
  if (splashColor) console.log(`Splash Color: ${splashColor}`);
  if (webviewColor) console.log(`Webview Color: ${webviewColor}`);
  
  for (const platform of platforms) {
    console.log(`\n📱 Processing ${platform}...`);
    
    try {
      if (platform === 'android') {
        customizeAndroidColors(root, splashColor, webviewColor);
      } else if (platform === 'ios') {
        customizeIOSColors(root, config, splashColor, webviewColor);
      }
    } catch (error) {
      console.error(`\n❌ Error:`, error.message);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✓ Color customization completed!');
  console.log('══════════════════════════════════════════════\n');
};
