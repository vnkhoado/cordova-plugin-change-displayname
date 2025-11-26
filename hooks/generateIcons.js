#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

let sharp, fetch, xcode;
try {
  sharp = require("sharp");
  fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
  xcode = require("xcode");
} catch (err) {
  console.error("✖ Please install sharp, node-fetch, xcode");
  console.error("  Run: cd plugins/cordova-plugin-change-app-info && npm install");
  process.exit(1);
}

const { getConfigPath, getConfigParser } = require("./utils");

/**
 * Download icon from CDN URL
 */
async function downloadIcon(url) {
  console.log(`📥 Downloading icon from: ${url}`);
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}, status ${res.status}`);
  }
  
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`✔ Icon downloaded successfully (${buffer.length} bytes)`);
  
  return buffer;
}

/**
 * Generate Android icons (mipmap)
 */
async function generateAndroidIcons(buffer, root) {
  console.log("\n📱 Generating Android icons...");
  
  const sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
  };

  let generatedCount = 0;

  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(root, "platforms/android/app/src/main/res", folder);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, "ic_launcher.png");
    
    try {
      await sharp(buffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 100 })
        .toFile(filePath);
      
      console.log(`  ✔ ${folder}/ic_launcher.png (${size}x${size})`);
      generatedCount++;
    } catch (err) {
      console.error(`  ✖ Failed to generate ${folder}:`, err.message);
    }
  }

  console.log(`✅ Generated ${generatedCount} Android icon sizes\n`);
}

/**
 * Generate iOS icons and Contents.json
 */
async function generateIOSIcons(buffer, root, appFolderName) {
  console.log("\n📱 Generating iOS icons...");
  
  const iosFolder = path.join(root, "platforms/ios", appFolderName);
  const xcassetsFolder = path.join(iosFolder, "Images.xcassets");
  const assetsFolder = path.join(xcassetsFolder, "AppIcon.appiconset");

  // Create folder if not exists
  if (!fs.existsSync(assetsFolder)) {
    fs.mkdirSync(assetsFolder, { recursive: true });
  }
  
  console.log(`📦 iOS AppIcon folder: ${assetsFolder}`);

  // Define all required iOS icons
  const icons = [
    // iPhone Notification
    { size: 20, idiom: "iphone", scale: [2, 3] },
    // iPhone Settings, Spotlight
    { size: 29, idiom: "iphone", scale: [2, 3] },
    // iPhone Spotlight
    { size: 40, idiom: "iphone", scale: [2, 3] },
    // iPhone App
    { size: 60, idiom: "iphone", scale: [2, 3] },
    // iPad Notifications
    { size: 20, idiom: "ipad", scale: [1, 2] },
    // iPad Settings
    { size: 29, idiom: "ipad", scale: [1, 2] },
    // iPad Spotlight
    { size: 40, idiom: "ipad", scale: [1, 2] },
    // iPad App
    { size: 76, idiom: "ipad", scale: [1, 2] },
    // iPad Pro
    { size: 83.5, idiom: "ipad", scale: [2] },
    // App Store
    { size: 1024, idiom: "ios-marketing", scale: [1] }
  ];

  const contentsImages = [];
  let generatedCount = 0;

  for (const icon of icons) {
    for (const scale of icon.scale) {
      const scaledSize = Math.round(icon.size * scale);
      const scaleSuffix = scale === 1 ? "" : `@${scale}x`;
      const filename = `icon-${icon.size}${scaleSuffix}.png`;
      const filePath = path.join(assetsFolder, filename);

      try {
        await sharp(buffer)
          .resize(scaledSize, scaledSize, {
            fit: 'cover',
            position: 'center'
          })
          .png({ quality: 100 })
          .toFile(filePath);

        // Add to Contents.json
        contentsImages.push({
          idiom: icon.idiom,
          size: `${icon.size}x${icon.size}`,
          scale: `${scale}x`,
          filename: filename
        });

        console.log(`  ✔ ${filename} (${scaledSize}x${scaledSize})`);
        generatedCount++;
      } catch (err) {
        console.error(`  ✖ Failed to generate ${filename}:`, err.message);
      }
    }
  }

  // Generate Contents.json
  const contentsJson = {
    images: contentsImages,
    info: {
      version: 1,
      author: "xcode"
    }
  };

  const contentsPath = path.join(assetsFolder, "Contents.json");
  fs.writeFileSync(contentsPath, JSON.stringify(contentsJson, null, 2), "utf8");
  
  console.log(`✅ Generated ${generatedCount} iOS icon sizes`);
  console.log(`✅ Contents.json created\n`);

  return assetsFolder;
}

/**
 * Verify iOS icons exist
 */
function verifyIOSIcons(assetsFolder) {
  const contentsPath = path.join(assetsFolder, "Contents.json");
  
  if (!fs.existsSync(contentsPath)) {
    console.log("⚠ Contents.json not found");
    return false;
  }

  const contents = JSON.parse(fs.readFileSync(contentsPath, "utf8"));
  const missingFiles = [];

  for (const img of contents.images) {
    const filePath = path.join(assetsFolder, img.filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(img.filename);
    }
  }

  if (missingFiles.length > 0) {
    console.log("⚠ Missing icon files:", missingFiles.join(", "));
    return false;
  }

  console.log("✅ All iOS icons verified");
  return true;
}

/**
 * Check if icons were generated recently (within 5 minutes)
 */
function iconsAlreadyGenerated(assetsFolder) {
  const contentsPath = path.join(assetsFolder, "Contents.json");
  const icon1024Path = path.join(assetsFolder, "icon-1024.png");
  
  if (!fs.existsSync(contentsPath) || !fs.existsSync(icon1024Path)) {
    return false;
  }
  
  const stats = fs.statSync(icon1024Path);
  const ageInMinutes = (Date.now() - stats.mtimeMs) / 1000 / 60;
  
  return ageInMinutes < 5;
}

/**
 * Get iOS target info from project.pbxproj
 */
function getIOSTarget(root, appFolderName) {
  const pbxPath = path.join(
    root,
    "platforms/ios",
    appFolderName + ".xcodeproj",
    "project.pbxproj"
  );
  
  if (!fs.existsSync(pbxPath)) {
    console.log("⚠ project.pbxproj not found");
    return {};
  }

  try {
    const proj = xcode.project(pbxPath);
    proj.parseSync();

    // Get native targets (exclude CordovaLib)
    const nativeTargets = proj.pbxNativeTargetSection();
    const targetKeys = Object.keys(nativeTargets).filter(key => {
      return !key.endsWith('_comment') && 
             nativeTargets[key].name && 
             !nativeTargets[key].name.includes('CordovaLib');
    });

    if (!targetKeys.length) {
      console.log("⚠ No native target found");
      return {};
    }

    const targetUUID = targetKeys[0];
    const targetName = nativeTargets[targetUUID].name;
    
    console.log(`ℹ iOS target: ${targetName}`);

    // Log current AppIcon setting
    const buildConfigs = proj.pbxXCBuildConfigurationSection();
    for (const key in buildConfigs) {
      if (!key.endsWith('_comment') && buildConfigs[key].buildSettings) {
        const settings = buildConfigs[key].buildSettings;
        if (settings.ASSETCATALOG_COMPILER_APPICON_NAME) {
          console.log(`ℹ Current AppIcon: ${settings.ASSETCATALOG_COMPILER_APPICON_NAME}`);
          break;
        }
      }
    }

    return { proj, targetUUID, pbxPath };
  } catch (err) {
    console.error("✖ Failed to parse project.pbxproj:", err.message);
    return {};
  }
}

/**
 * Update AppIcon setting in project.pbxproj
 */
function updateAppIcon(root, appFolderName) {
  const { proj, targetUUID, pbxPath } = getIOSTarget(root, appFolderName);
  
  if (!proj || !targetUUID) {
    console.log("⚠ Cannot update AppIcon setting");
    return false;
  }

  try {
    // Update ASSETCATALOG_COMPILER_APPICON_NAME for all build configurations
    const configs = proj.pbxXCBuildConfigurationSection();
    
    let updatedCount = 0;
    for (const key in configs) {
      if (!key.endsWith('_comment') && configs[key].buildSettings) {
        configs[key].buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME = "AppIcon";
        updatedCount++;
      }
    }

    // Save file
    fs.writeFileSync(pbxPath, proj.writeSync(), "utf8");
    console.log(`✅ Updated project.pbxproj (${updatedCount} configurations)`);
    return true;
  } catch (err) {
    console.error("✖ Failed to update project.pbxproj:", err.message);
    return false;
  }
}

/**
 * Clean Xcode build cache
 */
function cleanXcodeCache(root, appFolderName) {
  console.log("\n🧹 Cleaning iOS build cache...");
  
  const pathsToClean = [
    path.join(root, "platforms/ios/build"),
    path.join(root, "platforms/ios/DerivedData")
  ];

  let cleanedCount = 0;
  pathsToClean.forEach(p => {
    if (fs.existsSync(p)) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`  ✔ Cleaned: ${path.basename(p)}`);
        cleanedCount++;
      } catch (err) {
        console.log(`  ⚠ Could not clean ${path.basename(p)}`);
      }
    }
  });

  if (cleanedCount > 0) {
    console.log(`✅ Cleaned ${cleanedCount} cache folder(s)\n`);
  } else {
    console.log(`ℹ No cache to clean\n`);
  }
}

/**
 * Force touch xcassets to trigger Xcode rebuild
 */
function touchXCAssets(assetsFolder) {
  try {
    const now = new Date();
    
    // Touch AppIcon.appiconset folder
    fs.utimesSync(assetsFolder, now, now);
    
    // Touch Contents.json
    const contentsPath = path.join(assetsFolder, "Contents.json");
    if (fs.existsSync(contentsPath)) {
      fs.utimesSync(contentsPath, now, now);
    }
    
    console.log("🔄 Touched xcassets to force Xcode refresh");
  } catch (err) {
    console.log("⚠ Could not touch xcassets:", err.message);
  }
}

/**
 * Main hook function
 */
module.exports = async function(context) {
  const root = context.opts.projectRoot;
  const platforms = context.opts.platforms;

  console.log("\n══════════════════════════════════");
  console.log("        GENERATE ICONS HOOK        ");
  console.log("══════════════════════════════════");
  console.log("Hook type:", context.hook);
  console.log("Platforms:", platforms.join(", "));

  for (const platform of platforms) {
    console.log(`\n📱 Processing platform: ${platform}`);
    
    // Get config
    const configPath = getConfigPath(context, platform);
    if (!configPath) {
      console.log(`⚠ config.xml not found for ${platform}. Skip.`);
      continue;
    }

    const config = getConfigParser(context, configPath);
    
    // Try both CDN_ICON (OutSystems) and cdnIcon (standard preference)
    const cdnUrl = config.getPreference("CDN_ICON") || config.getPreference("cdnIcon");
    
    if (!cdnUrl) {
      console.log(`ℹ CDN_ICON preference is empty for ${platform}. Skip.`);
      continue;
    }

    console.log(`🔗 CDN URL: ${cdnUrl}`);

    // Download icon
    let buffer;
    try {
      buffer = await downloadIcon(cdnUrl);
    } catch (err) {
      console.error(`✖ Failed to download icon:`, err.message);
      continue;
    }

    // Generate icons
    try {
      if (platform === "android") {
        await generateAndroidIcons(buffer, root);
      } 
      else if (platform === "ios") {
        const platformPath = path.join(root, "platforms/ios");
        
        if (!fs.existsSync(platformPath)) {
          console.log("⚠ iOS platform folder not found.");
          console.log("  Run: cordova platform add ios");
          continue;
        }

        // Find app folder
        const iosFolders = fs.readdirSync(platformPath).filter(f => {
          const fullPath = path.join(platformPath, f);
          return (
            fs.statSync(fullPath).isDirectory() &&
            f !== "CordovaLib" &&
            f !== "www" &&
            f !== "cordova" &&
            f !== "build" &&
            f !== "DerivedData"
          );
        });

        if (!iosFolders.length) {
          console.log("⚠ No iOS app folder found.");
          continue;
        }

        const appFolderName = iosFolders[0];
        console.log(`ℹ iOS app folder: ${appFolderName}`);

        const assetsFolder = path.join(
          platformPath,
          appFolderName,
          "Images.xcassets",
          "AppIcon.appiconset"
        );
        
        // Check if icons already generated recently (avoid duplicate work)
        if (iconsAlreadyGenerated(assetsFolder)) {
          console.log("ℹ Icons already generated recently (< 5 min ago). Skip.");
          continue;
        }

        // Clean build cache
        cleanXcodeCache(root, appFolderName);

        // Generate icons
        await generateIOSIcons(buffer, root, appFolderName);
        
        // Verify icons
        verifyIOSIcons(assetsFolder);
        
        // Update Xcode project
        updateAppIcon(root, appFolderName);
        
        // Touch xcassets to force Xcode rebuild
        touchXCAssets(assetsFolder);
      }
    } catch (err) {
      console.error(`✖ Failed to generate icons for ${platform}:`, err);
      console.error(err.stack);
    }
  }

  console.log("\n══════════════════════════════════");
  console.log("✅ Icons generation completed!");
  console.log("══════════════════════════════════\n");
};