#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

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

// Try to load image processing library
let sharp = null;
let Jimp = null;

try {
    sharp = require('sharp');
    console.log('📦 Using Sharp for image processing');
} catch (e) {
    try {
        Jimp = require('jimp');
        console.log('📦 Using Jimp for image processing');
    } catch (e2) {
        console.log('❌ Neither Sharp nor Jimp available');
    }
}

async function resizeImage(src, dest, size) {
    try {
        if (sharp) {
            // Use Sharp (faster, better quality)
            await sharp(src)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .png()
                .toFile(dest);
            return true;
        } else if (Jimp) {
            // Use Jimp (fallback)
            const image = await Jimp.read(src);
            await image.resize(size, size).writeAsync(dest);
            return true;
        } else {
            console.log('⚠️ No image processing library available');
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Error resizing to ${size}x${size}:`, error.message);
        return false;
    }
}

module.exports = async function(context) {
    const ConfigParser = context.requireCordovaModule("cordova-common").ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, "config.xml"));
    
    const platforms = context.opts.platforms;
    const root = context.opts.projectRoot;
    
    console.log("\n══════════════════════════════════");
    console.log("        GENERATE ICONS HOOK        ");
    console.log("══════════════════════════════════");
    console.log("Hook type:", context.hook);
    console.log("Platforms:", platforms.join(", "));
    
    // Check if image processing available
    if (!sharp && !Jimp) {
        console.log("❌ Cannot generate icons: No image processing library found");
        console.log("   Install: npm install sharp OR npm install jimp");
        console.log("══════════════════════════════════\n");
        return;
    }
    
    // Get CDN_ICON preference
    const cdnUrl = (config.getPreference("CDN_ICON") || "").trim();
    
    // Validate: skip if empty
    if (!cdnUrl) {
        console.log("⚠ CDN_ICON not configured - skipping icon generation");
        console.log("══════════════════════════════════\n");
        return;
    }
    
    console.log("Project root:", root);
    console.log("CDN URL:", cdnUrl);
    
    // Download icon
    const tempIcon = path.join(root, "temp_icon_download.png");
    
    try {
        console.log("📥 Downloading icon from CDN...");
        await download(cdnUrl, tempIcon);
        const stats = fs.statSync(tempIcon);
        console.log(`✅ Icon downloaded (${stats.size} bytes)`);
    } catch (err) {
        console.log("❌ Failed to download icon:", err);
        console.log("══════════════════════════════════\n");
        return;
    }
    
    // Process each platform
    for (const platform of platforms) {
        console.log("\n📱 Processing platform:", platform);
        
        if (platform === "android") {
            await generateAndroidIcons(root, tempIcon);
        } else if (platform === "ios") {
            await generateIOSIcons(root, tempIcon);
        }
    }
    
    // Cleanup
    try {
        fs.unlinkSync(tempIcon);
        console.log("🧹 Cleaned up temporary files");
    } catch (e) {}
    
    console.log("\n══════════════════════════════════");
    console.log("✅ Icons generation completed!");
    console.log("══════════════════════════════════\n");
};

async function generateAndroidIcons(root, iconPath) {
    const androidPath = path.join(root, "platforms/android");
    
    if (!fs.existsSync(androidPath)) {
        console.log("❌ Android platform not found");
        return;
    }
    
    // Find res folder
    const resPaths = [
        path.join(androidPath, "app/src/main/res"),
        path.join(androidPath, "res")
    ];
    
    let resPath = null;
    for (const p of resPaths) {
        if (fs.existsSync(p)) {
            resPath = p;
            break;
        }
    }
    
    if (!resPath) {
        console.log("❌ Android res folder not found");
        return;
    }
    
    console.log("📁 Android res folder:", resPath);
    console.log("🎨 Generating Android icons...");
    
    const androidSizes = [
        ["mipmap-ldpi", 36],
        ["mipmap-mdpi", 48],
        ["mipmap-hdpi", 72],
        ["mipmap-xhdpi", 96],
        ["mipmap-xxhdpi", 144],
        ["mipmap-xxxhdpi", 192]
    ];
    
    let successCount = 0;
    for (const [folder, size] of androidSizes) {
        const folderPath = path.join(resPath, folder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        
        const output = path.join(folderPath, "ic_launcher.png");
        if (await resizeImage(iconPath, output, size)) {
            console.log(`  ✔ ${folder}/ic_launcher.png (${size}x${size})`);
            successCount++;
        }
    }
    
    console.log(`✅ Generated ${successCount}/${androidSizes.length} Android icons`);
}

async function generateIOSIcons(root, iconPath) {
    const iosPath = path.join(root, "platforms/ios");
    
    if (!fs.existsSync(iosPath)) {
        console.log("❌ iOS platform not found");
        return;
    }
    
    // Find app folder
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
    
    console.log("📁 iOS app folder:", appFolder);
    
    // AUTO-DETECT correct .xcassets folder
    const xcassetsFolders = fs.readdirSync(appPath).filter(f => {
        const xcassetsPath = path.join(appPath, f);
        return f.endsWith('.xcassets') && fs.statSync(xcassetsPath).isDirectory();
    });
    
    if (xcassetsFolders.length === 0) {
        console.log("❌ No .xcassets folder found");
        return;
    }
    
    // Use first .xcassets folder (usually Assets.xcassets or Images.xcassets)
    const xcassetsFolder = xcassetsFolders[0];
    const xcassetsPath = path.join(appPath, xcassetsFolder);
    const appIconPath = path.join(xcassetsPath, "AppIcon.appiconset");
    
    console.log("🎨 Generating iOS icons...");
    console.log("📍 Using:", xcassetsFolder);
    
    // Create AppIcon.appiconset if not exists
    if (!fs.existsSync(appIconPath)) {
        console.log("📁 Creating AppIcon.appiconset folder...");
        fs.mkdirSync(appIconPath, { recursive: true });
    }
    
    const iosSizes = [
        ["icon-20@2x.png", 40],
        ["icon-20@3x.png", 60],
        ["icon-29@2x.png", 58],
        ["icon-29@3x.png", 87],
        ["icon-40@2x.png", 80],
        ["icon-40@3x.png", 120],
        ["icon-60@2x.png", 120],
        ["icon-60@3x.png", 180],
        ["icon-20.png", 20],
        ["icon-29.png", 29],
        ["icon-40.png", 40],
        ["icon-76.png", 76],
        ["icon-76@2x.png", 152],
        ["icon-83.5@2x.png", 167],
        ["icon-1024.png", 1024]
    ];
    
    let successCount = 0;
    for (const [filename, size] of iosSizes) {
        const output = path.join(appIconPath, filename);
        if (await resizeImage(iconPath, output, size)) {
            console.log(`  ✔ ${filename} (${size}x${size})`);
            successCount++;
        }
    }
    
    console.log(`✅ Generated ${successCount}/${iosSizes.length} iOS icons`);
    
    // Create Contents.json
    const contentsJson = {
        "images": [
            { "size": "20x20", "idiom": "iphone", "filename": "icon-20@2x.png", "scale": "2x" },
            { "size": "20x20", "idiom": "iphone", "filename": "icon-20@3x.png", "scale": "3x" },
            { "size": "29x29", "idiom": "iphone", "filename": "icon-29@2x.png", "scale": "2x" },
            { "size": "29x29", "idiom": "iphone", "filename": "icon-29@3x.png", "scale": "3x" },
            { "size": "40x40", "idiom": "iphone", "filename": "icon-40@2x.png", "scale": "2x" },
            { "size": "40x40", "idiom": "iphone", "filename": "icon-40@3x.png", "scale": "3x" },
            { "size": "60x60", "idiom": "iphone", "filename": "icon-60@2x.png", "scale": "2x" },
            { "size": "60x60", "idiom": "iphone", "filename": "icon-60@3x.png", "scale": "3x" },
            { "size": "20x20", "idiom": "ipad", "filename": "icon-20.png", "scale": "1x" },
            { "size": "29x29", "idiom": "ipad", "filename": "icon-29.png", "scale": "1x" },
            { "size": "40x40", "idiom": "ipad", "filename": "icon-40.png", "scale": "1x" },
            { "size": "76x76", "idiom": "ipad", "filename": "icon-76.png", "scale": "1x" },
            { "size": "76x76", "idiom": "ipad", "filename": "icon-76@2x.png", "scale": "2x" },
            { "size": "83.5x83.5", "idiom": "ipad", "filename": "icon-83.5@2x.png", "scale": "2x" },
            { "size": "1024x1024", "idiom": "ios-marketing", "filename": "icon-1024.png", "scale": "1x" }
        ],
        "info": {
            "version": 1,
            "author": "cordova-plugin-change-app-info"
        }
    };
    
    const contentsPath = path.join(appIconPath, "Contents.json");
    fs.writeFileSync(contentsPath, JSON.stringify(contentsJson, null, 2));
    console.log("✅ Contents.json created");
}
