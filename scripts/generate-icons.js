#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

let sharp, fetch;
try {
  sharp = require("sharp");
  fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
} catch (err) {
  console.error("✖ Please install sharp and node-fetch in plugin folder");
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
 * Generate iOS Pro icons + Contents.json
 */
async function generateIOSProIcons(buffer, root) {
  const iosFolder = path.join(root, "platforms/ios");
  if (!fs.existsSync(iosFolder)) {
    console.log("⚠ iOS folder not found, skip.");
    return;
  }

  // 🔍 Tìm folder AppName chứa Images.xcassets
  let assetsFolder = null;
  for (const d of fs.readdirSync(iosFolder)) {
    const candidate1 = path.join(iosFolder, d, "Images.xcassets", "AppIcon.appiconset");
    const candidate2 = path.join(iosFolder, d, "Resources", "Images.xcassets", "AppIcon.appiconset");

    if (fs.existsSync(candidate1)) { assetsFolder = candidate1; break; }
    if (fs.existsSync(candidate2)) { assetsFolder = candidate2; break; }
  }

  // Nếu chưa có, tạo folder
  if (!assetsFolder) {
    const appName = fs.readdirSync(iosFolder)[0]; // lấy folder đầu tiên làm AppName
    const xcassetsFolder = path.join(iosFolder, appName, "Images.xcassets");
    if (!fs.existsSync(xcassetsFolder)) fs.mkdirSync(xcassetsFolder, { recursive: true });
    assetsFolder = path.join(xcassetsFolder, "AppIcon.appiconset");
    if (!fs.existsSync(assetsFolder)) fs.mkdirSync(assetsFolder, { recursive: true });
    console.log("📦 Created iOS AppIcon folder:", assetsFolder);
  } else {
    console.log("📦 Found iOS AppIcon folder:", assetsFolder);
  }

  // Chuẩn icon Apple
  const icons = [
    { size: 20, idiom: "iphone", scale: [2,3], role: "notification" },
    { size: 29, idiom: "iphone", scale: [2,3], role: "settings" },
    { size: 40, idiom: "iphone", scale: [2,3], role: "spotlight" },
    { size: 60, idiom: "iphone", scale: [2,3], role: "app" },
    { size: 20, idiom: "ipad", scale: [1,2], role: "notification" },
    { size: 29, idiom: "ipad", scale: [1,2], role: "settings" },
    { size: 40, idiom: "ipad", scale: [1,2], role: "spotlight" },
    { size: 76, idiom: "ipad", scale: [1,2], role: "app" },
    { size: 83.5, idiom: "ipad", scale: [2], role: "app" },
    { size: 1024, idiom: "ios-marketing", scale: [1], role: "appstore" }
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
 * Main hook
 */
module.exports = async function (context) {
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
        await generateIOSProIcons(buffer, root);
      }
    } catch (err) {
      console.error(`✖ Failed to generate icons for ${platform}:`, err.message);
    }
  }

  console.log("✅ Icons generation completed!\n");
};
