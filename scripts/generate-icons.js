#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Tự động import sharp và node-fetch
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
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function downloadIcon(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}, status ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate icons for Android
 * @param {Buffer} buffer
 * @param {string} root
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
        await sharp(buffer)
            .resize(size, size)
            .toFile(filePath);

        console.log(`✔ Android icon generated: ${filePath}`);
    }
}

/**
 * Generate icons for iOS
 * @param {Buffer} buffer
 * @param {string} root
 */
async function generateIOSIcons(buffer, root) {
    const sizes = [20, 29, 40, 60, 76, 83.5, 1024]; // iOS sizes
    const iosFolder = path.join(root, "platforms/ios");
    if (!fs.existsSync(iosFolder)) return;

    const dirs = fs.readdirSync(iosFolder).filter(d =>
        fs.existsSync(path.join(iosFolder, d, "Images.xcassets"))
    );
    if (!dirs.length) return;

    const assetsFolder = path.join(iosFolder, dirs[0], "Images.xcassets", "AppIcon.appiconset");
    if (!fs.existsSync(assetsFolder)) fs.mkdirSync(assetsFolder, { recursive: true });

    for (const size of sizes) {
        const filePath = path.join(assetsFolder, `icon-${size}x${size}.png`);
        await sharp(buffer)
            .resize(size, size)
            .toFile(filePath);

        console.log(`✔ iOS icon generated: ${filePath}`);
    }
}

/**
 * Main hook
 */
module.exports = async function (context) {
    const root = context.opts.projectRoot;
    const platform = context.opts.platforms[0];

    console.log("\n══════════════════════════════════");
    console.log("        GENERATE ICONS HOOK        ");
    console.log("══════════════════════════════════");

    // 1️⃣ Lấy config.xml path
    const configPath = getConfigPath(context, platform);
    if (!configPath) {
        console.log("⚠ config.xml not found. Skip hook.");
        return;
    }

    // 2️⃣ Lấy ConfigParser
    const config = getConfigParser(context, configPath);

    // 3️⃣ Lấy CDN URL từ plugin preference
    const cdnUrl = config.getPreference("cdnIcon");
    if (!cdnUrl) {
        console.log("ℹ CDN_ICON is empty → skip");
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
