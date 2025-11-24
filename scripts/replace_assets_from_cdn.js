#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

module.exports = function(context) {
    const root = context.opts.projectRoot;
    const pluginVars = context.opts.pluginVariables || {};
    const cdnAssetsStr = pluginVars.CDN_ASSETS || "";

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
