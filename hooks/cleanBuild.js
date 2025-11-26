#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Clean iOS build cache và derived data
 */
module.exports = function(context) {
  const root = context.opts.projectRoot;
  const platforms = context.opts.platforms;

  if (!platforms.includes('ios')) {
    return;
  }

  console.log("\n══════════════════════════════════");
  console.log("         CLEAN BUILD HOOK          ");
  console.log("══════════════════════════════════");

  const iosPath = path.join(root, "platforms/ios");
  
  if (!fs.existsSync(iosPath)) {
    console.log("⚠ iOS platform not found, skip cleaning");
    return;
  }

  // Các folder cần clean
  const pathsToClean = [
    path.join(iosPath, "build"),
    path.join(iosPath, "DerivedData"),
    path.join(iosPath, ".DS_Store")
  ];

  let cleaned = 0;
  pathsToClean.forEach(p => {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`🧹 Cleaned: ${path.basename(p)}`);
        cleaned++;
      } catch (err) {
        console.log(`⚠ Could not clean ${path.basename(p)}:`, err.message);
      }
    }
  });

  // Tìm app folder
  const iosFolders = fs.readdirSync(iosPath)
    .filter(f => {
      const fullPath = path.join(iosPath, f);
      return fs.statSync(fullPath).isDirectory() && 
             f !== "CordovaLib" && 
             f !== "www" &&
             f !== "cordova" &&
             f !== "build";
    });

  if (iosFolders.length > 0) {
    const appFolderName = iosFolders[0];
    
    // Clean xcuserdata (user-specific Xcode data)
    const xcodeprojPath = path.join(iosPath, appFolderName + ".xcodeproj");
    const xcuserdataPath = path.join(xcodeprojPath, "xcuserdata");
    
    if (fs.existsSync(xcuserdataPath)) {
      try {
        fs.rmSync(xcuserdataPath, { recursive: true, force: true });
        console.log(`🧹 Cleaned: xcuserdata`);
        cleaned++;
      } catch (err) {
        console.log(`⚠ Could not clean xcuserdata:`, err.message);
      }
    }

    // Clean workspace data
    const xcworkspacePath = path.join(iosPath, appFolderName + ".xcworkspace");
    const workspaceDataPath = path.join(xcworkspacePath, "xcuserdata");
    
    if (fs.existsSync(workspaceDataPath)) {
      try {
        fs.rmSync(workspaceDataPath, { recursive: true, force: true });
        console.log(`🧹 Cleaned: workspace xcuserdata`);
        cleaned++;
      } catch (err) {
        console.log(`⚠ Could not clean workspace data:`, err.message);
      }
    }

    // Force touch xcassets để Xcode rebuild
    const assetsFolder = path.join(iosPath, appFolderName, "Images.xcassets");
    if (fs.existsSync(assetsFolder)) {
      const now = new Date();
      try {
        fs.utimesSync(assetsFolder, now, now);
        console.log(`🔄 Touched Images.xcassets`);
      } catch (err) {
        console.log(`⚠ Could not touch xcassets:`, err.message);
      }
    }

    // Touch Contents.json
    const contentsJson = path.join(assetsFolder, "AppIcon.appiconset", "Contents.json");
    if (fs.existsSync(contentsJson)) {
      const now = new Date();
      try {
        fs.utimesSync(contentsJson, now, now);
        console.log(`🔄 Touched Contents.json`);
      } catch (err) {
        console.log(`⚠ Could not touch Contents.json:`, err.message);
      }
    }
  }

  if (cleaned > 0) {
    console.log(`✅ Cleaned ${cleaned} build artifact(s)`);
  } else {
    console.log(`ℹ No build artifacts to clean`);
  }

  console.log("══════════════════════════════════\n");
};