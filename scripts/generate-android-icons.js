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
    const platform = context.opts.platforms.includes("android") ? "android" : null;

    if (!platform) return;

    console.log("\n🔥 ANDROID ICON HOOK (before_prepare)\n");

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

    console.log("✅ Android icons done!\n");
};
