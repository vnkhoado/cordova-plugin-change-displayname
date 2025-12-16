#!/usr/bin/env node

/**
 * Clean Build Hook - Lightweight Version
 * 
 * Only cleans compiled storyboards and asset catalogs to force color recompilation.
 * Does NOT clean DerivedData or framework signatures to avoid build failures.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  if (!platforms.includes('ios')) {
    return;
  }

  console.log('\n══════════════════════════════════════════════');
  console.log('  🧹 CLEAN COMPILED ASSETS (iOS)');
  console.log('══════════════════════════════════════════════');

  const root = context.opts.projectRoot;
  const iosPath = path.join(root, 'platforms/ios');
  
  if (!fs.existsSync(iosPath)) {
    console.log('   ⚠️  iOS platform not found');
    console.log('══════════════════════════════════════════════\n');
    return;
  }

  let cleaned = 0;

  // 1. CHỈ xóa compiled storyboards (.storyboardc)
  console.log('   🔍 Searching for compiled storyboards...');
  try {
    const findCmd = `find "${iosPath}" -name "*.storyboardc" -type d 2>/dev/null || true`;
    const storyboardcDirs = execSync(findCmd, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim());
    
    if (storyboardcDirs.length > 0) {
      storyboardcDirs.forEach(dir => {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          console.log(`   ✅ Deleted: ${path.basename(dir)}`);
          cleaned++;
        } catch (err) {
          // Ignore
        }
      });
      console.log(`   ✅ Deleted ${storyboardcDirs.length} compiled storyboard(s)`);
    } else {
      console.log('   ℹ️  No compiled storyboards found');
    }
  } catch (err) {
    console.log('   ⚠️  Could not search for .storyboardc files');
  }

  // 2. CHỈ xóa compiled asset catalogs (Assets.car)
  console.log('   🔍 Searching for compiled assets...');
  try {
    const findCmd = `find "${iosPath}" -name "Assets.car" -type f 2>/dev/null || true`;
    const assetsCars = execSync(findCmd, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim());
    
    if (assetsCars.length > 0) {
      assetsCars.forEach(file => {
        try {
          fs.unlinkSync(file);
          console.log(`   ✅ Deleted: ${path.basename(file)}`);
          cleaned++;
        } catch (err) {
          // Ignore
        }
      });
      console.log(`   ✅ Deleted ${assetsCars.length} compiled asset catalog(s)`);
    } else {
      console.log('   ℹ️  No compiled assets found');
    }
  } catch (err) {
    console.log('   ⚠️  Could not search for Assets.car files');
  }

  console.log(`\n   📊 Cleaned ${cleaned} item(s)`);
  
  if (cleaned === 0) {
    console.log('   ℹ️  No assets to clean (already clean or first build)');
  } else {
    console.log('   ✅ This will force Xcode to recompile storyboards/assets with new colors');
  }
  
  console.log('══════════════════════════════════════════════');
  console.log('✅ Asset clean completed!');
  console.log('══════════════════════════════════════════════\n');
};
