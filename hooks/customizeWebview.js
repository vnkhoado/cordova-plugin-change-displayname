#!/usr/bin/env node

/**
 * Hook để customize màu background của pre-render webview
 * Đặc biệt hữu ích cho OutSystems apps để thay đổi màu splash screen
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

function customizeAndroidWebview(context, backgroundColor) {
  const root = context.opts.projectRoot;
  const mainActivityPath = path.join(
    root,
    'platforms/android/app/src/main/java/io/outsystems/android/MainActivity.java'
  );
  
  // Nếu không tìm thấy OutSystems MainActivity, thử tìm default
  let activityPath = mainActivityPath;
  if (!fs.existsSync(activityPath)) {
    // Tìm MainActivity.java trong thư mục project
    const appPath = path.join(root, 'platforms/android/app/src/main/java');
    activityPath = findMainActivity(appPath);
  }
  
  if (!activityPath || !fs.existsSync(activityPath)) {
    console.log('   ⚠️  MainActivity.java not found, skipping webview customization');
    return;
  }
  
  let content = fs.readFileSync(activityPath, 'utf8');
  
  // Check nếu đã customize rồi
  if (content.includes('// CUSTOM_WEBVIEW_BACKGROUND')) {
    console.log('   ✓ Webview already customized');
    return;
  }
  
  // Thêm import nếu chưa có
  if (!content.includes('import android.graphics.Color;')) {
    content = content.replace(
      /(package [^;]+;)/,
      '$1\n\nimport android.graphics.Color;'
    );
  }
  
  // Tìm onCreate method và thêm code
  const onCreateRegex = /(@Override\s+public void onCreate\(Bundle savedInstanceState\)\s*{[^}]*super\.onCreate\(savedInstanceState\);)/;
  
  if (onCreateRegex.test(content)) {
    content = content.replace(
      onCreateRegex,
      `$1\n\n        // CUSTOM_WEBVIEW_BACKGROUND\n        // Set webview background color\n        getWindow().getDecorView().setBackgroundColor(Color.parseColor("${backgroundColor}"));`
    );
    
    fs.writeFileSync(activityPath, content, 'utf8');
    console.log(`   ✓ Android webview background set to ${backgroundColor}`);
  } else {
    console.log('   ⚠️  onCreate method not found in MainActivity');
  }
}

function customizeIOSWebview(context, backgroundColor) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  const projectName = config.name();
  
  // Tìm AppDelegate.m
  const appDelegatePath = path.join(
    root,
    `platforms/ios/${projectName}/Classes/AppDelegate.m`
  );
  
  if (!fs.existsSync(appDelegatePath)) {
    console.log('   ⚠️  AppDelegate.m not found, skipping webview customization');
    return;
  }
  
  let content = fs.readFileSync(appDelegatePath, 'utf8');
  
  // Check nếu đã customize rồi
  if (content.includes('// CUSTOM_WEBVIEW_BACKGROUND')) {
    console.log('   ✓ Webview already customized');
    return;
  }
  
  // Convert hex color to UIColor
  const uiColor = hexToUIColor(backgroundColor);
  
  // Tìm application:didFinishLaunchingWithOptions và thêm code
  const didFinishRegex = /(- \(BOOL\)application:\(UIApplication\*\)application didFinishLaunchingWithOptions:[^{]*{[^}]*self\.window = \[\[UIWindow alloc\] initWithFrame:\[UIScreen mainScreen\]\.bounds\];)/;
  
  if (didFinishRegex.test(content)) {
    content = content.replace(
      didFinishRegex,
      `$1\n\n    // CUSTOM_WEBVIEW_BACKGROUND\n    // Set webview background color\n    self.window.backgroundColor = ${uiColor};`
    );
    
    fs.writeFileSync(appDelegatePath, content, 'utf8');
    console.log(`   ✓ iOS webview background set to ${backgroundColor}`);
  } else {
    console.log('   ⚠️  didFinishLaunchingWithOptions method not found');
  }
}

function findMainActivity(dir) {
  if (!fs.existsSync(dir)) return null;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      const found = findMainActivity(fullPath);
      if (found) return found;
    } else if (file === 'MainActivity.java') {
      return fullPath;
    }
  }
  
  return null;
}

function hexToUIColor(hex) {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16) / 255.0;
  const g = parseInt(hex.substring(2, 4), 16) / 255.0;
  const b = parseInt(hex.substring(4, 6), 16) / 255.0;
  
  return `[UIColor colorWithRed:${r.toFixed(3)}f green:${g.toFixed(3)}f blue:${b.toFixed(3)}f alpha:1.0f]`;
}

function validateHexColor(color) {
  const hexRegex = /^#?([A-Fa-f0-9]{6})$/;
  return hexRegex.test(color);
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Đọc background color từ config
  let backgroundColor = config.getPreference('WEBVIEW_BACKGROUND_COLOR');
  
  if (!backgroundColor) {
    console.log('\n📱 WEBVIEW_BACKGROUND_COLOR not configured, skipping customization');
    return;
  }
  
  // Validate color format
  if (!validateHexColor(backgroundColor)) {
    console.error('\n❌ Invalid WEBVIEW_BACKGROUND_COLOR format. Use hex color (e.g., #FFFFFF)');
    return;
  }
  
  // Ensure # prefix
  if (!backgroundColor.startsWith('#')) {
    backgroundColor = '#' + backgroundColor;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  CUSTOMIZE WEBVIEW BACKGROUND COLOR         ');
  console.log('══════════════════════════════════════════════');
  console.log(`Color: ${backgroundColor}`);
  
  for (const platform of platforms) {
    console.log(`\n📱 Processing ${platform}...`);
    
    try {
      if (platform === 'android') {
        customizeAndroidWebview(context, backgroundColor);
      } else if (platform === 'ios') {
        customizeIOSWebview(context, backgroundColor);
      }
    } catch (error) {
      console.error(`\n❌ Error customizing ${platform}:`, error.message);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Webview customization completed!');
  console.log('══════════════════════════════════════════════\n');
};