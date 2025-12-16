#!/usr/bin/env node

/**
 * Clean Build Hook
 * 
 * Aggressively cleans iOS build artifacts and compiled cache
 * to force Xcode to recompile storyboards and assets with new colors.
 * 
 * This hook runs at 'before_prepare' to ensure clean state before
 * any other hooks modify source files.
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
  console.log('  🧹 FORCE CLEAN iOS BUILD CACHE');
  console.log('══════════════════════════════════════════════');

  const root = context.opts.projectRoot;
  const iosPath = path.join(root, 'platforms/ios');
  
  if (!fs.existsSync(iosPath)) {
    console.log('   ⚠️  iOS platform not found');
    console.log('══════════════════════════════════════════════\n');
    return;
  }

  let cleaned = 0;

  // 1. Xóa build folder
  const buildPath = path.join(iosPath, 'build');
  if (fs.existsSync(buildPath)) {
    try {
      fs.rmSync(buildPath, { recursive: true, force: true });
      console.log('   ✅ Deleted build folder');
      cleaned++;
    } catch (err) {
      console.log(`   ⚠️  Could not delete build: ${err.message}`);
    }
  }

  // 2. Xóa DerivedData
  const derivedDataPath = path.join(iosPath, 'DerivedData');
  if (fs.existsSync(derivedDataPath)) {
    try {
      fs.rmSync(derivedDataPath, { recursive: true, force: true });
      console.log('   ✅ Deleted DerivedData');
      cleaned++;
    } catch (err) {
      console.log(`   ⚠️  Could not delete DerivedData: ${err.message}`);
    }
  }

  // 3. Xóa TẤT CẢ .storyboardc (compiled storyboard)
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
        } catch (err) {
          // Ignore
        }
      });
      console.log(`   ✅ Deleted ${storyboardcDirs.length} compiled storyboard(s)`);
      cleaned++;
    } else {
      console.log('   ℹ️  No compiled storyboards found');
    }
  } catch (err) {
    console.log('   ⚠️  Could not search for .storyboardc files');
  }

  // 4. Xóa Assets.car (compiled asset catalog)
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
        } catch (err) {
          // Ignore
        }
      });
      console.log(`   ✅ Deleted ${assetsCars.length} compiled asset catalog(s)`);
      cleaned++;
    } else {
      console.log('   ℹ️  No compiled assets found');
    }
  } catch (err) {
    console.log('   ⚠️  Could not search for Assets.car files');
  }

  // 5. Xóa .xcarchive nếu có
  try {
    const findCmd = `find "${iosPath}" -name "*.xcarchive" -type d 2>/dev/null || true`;
    const archives = execSync(findCmd, { encoding: 'utf8' })
      .split('\n')
      .filter(line => line.trim());
    
    if (archives.length > 0) {
      archives.forEach(dir => {
        try {
          fs.rmSync(dir, { recursive: true, force: true });
        } catch (err) {
          // Ignore
        }
      });
      console.log('   ✅ Deleted xcarchive files');
      cleaned++;
    }
  } catch (err) {
    // Ignore
  }

  // 6. Clean Xcode build cache (nếu chạy trên Mac)
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      const xcodeDerivedData = path.join(homeDir, 'Library/Developer/Xcode/DerivedData');
      
      if (fs.existsSync(xcodeDerivedData)) {
        const projectName = path.basename(iosPath);
        const findCmd = `find "${xcodeDerivedData}" -maxdepth 1 -name "*${projectName}*" -type d 2>/dev/null || true`;
        const projectDirs = execSync(findCmd, { encoding: 'utf8' })
          .split('\n')
          .filter(line => line.trim());
        
        if (projectDirs.length > 0) {
          projectDirs.forEach(dir => {
            try {
              fs.rmSync(dir, { recursive: true, force: true });
            } catch (err) {
              // Ignore
            }
          });
          console.log('   ✅ Cleaned Xcode DerivedData cache');
          cleaned++;
        }
      }
    }
  } catch (err) {
    // Ignore - không phải môi trường Mac
  }

  console.log(`\n   📊 Cleaned ${cleaned} cache location(s)`);
  
  if (cleaned === 0) {
    console.log('   ℹ️  No build artifacts to clean (already clean)');
  }
  
  console.log('══════════════════════════════════════════════');
  console.log('✅ Force clean completed!');
  console.log('══════════════════════════════════════════════\n');
};
