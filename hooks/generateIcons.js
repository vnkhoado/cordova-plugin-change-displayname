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

const { getConfigParser } = require("./utils");

/**
 * Get CDN URL from root config.xml
 */
function getCdnUrl(context) {
  const root = context.opts.projectRoot;
  const rootConfigPath = path.join(root, "config.xml");
  
  console.log(`🔍 Checking for CDN_ICON in: ${rootConfigPath}`);
  
  if (!fs.existsSync(rootConfigPath)) {
    console.log("⚠ Root config.xml not found");
    return null;
  }

  try {
    const config = getConfigParser(context, rootConfigPath);
    
    // Try multiple preference names
    let cdnUrl = config.getPreference("CDN_ICON") || 
                 config.getPreference("cdnIcon") ||
                 config.getPreference("cdn_icon");
    
    if (cdnUrl) {
      console.log(`✅ Found CDN_ICON in config.xml: ${cdnUrl}`);
      return cdnUrl;
    } else {
      console.log("⚠ CDN_ICON preference not found in config.xml");
    }
  } catch (err) {
    console.log("⚠ Could not read config.xml:", err.message);
  }
  
  // Try plugin variables from context
  if (context.opts && context.opts.plugin && context.opts.plugin.variables) {
    const cdnUrl = context.opts.plugin.variables.CDN_ICON ||
                   context.opts.plugin.variables.cdnIcon ||
                   context.opts.plugin.variables.cdn_icon;
    if (cdnUrl) {
      console.log(`✅ Found CDN_ICON in plugin variables: ${cdnUrl}`);
      return cdnUrl;
    }
  }

  // Try environment variables as last resort
  const envUrl = process.env.CDN_ICON || 
                 process.env.CORDOVA_CDN_ICON ||
                 process.env.npm_config_cdn_icon;
  
  if (envUrl) {
    console.log(`✅ Found CDN_ICON in environment: ${envUrl}`);
    return envUrl;
  }

  return null;
}

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

  console.log(`📂 iOS folder: ${iosFolder}`);
  console.log(`📂 XCAssets folder: ${xcassetsFolder}`);
  console.log(`📂 AppIcon folder: ${assetsFolder}`);

  // Create folder if not exists
  if (!fs.existsSync(assetsFolder)) {
    console.log("📁 Creating AppIcon.appiconset folder...");
    fs.mkdirSync(assetsFolder, { recursive: true });
  } else {
    console.log("📁 AppIcon.appiconset folder exists");
  }

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
  console.log(`✅ Contents.json created at: ${contentsPath}\n`);

  return assetsFolder;
}

/**
 * Verify iOS icons exist
 */
function verifyIOSIcons(assetsFolder) {
  console.log("\n🔍 Verifying iOS icons...");
  
  const contentsPath = path.join(assetsFolder, "Contents.json");
  
  if (!fs.existsSync(contentsPath)) {
    console.log("❌ Contents.json not found");
    return false;
  }

  const contents = JSON.parse(fs.readFileSync(contentsPath, "utf8"));
  const missingFiles = [];
  let existingCount = 0;

  for (const img of contents.images) {
    const filePath = path.join(assetsFolder, img.filename);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(img.filename);
    } else {
      existingCount++;
    }
  }

  if (missingFiles.length > 0) {
    console.log(`⚠ Missing ${missingFiles.length} icon files:`, missingFiles.join(", "));
    console.log(`✔ Found ${existingCount} icons`);
    return false;
  }

  console.log(`✅ All ${existingCount} iOS icons verified`);
  return true;
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
  
  console.log(`\n🔍 Checking Xcode project: ${pbxPath}`);
  
  if (!fs.existsSync(pbxPath)) {
    console.log("❌ project.pbxproj not found");
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
    
    console.log(`✅ iOS target: ${targetName}`);

    // Log current AppIcon setting
    const buildConfigs = proj.pbxXCBuildConfigurationSection();
    for (const key in buildConfigs) {
      if (!key.endsWith('_comment') && buildConfigs[key].buildSettings) {
        const settings = buildConfigs[key].buildSettings;
        if (settings.ASSETCATALOG_COMPILER_APPICON_NAME) {
          console.log(`🔍 Current AppIcon setting: ${settings.ASSETCATALOG_COMPILER_APPICON_NAME}`);
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
    console.log(`✅ Updated project.pbxproj: Set ASSETCATALOG_COMPILER_APPICON_NAME = "AppIcon" (${updatedCount} configurations)`);
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
    console.log(`✅ Cleaned ${cleanedCount} cache folder(s)`);
  } else {
    console.log(`ℹ No cache to clean`);
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
  console.log("Project root:", root);

  // Get CDN URL once from root config (not per platform)
  const cdnUrl = getCdnUrl(context);
  
  if (!cdnUrl) {
    console.log(`\n❌ CDN_ICON not found`);
    console.log(`   Add this to your root config.xml or OutSystems Extensibility Configurations:`);
    console.log(`   <preference name="CDN_ICON" value="https://your-cdn.com/icon-1024.png" />`);
    console.log(`   Skipping icon generation.\n`);
    return;
  }

  console.log(`🔗 CDN URL: ${cdnUrl}`);

  // Download icon once
  let buffer;
  try {
    buffer = await downloadIcon(cdnUrl);
  } catch (err) {
    console.error(`❌ Failed to download icon: ${err.message}`);
    console.error(err.stack);
    return;
  }

  // Generate icons for each platform
  for (const platform of platforms) {
    console.log(`\n📱 Processing platform: ${platform}`);

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
        console.log(`✅ iOS app folder: ${appFolderName}`);

        // Clean build cache FIRST
        cleanXcodeCache(root, appFolderName);

        // Generate icons (ALWAYS, no skip check)
        const assetsFolder = await generateIOSIcons(buffer, root, appFolderName);
        
        // Verify icons
        verifyIOSIcons(assetsFolder);
        
        // Update Xcode project
        updateAppIcon(root, appFolderName);
        
        // Touch xcassets to force Xcode rebuild
        touchXCAssets(assetsFolder);
        
        console.log("\n✅ iOS icon generation completed!");
        console.log("📌 IMPORTANT: To see new icon on device:");
        console.log("   1. DELETE app completely from device");
        console.log("   2. REBOOT device (turn off and on)");
        console.log("   3. Install app again");
      }
    } catch (err) {
      console.error(`❌ Failed to generate icons for ${platform}:`);
      console.error(err.message);
      console.error(err.stack);
    }
  }

  console.log("\n══════════════════════════════════");
  console.log("✅ Icons generation completed!");
  console.log("══════════════════════════════════\n");
};