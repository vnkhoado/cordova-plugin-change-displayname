#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const { execSync } = require("child_process");

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on("finish", () => file.close(() => resolve(true)));
        }).on("error", (err) => {
            fs.unlink(dest, () => {});
            reject(err.message);
        });
    });
}

function resizeWithSips(src, dest, size) {
    // sips là tool có sẵn trên macOS, MABS cloud build (Mac) hỗ trợ
    try {
        execSync(`sips -z ${size} ${size} "${src}" --out "${dest}"`);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = async function(context) {
    const root = context.opts.projectRoot;
    const platforms = context.opts.platforms || [];
    if (!platforms.includes('ios')) return;

    // Lấy CDN icon
    let cdn = null;
    try {
        const configXML = fs.readFileSync(path.join(root, "config.xml"), "utf8");
        const match = configXML.match(/<preference\s+name="CDN_ICON"\s+value="([^"]+)"/);
        if (match) cdn = match[1];
    } catch {}

    if (!cdn) {
        console.log("❗ Không tìm thấy CDN_ICON, bỏ qua force replace iOS icons!");
        return;
    }

    // Tìm app folder
    const iosPath = path.join(root, "platforms/ios");
    const appFolder = fs.readdirSync(iosPath).find(name =>
        fs.existsSync(path.join(iosPath, name, "Assets.xcassets", "AppIcon.appiconset"))
    );
    if (!appFolder) {
        console.log("❗ Không tìm thấy AppIcon.appiconset!");
        return;
    }

    const appIconDir = path.join(iosPath, appFolder, "Assets.xcassets", "AppIcon.appiconset");
    const tempIcon = path.join(root, "temp_cdn_icon.png");

    console.log("➡️  Download icon from:", cdn);
    await download(cdn, tempIcon);

    // Danh sách size icon iOS chuẩn
    const sizes = [
        ["icon-20.png", 20],
        ["icon-20@2x.png", 40],
        ["icon-20@3x.png", 60],
        ["icon-29.png", 29],
        ["icon-29@2x.png", 58],
        ["icon-29@3x.png", 87],
        ["icon-40.png", 40],
        ["icon-40@2x.png", 80],
        ["icon-40@3x.png", 120],
        ["icon-60@2x.png", 120],
        ["icon-60@3x.png", 180],
        ["icon-76.png", 76],
        ["icon-76@2x.png", 152],
        ["icon-83.5@2x.png", 167],
        ["icon-1024.png", 1024]
    ];

    console.log("🔁 Force replace ALL iOS App Icons from CDN...");
    for (const [filename, size] of sizes) {
        const output = path.join(appIconDir, filename);
        if (resizeWithSips(tempIcon, output, size)) {
            console.log(`  ✔ ${filename} (${size}x${size})`);
        } else {
            console.log(`  ❌ Failed: ${filename}`);
        }
    }
    try { fs.unlinkSync(tempIcon); } catch{}

    console.log("✅ All iOS AppIcon files have been replaced!\n");
};
