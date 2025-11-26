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
    const ConfigParser = context.requireCordovaModule("cordova-common").ConfigParser;
    const config = new ConfigParser(path.join(context.opts.projectRoot, "config.xml"));
    
    const platforms = context.opts.platforms;
    const root = context.opts.projectRoot;
    
    console.log("\n══════════════════════════════════");
    console.log("        GENERATE ICONS HOOK        ");
    console.log("══════════════════════════════════");
    console.log("Hook type:", context.hook);
    console.log("Platforms:", platforms.join(", "));
    
    // Get CDN_ICON
    const cdnUrl = config.getPreference("CDN_ICON");
    
    if (!cdnUrl) {
        console.log("⚠ CDN_ICON not found in config.xml");
        console.log("══════════════════════════════════\n");
        return;
    }
    
    console.log("Project root:", root);
    console.log("Checking for CDN_ICON in", path.join(root, "config.xml"));
    console.log("Found CDN_ICON in config.xml:", cdnUrl);
    console.log("CDN URL:", cdnUrl);
    
    // Download icon
    const tempIcon = path.join(root, "temp_icon_download.png");
    
    try {
        console.log("Downloading icon from", cdnUrl);
        await download(cdnUrl, tempIcon);
        const stats = fs.statSync(tempIcon);
        console.log("Icon downloaded successfully", stats.size, "bytes");
    } catch (err) {
        console.log("❌ Failed to download icon:", err);
        console.log("══════════════════════════════════\n");
        return;
    }
    
    // Process each platform
    for (const platform of platforms) {
        console.log("\nProcessing platform:", platform);
        
        if (platform === "android") {
            await generateAndroidIcons(root, tempIcon);
        } else if (platform === "ios") {
            await generateIOSIcons(root, tempIcon);
        }
    }
    
    // Cleanup
    try {
        fs.unlinkSync(tempIcon);
    } catch (e) {}
    
    console.log("\n══════════════════════════════════");
    console.log("Icons generation completed!");
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
    
    console.log("Android res folder:", resPath);
    console.log("Generating Android icons...");
    
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
        if (resizeWithSips(iconPath, output, size)) {
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
    
    console.log("iOS app folder:", appFolder);
    
    // AUTO-DETECT correct .xcassets folder ✅
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
    
    console.log("Cleaning iOS build cache...");
    // No cache to clean (handled by cleanBuild.js)
    console.log("No cache to clean");
    
    console.log("Generating iOS icons...");
    console.log("iOS folder:", appPath);
    console.log("XCAssets folder:", xcassetsPath);
    console.log("📁 Using:", xcassetsFolder);  // ✅ LOG FOLDER NAME
    console.log("AppIcon folder:", appIconPath);
    
    // Create AppIcon.appiconset if not exists
    if (!fs.existsSync(appIconPath)) {
        console.log("Creating AppIcon.appiconset folder...");
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
        ["icon-20@2x.png", 40],
        ["icon-29.png", 29],
        ["icon-29@2x.png", 58],
        ["icon-40.png", 40],
        ["icon-40@2x.png", 80],
        ["icon-76.png", 76],
        ["icon-76@2x.png", 152],
        ["icon-83.5@2x.png", 167],
        ["icon-1024.png", 1024]
    ];
    
    let successCount = 0;
    for (const [filename, size] of iosSizes) {
        const output = path.join(appIconPath, filename);
        if (resizeWithSips(iconPath, output, size)) {
            console.log(`  ✔ ${filename} (${size}x${size})`);
            successCount++;
        }
    }
    
    console.log(`Generated ${successCount} iOS icon sizes`);
    
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
            { "size": "20x20", "idiom": "ipad", "filename": "icon-20@2x.png", "scale": "2x" },
            { "size": "29x29", "idiom": "ipad", "filename": "icon-29.png", "scale": "1x" },
            { "size": "29x29", "idiom": "ipad", "filename": "icon-29@2x.png", "scale": "2x" },
            { "size": "40x40", "idiom": "ipad", "filename": "icon-40.png", "scale": "1x" },
            { "size": "40x40", "idiom": "ipad", "filename": "icon-40@2x.png", "scale": "2x" },
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
    console.log("Contents.json created at", contentsPath);
    
    // Verify
    console.log("Verifying iOS icons...");
    const allExist = iosSizes.every(([filename]) => 
        fs.existsSync(path.join(appIconPath, filename))
    );
    
    if (allExist) {
        console.log(`All ${iosSizes.length} iOS icons verified`);
    } else {
        console.log("⚠ Some icons are missing");
    }
    
    // Update Xcode project
    const projectPath = path.join(iosPath, appFolder + ".xcodeproj", "project.pbxproj");
    console.log("Checking Xcode project", projectPath);
    
    if (fs.existsSync(projectPath)) {
        try {
            let projectContent = fs.readFileSync(projectPath, "utf8");
            const targetMatch = projectContent.match(/\/\* (.*?) \*\/ = \{[^}]*isa = PBXNativeTarget/);
            
            if (targetMatch) {
                const targetName = targetMatch[1];
                console.log("iOS target:", targetName);
                
                const currentSetting = projectContent.match(/ASSETCATALOG_COMPILER_APPICON_NAME = ([^;]+);/);
                console.log("Current AppIcon setting:", currentSetting ? currentSetting[1].trim() : "Not set");
                
                // Ensure ASSETCATALOG_COMPILER_APPICON_NAME is set
                const regex = /ASSETCATALOG_COMPILER_APPICON_NAME = [^;]+;/g;
                const replacement = 'ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;';
                
                let changeCount = 0;
                projectContent = projectContent.replace(regex, (match) => {
                    changeCount++;
                    return replacement;
                });
                
                if (changeCount > 0) {
                    fs.writeFileSync(projectPath, projectContent);
                    console.log(`Updated project.pbxproj: Set ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon (${changeCount} configurations)`);
                }
                
                // Touch xcassets to force Xcode to refresh
                const now = new Date();
                fs.utimesSync(xcassetsPath, now, now);
                console.log("Touched xcassets to force Xcode refresh");
                
            }
        } catch (err) {
            console.log("⚠ Warning: Could not update Xcode project:", err.message);
        }
    }
    
    console.log("iOS icon generation completed!");
    console.log("\nIMPORTANT: To see new icon on device:");
    console.log("1. DELETE app completely from device");
    console.log("2. REBOOT device (turn off and on)");
    console.log("3. Install app again");
}
