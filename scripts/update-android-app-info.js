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

        // ===== 1. Tìm config.xml =====
        if (platform === "android") {
            const p1 = path.join(root, "platforms", "android", "app/src/main/res/xml/config.xml");
            const p2 = path.join(root, "platforms", "android", "res/xml/config.xml");
            configPath = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : null;
        } else if (platform === "ios") {
            const iosFolder = path.join(root, "platforms", "ios");
            if (fs.existsSync(iosFolder)) {
                const dirs = fs
                    .readdirSync(iosFolder)
                    .filter((d) => fs.existsSync(path.join(iosFolder, d, "config.xml")));
                if (dirs.length) {
                    configPath = path.join(iosFolder, dirs[0], "config.xml");
                }
            }
        }

        // fallback: dùng root config.xml nếu platform chưa add
        if (!configPath) {
            configPath = path.join(root, "config.xml");
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
            if (packageName) config.setPackageName(packageName);
            if (appVersion) config.setVersion(appVersion);
            if (appVersionCode) {
                if (platform === "android") config.setAttribute("android-versionCode", appVersionCode);
                if (platform === "ios") config.setAttribute("ios-CFBundleVersion", appVersionCode);
            }

            // ===== 4. Update <name> =====
            if (appName) {
                const xml = fs.readFileSync(configPath, "utf8");
                xml2js.parseString(xml, (err, result) => {
                    if (err) throw err;
                    result.widget.name = [appName];
                    const builder = new xml2js.Builder();
                    const updatedXml = builder.buildObject(result);
                    fs.writeFileSync(configPath, updatedXml, "utf8");
                });
            }

            // ===== 5. Ghi config =====
            config.write();

            console.log(`✔ ${platform} versioning updated:`);
            console.log("   packageName =", config.packageName());
            console.log("   version =", config.version());
            console.log("   android-versionCode =", config.getAttribute("android-versionCode"));
            console.log("   ios-CFBundleVersion =", config.getAttribute("ios-CFBundleVersion"));
            if (appName) console.log("   appName =", appName);

        } catch (err) {
            console.error(`❌ Error updating ${platform} config.xml:`, err);
        }
    });
};
