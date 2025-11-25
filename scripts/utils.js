const semver = require('semver');
const fs = require("fs");
const path = require("path");

module.exports = {
    // Kiểm tra Cordova version
    isCordovaAbove: function (context, version) {
        const cordovaVersion = context.opts.cordova.version;
        console.log("Cordova version:", cordovaVersion);
        const sp = cordovaVersion.split('.');
        return parseInt(sp[0]) >= version;
    },

    // Lấy ConfigParser chuẩn cho Cordova cũ/mới
    getConfigParser: function (context, configPath) {
        let ConfigParser;
        if (semver.lt(context.opts.cordova.version, '5.4.0')) {
            // Cordova < 5.4.0
            ConfigParser = context.requireCordovaModule('cordova-lib/src/ConfigParser/ConfigParser');
        } else {
            // Cordova >= 5.4.0
            ConfigParser = context.requireCordovaModule('cordova-common/src/ConfigParser/ConfigParser');
        }
        return new ConfigParser(configPath);
    },

    // Lấy config.xml path cho Android / iOS
    getConfigPath: function (context, platform) {
        const root = context.opts.projectRoot;
        let configPath = null;

        if (platform === "android") {
            const p1 = path.join(root, "platforms/android/app/src/main/res/xml/config.xml");
            const p2 = path.join(root, "platforms/android/res/xml/config.xml");
            configPath = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : null;
        } else if (platform === "ios") {
            const iosFolder = path.join(root, "platforms/ios");
            if (!fs.existsSync(iosFolder)) return null;
            const dirs = fs.readdirSync(iosFolder).filter(d =>
                fs.existsSync(path.join(iosFolder, d, "config.xml"))
            );
            if (dirs.length) {
                configPath = path.join(iosFolder, dirs[0], "config.xml");
            }
        }

        return configPath;
    }
};
