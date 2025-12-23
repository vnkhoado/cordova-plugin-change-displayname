#!/usr/bin/env node

/**
 * UNIFIED HOOK: Customize native colors (splash screen + webview)
 * ONLY replaces splash-related colors - DOES NOT touch status bar or other colors
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
 * Known splash background color names - ONLY these will be replaced
 */
const SPLASH_COLOR_NAMES = [
  'splash_background',
  'splashColor',
  'splash_color',
  'splashscreen_color',
  'splashBackground'
];

/**
 * Known OutSystems default splash colors - ONLY these hex values will be replaced
 * Status bar colors (#001833, etc.) are NOT included
 */
const KNOWN_OUTSYSTEMS_SPLASH_COLORS = [
  '#0366d6',
  '#003D66',
  '#2E5090',
  '#ffffff',
  '#FFFFFF',
  '#f0f0f0',
  '#eeeeee',
  '#e8e8e8',
  '#fafafa'
];

/**
 * Replace specific color ONLY if it matches known splash colors
 */
function replaceIfSplashColor(content, oldColor, newColor) {
  oldColor = normalizeHexColor(oldColor).toUpperCase();
  newColor = normalizeHexColor(newColor).toUpperCase();
  
  if (oldColor === newColor) return { result: content, count: 0 };
  
  // Check if oldColor is a known splash color
  const isKnownSplash = KNOWN_OUTSYSTEMS_SPLASH_COLORS.some(
    c => normalizeHexColor(c).toUpperCase() === oldColor
  );
  
  if (!isKnownSplash) {
    return { result: content, count: 0 };
  }
  
  let result = content;
  let count = 0;
  
  // Replace all variations of this specific color
  const patterns = [
    new RegExp(oldColor, 'gi'),
    new RegExp(oldColor.toLowerCase(), 'gi')
  ];
  
  for (const pattern of patterns) {
    const matches = result.match(pattern);
    if (matches) {
      result = result.replace(pattern, newColor);
      count += matches.length;
    }
  }
  
  return { result, count };
}

/**
 * Customize Android splash & webview colors
 * ONLY touches splash-related colors, NOT status bar
 */
function customizeAndroidColors(root, backgroundColor, webviewBackgroundColor) {
  // 1. Update colors.xml - ONLY named splash colors
  const colorsPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/colors.xml'
  );
  
  if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf8');
    let updated = false;
    
    if (backgroundColor) {
      // Strategy 1: Replace ONLY splash-named colors
      for (const colorName of SPLASH_COLOR_NAMES) {
        const regex = new RegExp(
          `<color name="${colorName}">[^<]*</color>`,
          'i'
        );
        
        if (colors.match(regex)) {
          colors = colors.replace(
            regex,
            `<color name="${colorName}">${backgroundColor}</color>`
          );
          console.log(`   ✓ Updated ${colorName}`);
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
      
      // Strategy 3: Replace ONLY known OutSystems splash colors
      for (const oldColor of KNOWN_OUTSYSTEMS_SPLASH_COLORS) {
        const { result: newContent, count } = replaceIfSplashColor(colors, oldColor, backgroundColor);
        if (count > 0) {
          colors = newContent;
          console.log(`   ✓ Replaced ${count} splash color(s): ${oldColor}`);
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
  
  // 2. Update styles.xml - ONLY splash-related items
  const stylesPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/styles.xml'
  );
  
  if (fs.existsSync(stylesPath)) {
    let styles = fs.readFileSync(stylesPath, 'utf8');
    let updated = false;
    
    if (backgroundColor) {
      // ONLY update @color/splash_background references
      if (styles.includes('@color/splash_background')) {
        // Already using reference - good
        console.log(`   ✓ Styles use @color/splash_background (no change needed)`);
      } else {
        // Replace windowBackground in AppTheme.Launcher ONLY
        if (styles.includes('AppTheme.Launcher')) {
          const launcherRegex = /(<style name="AppTheme\.Launcher"[^>]*>)(.*?)(<\/style>)/s;
          const launcherMatch = styles.match(launcherRegex);
          
          if (launcherMatch) {
            let themeContent = launcherMatch[2];
            
            if (themeContent.includes('android:windowBackground')) {
              // Replace ONLY if it's a known splash color
              const bgMatch = themeContent.match(/<item name="android:windowBackground">([^<]*)<\/item>/);
              if (bgMatch) {
                const currentBg = bgMatch[1].trim();
                const isKnownSplash = KNOWN_OUTSYSTEMS_SPLASH_COLORS.some(
                  c => normalizeHexColor(c).toUpperCase() === normalizeHexColor(currentBg).toUpperCase()
                );
                
                if (isKnownSplash) {
                  themeContent = themeContent.replace(
                    /<item name="android:windowBackground">[^<]*<\/item>/,
                    `<item name="android:windowBackground">${backgroundColor}</item>`
                  );
                  styles = styles.replace(launcherRegex, `$1${themeContent}$3`);
                  console.log(`   ✓ Updated AppTheme.Launcher windowBackground`);
                  updated = true;
                }
              }
            }
          }
        }
      }
    }
    
    if (updated) {
      safeWriteFile(stylesPath, styles);
      console.log(`   📝 Saved styles.xml`);
    }
  }
  
  // 3. Update splash.xml drawable ONLY
  const splashXmlPath = path.join(
    root,
    'platforms/android/app/src/main/res/drawable/splash.xml'
  );
  
  if (backgroundColor && fs.existsSync(splashXmlPath)) {
    let splash = fs.readFileSync(splashXmlPath, 'utf8');
    let updated = false;
    
    // Replace solid colors in splash drawable
    if (splash.includes('<solid')) {
      splash = splash.replace(
        /<solid android:color="[^"]*"/g,
        `<solid android:color="${backgroundColor}"`
      );
      console.log(`   ✓ Updated splash.xml drawable`);
      updated = true;
    }
    
    if (updated) {
      safeWriteFile(splashXmlPath, splash);
      console.log(`   📝 Saved splash.xml`);
    }
  }
  
  if (backgroundColor) {
    console.log(`   ✅ Android splash: ${backgroundColor}`);
  }
  if (webviewBackgroundColor) {
    console.log(`   ✅ Android webview: ${webviewBackgroundColor}`);
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
      
      // Update ALL backgroundColor in storyboard
      const colorPattern = /<color key="backgroundColor"[^\/]*\/>/g;
      const matches = storyboard.match(colorPattern) || [];
      
      if (matches.length > 0) {
        storyboard = storyboard.replace(
          colorPattern,
          `<color key="backgroundColor" red="${rgb.r.toFixed(3)}" green="${rgb.g.toFixed(3)}" blue="${rgb.b.toFixed(3)}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>`
        );
        
        safeWriteFile(storyboardPath, storyboard);
        console.log(`   ✓ Updated ${matches.length} backgroundColor in LaunchScreen.storyboard`);
      }
      
      console.log(`   📝 Saved LaunchScreen.storyboard`);
    }
    
    console.log(`   ✅ iOS splash: ${backgroundColor}`);
  }
  
  if (webviewBackgroundColor) {
    console.log(`   ℹ️  iOS webview: ${webviewBackgroundColor}`);
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
  console.log('⚠️  STATUS BAR colors are NOT modified');
  
  if (splashColor) console.log(`Splash: ${splashColor}`);
  if (webviewColor) console.log(`Webview: ${webviewColor}`);
  
  for (const platform of platforms) {
    console.log(`\n📱 ${platform}...`);
    
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
