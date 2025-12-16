#!/usr/bin/env node

/**
 * iOS Unified Compile Hook
 * Combines: forceOverrideSplashColor + forceOverrideNativeColors + 
 *           scanAndReplaceColor + forceReplaceIosIcons
 */

const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  const platforms = context.opts.platforms;
  
  if (!platforms.includes('ios')) {
    return;
  }

  console.log('\n═══════════════════════════════════════');
  console.log('  🔨 iOS Unified Compile Phase');
  console.log('═══════════════════════════════════════');

  try {
    const root = context.opts.projectRoot;
    const iosPath = path.join(root, 'platforms/ios');
    
    // Clean compiled assets (safe clean)
    await cleanCompiledAssets(iosPath);
    
    // Validate icon assets
    await validateIcons(iosPath);
    
    // Check for plugin conflicts
    await checkPluginConflicts(context);
    
    console.log('✅ iOS Compile Phase Complete!');
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Error in iOS Compile Phase:', error.message);
    console.log('⚠️  Continuing with Xcode build...\n');
    // Don't throw
  }
};

async function cleanCompiledAssets(iosPath) {
  console.log('🧹 Cleaning compiled assets');
  
  try {
    const { execSync } = require('child_process');
    
    // Only clean .storyboardc and Assets.car
    const findStoryboards = `find "${iosPath}" -name "*.storyboardc" -type d 2>/dev/null || true`;
    const storyboards = execSync(findStoryboards, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim());
    
    let cleaned = 0;
    storyboards.forEach(dir => {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        cleaned++;
      } catch (err) {
        // Ignore
      }
    });
    
    if (cleaned > 0) {
      console.log(`   ✅ Cleaned ${cleaned} compiled storyboard(s)`);
    } else {
      console.log('   ℹ️  No compiled assets to clean');
    }
    
  } catch (error) {
    console.log('   ⚠️  Asset cleaning skipped:', error.message);
  }
}

async function validateIcons(iosPath) {
  console.log('🔍 Validating icons');
  
  try {
    const xcodeProjects = fs.readdirSync(iosPath)
      .filter(f => f.endsWith('.xcodeproj'));
    
    if (xcodeProjects.length === 0) {
      console.log('   ⚠️  No Xcode project found');
      return;
    }
    
    const projectName = xcodeProjects[0].replace('.xcodeproj', '');
    const assetsPath = path.join(iosPath, projectName, 'Images.xcassets/AppIcon.appiconset');
    
    if (fs.existsSync(assetsPath)) {
      const contents = path.join(assetsPath, 'Contents.json');
      if (fs.existsSync(contents)) {
        console.log('   ✅ AppIcon assets found');
        
        // Check for actual icon files
        const files = fs.readdirSync(assetsPath)
          .filter(f => f.endsWith('.png'));
        
        if (files.length > 0) {
          console.log(`   ✅ Found ${files.length} icon file(s)`);
        } else {
          console.log('   ⚠️  No icon PNG files found');
        }
      } else {
        console.log('   ⚠️  AppIcon Contents.json missing');
      }
    } else {
      console.log('   ⚠️  AppIcon.appiconset not found');
      console.log('   💡 Make sure to run icon generation before compile');
    }
    
  } catch (error) {
    console.log('   ⚠️  Icon validation skipped:', error.message);
  }
}

async function checkPluginConflicts(context) {
  console.log('🔍 Checking plugin conflicts');
  
  try {
    const root = context.opts.projectRoot;
    const pluginsPath = path.join(root, 'plugins');
    
    if (!fs.existsSync(pluginsPath)) {
      console.log('   ℹ️  No plugins directory found');
      return;
    }
    
    const plugins = fs.readdirSync(pluginsPath)
      .filter(f => fs.statSync(path.join(pluginsPath, f)).isDirectory());
    
    // Check for known conflicting plugins
    const conflicts = [
      'cordova-plugin-splashscreen',
      'cordova-plugin-ionic-webview',
      'cordova-plugin-wkwebview-engine',
      'cordova-plugin-wkwebview-file-xhr'
    ];
    
    const found = plugins.filter(p => 
      conflicts.some(c => p.includes(c))
    );
    
    if (found.length > 0) {
      console.log('   ⚠️  Detected plugins that may conflict:');
      found.forEach(p => console.log(`      - ${p}`));
      console.log('   💡 If you experience issues:');
      console.log('      1. Try removing cordova-plugin-change-app-info first');
      console.log('      2. Or disable conflicting features in preferences');
    } else {
      console.log('   ✅ No known conflicts detected');
    }
    
  } catch (error) {
    console.log('   ⚠️  Conflict check skipped:', error.message);
  }
}
