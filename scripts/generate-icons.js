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

  if (!fs.existsSync(assetsFolder)) fs.mkdirSync(assetsFolder, { recursive: true });
  console.log("📦 Using iOS AppIcon folder:", assetsFolder);

  const icons = [
    { size: 20, idiom: "iphone", scale: [2,3] },
    { size: 29, idiom: "iphone", scale: [2,3] },
    { size: 40, idiom: "iphone", scale: [2,3] },
    { size: 60, idiom: "iphone", scale: [2,3] },
    { size: 20, idiom: "ipad", scale: [1,2] },
    { size: 29, idiom: "ipad", scale: [1,2] },
    { size: 40, idiom: "ipad", scale: [1,2] },
    { size: 76, idiom: "ipad", scale: [1,2] },
    { size: 83.5, idiom: "ipad", scale: [2] },
    { size: 1024, idiom: "ios-marketing", scale: [1] }
  ];

  const contentsImages = [];

  for (const icon of icons) {
    for (const scale of icon.scale) {
      const scaledSize = Math.round(icon.size * scale);
      const scaleSuffix = scale === 1 ? "" : `@${scale}x`;
      const filename = `icon-${icon.size}${scaleSuffix}.png`;
      const filePath = path.join(assetsFolder, filename);

      await sharp(buffer).resize(scaledSize, scaledSize).toFile(filePath);

      if (icon.size !== 1024) {
        contentsImages.push({
          idiom: icon.idiom,
          size: `${icon.size}x${icon.size}`,
          scale: `${scale}x`,
          filename
        });
      }

      console.log(`✔ iOS icon generated: ${filePath}`);
    }
  }

  // Tạo Contents.json
  const contentsJson = {
    images: contentsImages,
    info: { version: 1, author: "xcode" }
  };

  fs.writeFileSync(path.join(assetsFolder, "Contents.json"), JSON.stringify(contentsJson, null, 2));
  console.log("✅ iOS Contents.json generated!");
}

/**
 * Log all targets and return project + target UUID
 */
function getIOSTarget(root, appFolderName) {
  const pbxPath = path.join(root, "platforms/ios", appFolderName + ".xcodeproj", "project.pbxproj");
  if (!fs.existsSync(pbxPath)) return {};

  const proj = xcode.project(pbxPath);
  proj.parseSync();

  // Lấy tất cả native target, bỏ CordovaLib
  const targets = Object.values(proj.pbxNativeTargetSection()).filter(t => t.comment && !t.comment.includes("CordovaLib"));
  if (!targets.length) return {};

  const targetUUID = Object.keys(targets[0])[0];
  console.log("ℹ iOS target found:", targets[0].comment);

  // Log AppIcon hiện tại
  const buildSettings = proj.pbxXCBuildConfigurationSection();
  const settingsForTarget = Object.values(buildSettings).filter(
    x => x.buildSettings && x.buildSettings.PRODUCT_NAME === targets[0].comment
  );
  const appIconName = settingsForTarget[0]?.buildSettings?.ASSETCATALOG_COMPILER_APPICON_NAME;
  console.log("ℹ Current AppIcon:", appIconName || "(not set)");

  return { proj, targetUUID };
}

/**
 * Update AppIcon in project.pbxproj
 */
function updateAppIcon(root, appFolderName) {
  const { proj, targetUUID } = getIOSTarget(root, appFolderName);
  if (!proj || !targetUUID) return;

  proj.updateBuildProperty("ASSETCATALOG_COMPILER_APPICON_NAME", "AppIcon", targetUUID);

  fs.writeFileSync(
    path.join(root, "platforms/ios", appFolderName + ".xcodeproj", "project.pbxproj"),
    proj.writeSync()
  );
  console.log("✅ Updated project.pbxproj: AppIcon set to AppIcon.appiconset");
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

  for (const platform of platforms) {
    const configPath = getConfigPath(context, platform);
    if (!configPath) {
      console.log(`⚠ config.xml not found for ${platform}. Skip.`);
      continue;
    }

    const config = getConfigParser(context, configPath);
    const cdnUrl = config.getPreference("cdnIcon");
    if (!cdnUrl) {
      console.log(`ℹ CDN_ICON is empty for ${platform}. Skip`);
      continue;
    }

    console.log(`📥 [${platform}] CDN Icon URL:`, cdnUrl);

    let buffer;
    try {
      buffer = await downloadIcon(cdnUrl);
    } catch (err) {
      console.error(`✖ Failed to download icon for ${platform}:`, err.message);
      continue;
    }

    try {
      if (platform === "android") {
        await generateAndroidIcons(buffer, root);
      } else if (platform === "ios") {
        const iosFolders = fs.readdirSync(path.join(root, "platforms/ios"))
          .filter(f => fs.statSync(path.join(root, "platforms/ios", f)).isDirectory() && f !== "CordovaLib");

        if (!iosFolders.length) {
          console.log("⚠ No iOS app folder found. Skip.");
          continue;
        }

        const appFolderName = iosFolders[0];
        await generateIOSIcons(buffer, root, appFolderName);
        updateAppIcon(root, appFolderName);
      }
    } catch (err) {
      console.error(`✖ Failed to generate icons for ${platform}:`, err.message);
    }
  }

  console.log("✅ Icons generation completed!\n");
};
