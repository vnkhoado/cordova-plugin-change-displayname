const semver = require('semver');

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
    }
};
