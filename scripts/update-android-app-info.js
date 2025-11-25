#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { ConfigParser } = require("cordova-common");
const xml2js = require("xml2js");

module.exports = function (context) {
    const root = context.opts.projectRoot;

    const platforms = ["android", "ios"];

    platforms.forEach((platform) => {
        let configPath = null;

        // fallback: dùng root config.xml nếu platform chưa add
        if (!configPath) {
            configPath = path.join(root, "config.xml");
            console.log("Config Path =", configPath);
            if (!fs.existsSync(configPath)) {
                console.warn(`⚠️ config.xml not found for ${platform}, skipping...`);
                return;
            }
        }

        try {
            const config = new ConfigParser(configPath);

            // ===== 2. Lấy preference =====
            const packageName = config.getPreference("packageName");
            const appVersion = config.getPreference("appVersion");
            const appVersionCode = config.getPreference("appVersionCode");
            const appName = config.getPreference("appName");

            // ===== 3. Update widget attributes =====
            if (packageName) {
                console.log("Input packageName =", packageName);
                config.setPackageName(packageName);
            }
            if (appVersion) {
                console.log("Input version =", appVersion);
                config.setVersion(appVersion);
            }

            // ===== 4. Ghi config =====
            config.write();

            console.log(`✔ ${platform} versioning updated:`);
            console.log("   packageName =", config.packageName());
            console.log("   version =", config.version());
            console.log("   android-versionCode =", config.getAttribute("android-versionCode"));
            console.log("   ios-CFBundleVersion =", config.getAttribute("ios-CFBundleVersion"));

        } catch (err) {
            console.error(`❌ Error updating ${platform} config.xml:`, err);
        }
    });
};
