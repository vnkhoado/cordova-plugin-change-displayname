#!/usr/bin/env node

/**
 * Hook: injectAppReadyManager.js
 * 
 * Automatically injects AppReadyManager.js script tag into index.html
 * 
 * Why this is needed:
 * - OutSystems can rewrite index.html during OTA updates
 * - Manual script tag addition might get lost
 * - This hook ensures AppReadyManager is always loaded BEFORE cordova.js
 * 
 * CRITICAL ORDER:
 * 1. AppReadyManager.js (must be FIRST)
 * 2. cordova.js
 * 3. Other scripts
 */

const fs = require('fs');
const path = require('path');

function injectAppReadyManager(context, platform) {
  const root = context.opts.projectRoot;
  
  // Determine www path based on platform
  let wwwPath;
  if (platform === 'android') {
    wwwPath = path.join(root, 'platforms/android/app/src/main/assets/www');
  } else if (platform === 'ios') {
    wwwPath = path.join(root, 'platforms/ios/www');
  } else {
    console.log(`   ⚠️  Unknown platform: ${platform}`);
    return;
  }
  
  const indexPath = path.join(wwwPath, 'index.html');
  
  if (!fs.existsSync(indexPath)) {
    console.log(`   ⚠️  index.html not found at: ${indexPath}`);
    return;
  }
  
  try {
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Check if already injected
    if (html.includes('AppReadyManager.js')) {
      console.log('   ℹ️  AppReadyManager already injected');
      return;
    }
    
    // Create script tag
    const scriptTag = '<script src="js/AppReadyManager.js"></script>';
    let injected = false;
    
    // Strategy 1: Insert before cordova.js (BEST - maintains order)
    if (html.includes('cordova.js')) {
      const pattern = /(<script[^>]*src=['"]cordova\.js['"][^>]*><\/script>)/;
      if (pattern.test(html)) {
        html = html.replace(
          pattern,
          scriptTag + '\n    $&'
        );
        injected = true;
        console.log('   ✅ Injected BEFORE cordova.js (best position)');
      }
    }
    
    // Strategy 2: Insert after <head> tag if cordova.js not found
    if (!injected && html.includes('<head>')) {
      html = html.replace(
        /(<head>)/i,
        '$1\n    ' + scriptTag
      );
      injected = true;
      console.log('   ✅ Injected after <head> tag');
    }
    
    // Strategy 3: Insert before </head> tag
    if (!injected && html.includes('</head>')) {
      html = html.replace(
        /(<\/head>)/i,
        '    ' + scriptTag + '\n$1'
      );
      injected = true;
      console.log('   ✅ Injected before </head> tag');
    }
    
    // Strategy 4: Insert at start of <body>
    if (!injected && html.includes('<body')) {
      html = html.replace(
        /(<body[^>]*>)/i,
        '$1\n    ' + scriptTag
      );
      injected = true;
      console.log('   ✅ Injected at start of <body>');
    }
    
    // Strategy 5: Insert before </body> (last resort)
    if (!injected && html.includes('</body>')) {
      html = html.replace(
        /(<\/body>)/i,
        '    ' + scriptTag + '\n$1'
      );
      injected = true;
      console.log('   ✅ Injected before </body> tag');
    }
    
    if (!injected) {
      console.log('   ❌ Could not find injection point in index.html');
      console.log('   ℹ️  Please manually add: ' + scriptTag);
      return;
    }
    
    // Verify AppReadyManager.js exists
    const appReadyPath = path.join(wwwPath, 'js', 'AppReadyManager.js');
    if (!fs.existsSync(appReadyPath)) {
      console.log(`   ⚠️  Warning: AppReadyManager.js not found at ${appReadyPath}`);
      console.log('   ℹ️  Make sure plugin is installed correctly');
    }
    
    // Write updated HTML
    fs.writeFileSync(indexPath, html, 'utf8');
    
    // Verify write succeeded
    const verifyHtml = fs.readFileSync(indexPath, 'utf8');
    if (verifyHtml.includes('AppReadyManager.js')) {
      console.log('   ✅ Verified: Script tag written successfully');
    } else {
      console.log('   ❌ Verification failed: Script tag not found after write');
    }
    
  } catch (error) {
    console.error(`   ❌ Error injecting AppReadyManager: ${error.message}`);
  }
}

module.exports = function(context) {
  const platforms = context.opts.platforms || [];
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  INJECT APPREADYMANAGER SCRIPT TAG');
  console.log('══════════════════════════════════════════════');
  
  for (const platform of platforms) {
    console.log(`\n📱 ${platform}...`);
    try {
      injectAppReadyManager(context, platform);
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Completed!\n');
};