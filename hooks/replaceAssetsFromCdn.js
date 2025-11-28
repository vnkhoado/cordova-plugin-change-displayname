#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { getConfigParser } = require('./utils');

/**
 * Download text content from URL (supports both http and https)
 */
function downloadText(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol
            .get(url, (res) => {
                // Handle redirects
                if (res.statusCode === 301 || res.statusCode === 302) {
                    return downloadText(res.headers.location)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (res.statusCode !== 200) {
                    return reject(
                        new Error(`Download failed ${url} (status ${res.statusCode})`)
                    );
                }
                
                let body = "";
                res.on("data", (d) => (body += d));
                res.on("end", () => resolve(body));
            })
            .on("error", reject);
    });
}

/**
 * Replace file content with CDN content and create backup
 */
async function replaceFileContent(file, url) {
    console.log(`   📥 Downloading from: ${url}`);
    
    const content = await downloadText(url);

    // Create backup only once
    const backup = file + ".bak";
    if (!fs.existsSync(backup)) {
        fs.copyFileSync(file, backup);
        console.log(`   💾 Backup created: ${path.basename(backup)}`);
    }

    fs.writeFileSync(file, content, "utf8");
    console.log(`   ✅ File replaced: ${path.basename(file)} (${content.length} bytes)`);
}

/**
 * Get CDN assets config from root config.xml
 */
function getCdnAssetsUrl(context) {
    const root = context.opts.projectRoot;
    const rootConfigPath = path.join(root, "config.xml");
    
    if (!fs.existsSync(rootConfigPath)) {
        console.log("⚠ Root config.xml not found");
        return null;
    }

    try {
        const config = getConfigParser(context, rootConfigPath);
        
        // Try multiple preference names
        const url = (config.getPreference("CDN_ASSETS") || 
                     config.getPreference("CdnAssets") ||
                     config.getPreference("cdn_assets") || "").trim();
        
        // Validate: skip if empty
        if (!url) {
            return null;
        }
        
        console.log(`ℹ️ Found CDN_ASSETS in config.xml`);
        return url;
    } catch (err) {
        console.log("⚠ Could not read config.xml:", err.message);
    }
    
    return null;
}

/**
 * Get platform-specific path for asset
 */
function getPlatformPath(root, platform, localFile) {
    let realPath;

    if (platform === "android") {
        // Android: assets path is in app/src/main/assets/www
        realPath = path.join(
            root,
            "platforms",
            "android",
            "app/src/main/assets",
            localFile
        );
    } else if (platform === "ios") {
        // iOS: www lives directly in platforms/ios/www/
        const cleanPath = localFile.replace(/^\/*(www\/)?/, '');
        realPath = path.join(
            root,
            "platforms",
            "ios",
            "www",
            cleanPath
        );
    }

    return realPath;
}

/**
 * MAIN HOOK
 */
module.exports = async function (context) {
    const root = context.opts.projectRoot;
    const platforms = context.opts.platforms;

    console.log("\n══════════════════════════════════");
    console.log("   CDN REPLACE ASSETS HOOK      ");
    console.log("══════════════════════════════════");

    // Get CDN config URL from root config.xml
    const cdnConfigUrl = getCdnAssetsUrl(context);

    if (!cdnConfigUrl) {
        console.log("⚠ CDN_ASSETS không được set hoặc rỗng - bỏ qua replace assets");
        console.log("ℹ️ Để sử dụng tính năng này, thêm vào config.xml:");
        console.log('  <preference name="CDN_ASSETS" value="https://your-cdn.com/assets.json" />\n');
        return;
    }

    console.log(`🔗 CDN Config URL: ${cdnConfigUrl}`);

    // Download JSON config file
    let jsonText;
    try {
        jsonText = await downloadText(cdnConfigUrl);
        console.log(`✅ Config downloaded (${jsonText.length} bytes)`);
    } catch (err) {
        console.error(`❌ Cannot download CDN config: ${err.message}`);
        return;
    }

    // Parse JSON
    let items;
    try {
        items = JSON.parse(jsonText);
        if (!Array.isArray(items)) {
            throw new Error("Config must be an array");
        }
        console.log(`📄 Found ${items.length} asset(s) to replace\n`);
    } catch (err) {
        console.error(`❌ JSON parse error: ${err.message}`);
        return;
    }

    // Process each platform
    for (const platform of platforms) {
        console.log(`\n📱 Processing platform: ${platform}`);
        
        const platformPath = path.join(root, "platforms", platform);
        if (!fs.existsSync(platformPath)) {
            console.log(`⚠ Platform folder not found: ${platform}`);
            continue;
        }

        let replacedCount = 0;
        let errorCount = 0;

        // Replace each asset
        for (const entry of items) {
            const localFile = entry.localFile || entry.local || entry.file;
            const cdnUrl = entry.cdn || entry.url || entry.cdnUrl;

            if (!localFile || !cdnUrl) {
                console.log(`⚠ Invalid entry (missing localFile or cdn):`, entry);
                errorCount++;
                continue;
            }

            const realPath = getPlatformPath(root, platform, localFile);

            if (!realPath) {
                console.log(`⚠ Could not determine path for: ${localFile}`);
                errorCount++;
                continue;
            }

            if (!fs.existsSync(realPath)) {
                console.log(`⚠ File not found: ${path.relative(root, realPath)}`);
                errorCount++;
                continue;
            }

            console.log(`\n➡ Replacing: ${path.relative(root, realPath)}`);

            try {
                await replaceFileContent(realPath, cdnUrl);
                replacedCount++;
            } catch (err) {
                console.error(`   ❌ Replace error: ${err.message}`);
                errorCount++;
            }
        }

        console.log(`\n${platform}: ${replacedCount} replaced, ${errorCount} errors`);
    }

    console.log("\n══════════════════════════════════");
    console.log("✅ CDN replacement completed!");
    console.log("══════════════════════════════════\n");
};