#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const semver = require("semver");

//
// Load Cordova config.xml parser
//
function getConfigParser(context, filePath) {
    let ConfigParser;
    if (semver.lt(context.opts.cordova.version, "5.4.0")) {
        ConfigParser = context.requireCordovaModule(
            "cordova-lib/src/ConfigParser/ConfigParser"
        );
    } else {
        ConfigParser = context.requireCordovaModule(
            "cordova-common/src/ConfigParser/ConfigParser"
        );
    }
    return new ConfigParser(filePath);
}

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

    //
    // 1. Find config.xml path
    //
    let configPath = null;

    if (platform === "android") {
        const p1 = path.join(
            root,
            "platforms",
            "android",
            "app/src/main/res/xml/config.xml"
        );
        const p2 = path.join(
            root,
            "platforms",
            "android",
            "res/xml/config.xml"
        );

        configPath = fs.existsSync(p1)
            ? p1
            : fs.existsSync(p2)
            ? p2
            : null;
    }

    if (platform === "ios") {
        // MABS keeps config.xml in: platforms/ios/<ProjectName>/config.xml
        const iosFolder = path.join(root, "platforms", "ios");
        const dirs = fs
            .readdirSync(iosFolder)
            .filter((d) =>
                fs.existsSync(path.join(iosFolder, d, "config.xml"))
            );

        if (dirs.length) {
            configPath = path.join(iosFolder, dirs[0], "config.xml");
        }
    }

    if (!configPath) {
        console.log("⚠ config.xml not found. Skip hook.");
        return;
    }

    console.log("✓ Using config.xml:", configPath);

    //
    // 2. Read CDN_ASSETS from plugin preference
    //
    const config = getConfigParser(context, configPath);
    const cdnConfigUrl = config.getPreference("CDN_ASSETS");

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
