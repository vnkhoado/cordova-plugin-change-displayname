#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

module.exports = function(context) {
    const root = context.opts.projectRoot;
    const pluginVars = context.opts.pluginVariables || {};
    // Lấy giá trị CDN_ASSETS
    const cdnAssetsStr = config.getPreference('CDN_ASSETS');
    console.log('CDN_ASSETS:', cdnAssetsStr);

    if (!cdnAssetsStr) {
        console.log("ℹ No CDN_ASSETS provided, skipping replacement.");
        return;
    }

    let assets = [];
    try {
        assets = JSON.parse(cdnAssetsStr);
    } catch (e) {
        console.error("⚠ Failed to parse CDN_ASSETS JSON", e);
        return;
    }

    function downloadAndReplace(localFile, cdnUrl) {
        const absPath = path.join(root, localFile);
        if (!fs.existsSync(absPath)) {
            console.warn(`⚠ Local file not found: ${absPath}`);
            return;
        }

        https.get(cdnUrl, res => {
            if (res.statusCode !== 200) {
                console.error(`⚠ Failed to download ${cdnUrl}: ${res.statusCode}`);
                return;
            }

            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                fs.writeFileSync(absPath, data, "utf8");
                console.log(`✔ Replaced content of ${localFile} with CDN`);
            });
        }).on("error", err => console.error(`⚠ Error downloading ${cdnUrl}:`, err));
    }

    assets.forEach(asset => downloadAndReplace(asset.localFile, asset.cdn));
};

function getConfigParser(context, config) {

    if (semver.lt(context.opts.cordova.version, '5.4.0')) {
        ConfigParser = context.requireCordovaModule('cordova-lib/src/ConfigParser/ConfigParser');
    } else {
        ConfigParser = context.requireCordovaModule('cordova-common/src/ConfigParser/ConfigParser');
    }

    return new ConfigParser(config);
}
