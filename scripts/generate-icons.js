#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Auto-import sharp + node-fetch
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
 * Download icon from URL
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function downloadIcon(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}, status ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate Android icons
 * @param {Buffer} buffer
 * @param {string} root
 */
async function generateAndroidIcons(buffer, root) {
    const legacySizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192
    };

    // Legacy icons
    for (const [folder, size] of Object.entries(legacySizes)) {
        const dir = path.join(root, "platforms/android/app/src/main/res", folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, "ic_launcher.png");
        await sharp(buffer).resize(size, size).toFile(filePath);
        console.log(`✔ Android legacy icon: ${filePath}`);
    }

    // Adaptive icons (foreground + background)
    const adaptiveDir = path.join(root, "platforms/android/app/src/main/res/mipmap-anydpi-v26");
    if (!fs.existsSync(adaptiveDir)) fs.mkdirSync(adaptiveDir, { recursive: true });

    const foreground = path.join(adaptiveDir, "ic_launcher_foreground.png");
    const background = path.join(adaptiveDir, "ic_launcher_background.png");

    // Foreground: resized square
    await sharp(buffer).resize(432, 432).toFile(foreground);

    // Background: blurred version
    await sharp(buffer)
        .resize(1080, 1080)
        .blur(10)
        .toFile(background);

    console.log(`✔ Android adaptive icons: ${foreground}, ${background}`);
}

/**
 * Generate iOS icons
 * @param {Buffer} buffer
 * @param {string} root
 */
async function generateIOSIcons(buffer, root) {
    const iosFolder = path.join(root, "platforms/ios");
    if (!fs.existsSync(iosFolder)) return;

    const dirs = fs.readdirSync(iosFolder).filter(d =>
        fs.existsSync(path.join(iosFolder, d, "Images.xcassets"))
    );
    if (!dirs.length) return;

    const assetsFolder = path.join(iosFolder, dirs[0], "Images.xcassets", "AppIcon.appiconset");
    if (!fs.existsSync(assetsFolder)) fs.mkdirSync(assetsFolder, { recursive: true });

    const sizes = [
        20, 29, 40, 60, 76, 83.5, 1024
    ];

    for (const size of sizes) {
        const filePath = path.join(assetsFolder, `icon-${size}x${size}.png`);
        await sharp(buffer).resize(size, size).toFile(filePath);
        console.log(`✔ iOS icon generated: ${filePath}`);
    }
}

/**
 * Main hook
 */
module.exports = async function(context) {
    const root = context.opts.projectRoot;
    const platform = context.opts.platforms[0];

    console.log("\n══════════════════════════════════");
    console.log("       GENERATE ICONS HOOK         ");
    console.log("══════════════════════════════════");

    // 1️⃣ Lấy config.xml path
    const configPath = getConfigPath(context, platform);
    if (!configPath) {
        console.log("⚠ config.xml not found. Skip hook.");
        return;
    }

    // 2️⃣ Lấy ConfigParser
    const config = getConfigParser(context, configPath);

    // 3️⃣ Lấy CDN URL từ plugin preference "cdnIcon"
    const cdnUrl = config.getPreference("cdnIcon");
    if (!cdnUrl) {
        console.log("ℹ cdnIcon preference is empty → skip");
        return;
    }

    console.log("📥 CDN Icon URL:", cdnUrl);

    // 4️⃣ Download icon
    let buffer;
    try {
        buffer = await downloadIcon(cdnUrl);
    } catch (err) {
        console.error("✖ Failed to download icon:", err.message);
        return;
    }

    // 5️⃣ Generate icons
    try {
        if (platform === "android") {
            await generateAndroidIcons(buffer, root);
        } else if (platform === "ios") {
            await generateIOSIcons(buffer, root);
        }
    } catch (err) {
        console.error("✖ Failed to generate icons:", err.message);
    }

    console.log("✅ Icons generation completed!");
};
