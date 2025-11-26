#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const { getConfigParser, getConfigPath } = require('./utils');

//
// Download CDN file content
//
function downloadText(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                if (res.statusCode !== 200) {
                    return reject(
                        `Download failed ${url} (status ${res.statusCode})`
                    );
                }
                let body = "";
                res.on("data", (d) => (body += d));
                res.on("end", () => resolve(body));
            })
            .on("error", reject);
    });
}

//
// Replace file content + create backup
//
async function replaceFileContent(file, url) {
    const content = await downloadText(url);

    const backup = file + ".bak";
    if (!fs.existsSync(backup)) {
        fs.copyFileSync(file, backup);
        console.log("✔ Backup created:", backup);
    }

    fs.writeFileSync(file, content, "utf8");
    console.log("✔ File replaced:", file);
}

//
// MAIN HOOK
//
module.exports = async function (context) {
    const root = context.opts.projectRoot;
    const platform = context.opts.platforms[0];

    console.log("");
    console.log("══════════════════════════════════");
    console.log("     CDN REPLACE ASSETS HOOK      ");
    console.log("══════════════════════════════════");

    const configPath = getConfigPath(context, platform);

    if (!configPath) {
        console.log("⚠ config.xml not found. Skip hook.");
        return;
    }

    console.log("✓ Using config.xml:", configPath);

    //
    // 2. Read CDN_ASSETS from plugin preference
    //
    const config = getConfigParser(context, configPath);
    const cdnConfigUrl = config.getPreference("CdnAssets");

    if (!cdnConfigUrl) {
        console.log("ℹ CDN_ASSETS is empty → skip");
        return;
    }

    console.log("📥 CDN JSON URL:", cdnConfigUrl);

    //
    // 3. Download JSON config file
    //
    let jsonText;
    try {
        jsonText = await downloadText(cdnConfigUrl);
    } catch (err) {
        console.error("❌ Cannot download CDN config:", err);
        return;
    }

    let items;
    try {
        items = JSON.parse(jsonText);
    } catch (err) {
        console.error("❌ JSON parse error:", err);
        return;
    }

    console.log("📄 CDN entries loaded:", items.length);

    //
    // 4. For each entry → replace real file content
    //
    for (const entry of items) {
        const localFile = entry.localFile;
        const cdnUrl = entry.cdn;

        let realPath;

        if (platform === "android") {
            // MABS → assets path is in app/src/main/assets/www
            realPath = path.join(
                root,
                "platforms",
                "android",
                "app/src/main/assets",
                localFile
            );
        }

        if (platform === "ios") {
            // MABS → www lives directly in platforms/ios/www/
            realPath = path.join(
                root,
                "platforms",
                "ios",
                "www",
                localFile.replace("www/", "")
            );
        }

        if (!realPath || !fs.existsSync(realPath)) {
            console.log("⚠ File NOT FOUND:", realPath);
            continue;
        }

        console.log("➡ Replacing:", realPath);

        try {
            await replaceFileContent(realPath, cdnUrl);
        } catch (err) {
            console.error("❌ Replace error:", err);
        }
    }

    console.log("✔ CDN replacement completed.");
    console.log("══════════════════════════════════");
    console.log("");
};
