#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
let sharp;

try {
    sharp = require("sharp");
} catch (err) {
    console.error("✖ Please install sharp in plugin folder");
    process.exit(1);
}

const { getConfigPath, getConfigParser } = require("./utils");

module.exports = async function (context) {
    const root = context.opts.projectRoot;
    const platform = context.opts.platforms.includes("ios") ? "ios" : null;

    if (!platform) return;

    console.log("\n🍏 IOS ICON HOOK (after_prepare)\n");

    const configPath = getConfigPath(context, platform);
    if (!configPath) return;

    const config = getConfigParser(context, configPath);
    const cdnUrl = config.getPreference("cdnIcon");
    if (!cdnUrl) return;

    console.log("📥 CDN Icon URL:", cdnUrl);

    let buffer;
    try {
        const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
        const res = await fetch(cdnUrl);
        buffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
        console.error("✖ Failed to download icon:", err.message);
        return;
    }

    // 🔍 Tìm folder iOS
    const iosFolder = path.join(root, "platforms/ios");
    if (!fs.existsSync(iosFolder)) {
        console.log("⚠ iOS folder not found. Skip.");
        return;
    }

    // 🔍 Tìm đúng app folder chứa Images.xcassets
    let appNameDir = null;

    for (const d of fs.readdirSync(iosFolder)) {
        if (fs.existsSync(path.join(iosFolder, d, "Images.xcassets"))) {
            appNameDir = d;
            break;
        }
    }

    if (!appNameDir) {
        console.log("⚠ Images.xcassets not found. Skip.");
        return;
    }

    const assetsFolder = path.join(
        iosFolder,
        appNameDir,
        "Images.xcassets",
        "AppIcon.appiconset"
    );

    if (!fs.existsSync(assetsFolder)) {
        fs.mkdirSync(assetsFolder, { recursive: true });
    }

    const sizes = [20, 29, 40, 60, 76, 83.5, 1024];

    for (const size of sizes) {
        const filePath = path.join(assetsFolder, `icon-${size}x${size}.png`);
        await sharp(buffer).resize(size, size).toFile(filePath);
        console.log(`✔ iOS icon generated: ${filePath}`);
    }

    console.log("✅ iOS icons done!\n");
};
