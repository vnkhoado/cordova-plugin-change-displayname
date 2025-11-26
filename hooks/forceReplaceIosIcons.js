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
    try {
        execSync(`sips -z ${size} ${size} "${src}" --out "${dest}"`, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = async function(context) {
    const root = context.opts.projectRoot;
    const platforms = context.opts.platforms || [];
    
    if (!platforms.includes('ios')) {
        return;
    }

    // Get CDN icon URL
    let cdn = null;
    try {
        const configXML = fs.readFileSync(path.join(root, "config.xml"), "utf8");
        const match = configXML.match(/<preference\s+name="CDN_ICON"\s+value="([^"]+)"/);
        if (match) {
            cdn = match[1];
        }
    } catch (e) {}

    if (!cdn) {
        console.log("⚠ CDN_ICON not found, skip iOS icon replacement");
        return;
    }

    console.log("\n══════════════════════════════════");
    console.log("  FORCE REPLACE iOS ICONS FROM CDN");
    console.log("══════════════════════════════════");
    console.log("🔗 CDN URL:", cdn);

    // Find iOS app folder
    const iosPath = path.join(root, "platforms/ios");
    
    if (!fs.existsSync(iosPath)) {
        console.log("❌ iOS platform not found");
        return;
    }

    const appFolders = fs.readdirSync(iosPath).filter(f => {
        const fullPath = path.join(iosPath, f);
        return fs.statSync(fullPath).isDirectory() && 
               f !== "CordovaLib" && 
               f !== "www" && 
               f !== "cordova" &&
               f !== "build" &&
               f !== "Pods";
    });

    if (appFolders.length === 0) {
        console.log("❌ iOS app folder not found");
        return;
    }

    const appFolder = appFolders[0];
    const appPath = path.join(iosPath, appFolder);
    
    console.log("📱 App folder:", appFolder);

    // AUTO-DETECT correct .xcassets folder (Assets.xcassets or Images.xcassets)
    const xcassetsFolders = fs.readdirSync(appPath).filter(f => {
        const xcassetsPath = path.join(appPath, f);
        return f.endsWith('.xcassets') && 
               fs.statSync(xcassetsPath).isDirectory() &&
               fs.existsSync(path.join(xcassetsPath, 'AppIcon.appiconset'));
    });

    if (xcassetsFolders.length === 0) {
        console.log("❌ AppIcon.appiconset not found in any .xcassets folder");
        return;
    }

    // Use the first .xcassets folder found (usually Assets.xcassets)
    const xcassetsFolder = xcassetsFolders[0];
    const appIconDir = path.join(appPath, xcassetsFolder, 'AppIcon.appiconset');
    
    console.log("📁 Using XCAssets:", xcassetsFolder);
    console.log("📂 AppIcon path:", appIconDir);

    // Download icon
    const tempIcon = path.join(root, "temp_cdn_icon.png");
    
    try {
        console.log("📥 Downloading...");
        await download(cdn, tempIcon);
        console.log("✅ Downloaded");
    } catch (err) {
        console.log("❌ Download failed:", err);
        return;
    }

    // Icon sizes for iOS
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

    console.log("🔄 Replacing all iOS AppIcon files...");
    
    let successCount = 0;
    for (const [filename, size] of sizes) {
        const output = path.join(appIconDir, filename);
        if (resizeWithSips(tempIcon, output, size)) {
            console.log(`  ✔ ${filename} (${size}x${size})`);
            successCount++;
        } else {
            console.log(`  ✖ ${filename} (failed)`);
        }
    }

    // Cleanup
    try {
        fs.unlinkSync(tempIcon);
    } catch (e) {}

    console.log(`✅ Replaced ${successCount}/${sizes.length} iOS icons`);
    console.log("══════════════════════════════════\n");
};
