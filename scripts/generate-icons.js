#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

let sharp, fetch, xcode;
try {
  sharp = require("sharp");
  fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
  xcode = require("xcode");
} catch (err) {
  console.error("✖ Please install sharp, node-fetch, xcode in plugin folder");
  process.exit(1);
}

const { getConfigPath, getConfigParser } = require("./utils");

/**
 * Download file from URL as Buffer
 */
async function downloadIcon(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}, status ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate Android icons
 */
async function generateAndroidIcons(buffer, root) {
  const sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
  };

  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(root, "platforms/android/app/src/main/res", folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, "ic_launcher.png");
    await sharp(buffer).resize(size, size).toFile(filePath);
    console.log(`✔ Android icon generated: ${filePath}`);
  }
}

/**
 * Generate iOS icons + Contents.json
 */
async function generateIOSIcons(buffer, root, appFolderName) {
  const iosFolder = path.join(root, "platforms/ios", appFolderName);
  const xcassetsFolder = path.join(iosFolder, "Images.xcassets");
  const assetsFolder = path.join(xcassetsFolder, "AppIcon.appiconset");

  if (!fs.existsSync(assetsFolder)) {
    fs.mkdirSync(assetsFolder, { recursive: true });
  }
  console.log("📦 Using iOS AppIcon folder:", assetsFolder);

  // Định nghĩa tất cả icons cần thiết cho iOS
  const icons = [
    // iPhone
    { size: 20, idiom: "iphone", scale: [2, 3] },
    { size: 29, idiom: "iphone", scale: [2, 3] },
    { size: 40, idiom: "iphone", scale: [2, 3] },
    { size: 60, idiom: "iphone", scale: [2, 3] },
    // iPad
    { size: 20, idiom: "ipad", scale: [1, 2] },
    { size: 29, idiom: "ipad", scale: [1, 2] },
    { size: 40, idiom: "ipad", scale: [1, 2] },
    { size: 76, idiom: "ipad", scale: [1, 2] },
    { size: 83.5, idiom: "ipad", scale: [2] },
    // App Store - QUAN TRỌNG!
    { size: 1024, idiom: "ios-marketing", scale: [1] }
  ];

  const contentsImages = [];

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

        // Thêm vào Contents.json
        contentsImages.push({
          idiom: icon.idiom,
          size: `${icon.size}x${icon.size}`,
          scale: `${scale}x`,
          filename
        });

        console.log(`✔ iOS icon generated: ${filename} (${scaledSize}x${scaledSize})`);
      } catch (err) {
        console.error(`✖ Failed to generate ${filename}:`, err.message);
      }
    }
  }

  // Tạo Contents.json với format chuẩn
  const contentsJson = {
    images: contentsImages,
    info: {
      version: 1,
      author: "xcode"
    }
  };

  const contentsPath = path.join(assetsFolder, "Contents.json");
  fs.writeFileSync(contentsPath, JSON.stringify(contentsJson, null, 2));
  console.log("✅ iOS Contents.json generated:", contentsPath);

  return assetsFolder;
}

/**
 * Get iOS target info
 */
function getIOSTarget(root, appFolderName) {
  const pbxPath = path.join(root, "platforms/ios", appFolderName + ".xcodeproj", "project.pbxproj");
  
  if (!fs.existsSync(pbxPath)) {
    console.log("⚠ project.pbxproj not found:", pbxPath);
    return {};
  }

  const proj = xcode.project(pbxPath);
  proj.parseSync();

  // Lấy native target (không phải CordovaLib)
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
  
  console.log("ℹ iOS target found:", targetName, "UUID:", targetUUID);

  // Log AppIcon hiện tại
  const buildConfigs = proj.pbxXCBuildConfigurationSection();
  for (const key in buildConfigs) {
    if (!key.endsWith('_comment') && buildConfigs[key].buildSettings) {
      const settings = buildConfigs[key].buildSettings;
      if (settings.ASSETCATALOG_COMPILER_APPICON_NAME) {
        console.log("ℹ Current AppIcon:", settings.ASSETCATALOG_COMPILER_APPICON_NAME);
        break;
      }
    }
  }

  return { proj, targetUUID, pbxPath };
}

/**
 * Update AppIcon in project.pbxproj
 */
function updateAppIcon(root, appFolderName) {
  const { proj, targetUUID, pbxPath } = getIOSTarget(root, appFolderName);
  
  if (!proj || !targetUUID) {
    console.log("⚠ Cannot update AppIcon setting");
    return false;
  }

  try {
    // Update cho tất cả build configurations
    const configs = proj.pbxXCBuildConfigurationSection();
    
    for (const key in configs) {
      if (!key.endsWith('_comment') && configs[key].buildSettings) {
        configs[key].buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME = "AppIcon";
      }
    }

    // Lưu file
    fs.writeFileSync(pbxPath, proj.writeSync());
    console.log("✅ Updated project.pbxproj: ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon");
    return true;
  } catch (err) {
    console.error("✖ Failed to update project.pbxproj:", err.message);
    return false;
  }
}

/**
 * Verify iOS icons
 */
function verifyIOSIcons(assetsFolder) {
  const contentsPath = path.join(assetsFolder, "Contents.json");
  
  if (!fs.existsSync(contentsPath)) {
    console.log("⚠ Contents.json not found");
    return false;
  }

  const contents = JSON.parse(fs.readFileSync(contentsPath, 'utf8'));
  let missingFiles = [];

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

  console.log("✅ All iOS icons verified successfully");
  return true;
}

/**
 * Main hook
 */
module.exports = async function(context) {
  const root = context.opts.projectRoot;
  const platforms = context.opts.platforms;

  console.log("\n══════════════════════════════════");
  console.log("        GENERATE ICONS HOOK        ");
  console.log("══════════════════════════════════");
  console.log("Hook:", context.hook);
  console.log("Platforms:", platforms);

  for (const platform of platforms) {
    console.log(`\n📱 Processing platform: ${platform}`);
    
    const configPath = getConfigPath(context, platform);
    if (!configPath) {
      console.log(`⚠ config.xml not found for ${platform}. Skip.`);
      continue;
    }

    const config = getConfigParser(context, configPath);
    const cdnUrl = config.getPreference("cdnIcon");
    
    if (!cdnUrl) {
      console.log(`ℹ cdnIcon preference is empty for ${platform}. Skip.`);
      continue;
    }

    console.log(`📥 CDN Icon URL:`, cdnUrl);

    // Download icon
    let buffer;
    try {
      buffer = await downloadIcon(cdnUrl);
      console.log(`✔ Icon downloaded successfully (${buffer.length} bytes)`);
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
          console.log("⚠ iOS platform folder not found. Run 'cordova platform add ios' first.");
          continue;
        }

        // Tìm app folder
        const iosFolders = fs.readdirSync(platformPath)
          .filter(f => {
            const fullPath = path.join(platformPath, f);
            return fs.statSync(fullPath).isDirectory() && 
                   f !== "CordovaLib" && 
                   f !== "www" &&
                   f !== "cordova";
          });

        if (!iosFolders.length) {
          console.log("⚠ No iOS app folder found. Platform may not be fully initialized.");
          continue;
        }

        const appFolderName = iosFolders[0];
        console.log(`ℹ iOS app folder: ${appFolderName}`);

        // Generate icons
        const assetsFolder = await generateIOSIcons(buffer, root, appFolderName);
        
        // Verify icons
        verifyIOSIcons(assetsFolder);
        
        // Update Xcode project
        updateAppIcon(root, appFolderName);
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
