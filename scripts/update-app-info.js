const fs = require('fs');
const path = require('path');
const plist = require('plist');
const {
    getConfigParser
} = require('./utils');

module.exports = async function(context) {
    const root = context.opts.projectRoot;
    const platforms = context.opts.platforms || [];
    console.log(JSON.stringify(platforms));

    for (const platform of platforms) {
        let configPath = null;

        // Android
        if (platform === 'android') {
            // Tìm config.xml
            const p1 = path.join(root, 'platforms', 'android', 'app/src/main/res/xml/config.xml');
            const p2 = path.join(root, 'platforms/android/res/xml/config.xml');
            const configPath = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : null;

            // Xác định cấu trúc platform Android mới hay cũ
            const usesNewStructure = fs.existsSync(path.join(root, 'platforms', 'android', 'app'));
            const basePath = usesNewStructure ?
                path.join(root, 'platforms', 'android', 'app', 'src', 'main') :
                path.join(root, 'platforms', 'android');

            // Tìm strings.xml
            const stringsPath = path.join(basePath, 'res', 'values', 'strings.xml');
            var stringsXml, name;
        }

        // iOS
        if (platform === 'ios') {
            const iosFolder = path.join(root, 'platforms/ios');
            if (fs.existsSync(iosFolder)) {
                const dirs = fs.readdirSync(iosFolder).filter(d =>
                    fs.existsSync(path.join(iosFolder, d, 'config.xml'))
                );
                if (dirs.length) configPath = path.join(iosFolder, dirs[0], 'config.xml');
            }
        }

        if (!configPath) continue;

        const config = getConfigParser(context, configPath);
        const appName = config.getPreference('appName');
        const versionNumber = config.getPreference('appVersion');
        const versionCode = config.getPreference('appVersionCode');

        // --- Android ---
        if (platform === 'android') {
            // --- Update App Name ---
            console.log('Attempting to set app name for android');
            if (appName && fs.existsSync(stringsPath)) {
                stringsXml = fs.readFileSync(stringsPath, 'UTF-8');
                parser.parseString(stringsXml, function(err, data) {

                    data.resources.string.forEach(function(string) {

                        if (string.$.name === 'app_name') {

                            console.log('Setting App Name: ', name);
                            string._ = name;
                        }
                    });

                    fs.writeFileSync(stringsPath, builder.buildObject(data));

                });
            }

            // --- Update App Version ---
            const buildGradlePath = path.join(root, 'platforms/android/app/build.gradle');
            if (fs.existsSync(buildGradlePath)) {
                let content = fs.readFileSync(buildGradlePath, 'utf8');
                if (versionCode) content = content.replace(/versionCode\s+\d+/g, `versionCode ${versionCode}`);
                if (versionNumber) content = content.replace(/versionName\s+"[^"]+"/g, `versionName "${versionNumber}"`);
                fs.writeFileSync(buildGradlePath, content, 'utf8');
            }
        }

        // --- iOS ---
        if (platform === 'ios') {
            // --- Update App Name ---
            if (appName) {
                console.log('Attempting to set app name for iOS');

                var PROJECTROOT = context.opts.projectRoot;
                var PLATFORMPATH = path.resolve(path.join(PROJECTROOT, 'platforms', 'ios'));

                var EXTENSION = '.xcodeproj';
                var targetFiles;
                fs.readdir(PLATFORMPATH, function(err, files) {
                    targetFiles = files.filter(function(file) {
                        return path.extname(file).toLowerCase() === EXTENSION;
                    });

                    if (!targetFiles) {
                        console.log("No " + EXTENSION + " file found. Exiting");
                        return;
                    }
                    if (targetFiles.length != 1) {
                        console.log("More than one " + EXTENSION + " found. Exiting");
                        return;
                    }

                    var PROJECTNAME = path.basename(targetFiles[0], EXTENSION);

                    var INFOPLISTPATH = path.join(PLATFORMPATH, PROJECTNAME, PROJECTNAME + '-Info.plist');

                    var xml = fs.readFileSync(INFOPLISTPATH, 'utf8');
                    var obj = plist.parse(xml);

                    /**
                     * FIRST APPROACH
                     * Set the CFBundleDisplayName only, using the variable set via the plugin instalation
                     */
                    obj.CFBundleDisplayName = appName;

                    /**
                     * SECOND APPROACH
                     * Clean the CFBundleExecutable so it does not have any invalid chars
                     */
                    //obj.CFBundleExecutable = obj.CFBundleDisplayName.replace(/[/\\?%*:|"<>\+]/g, '');

                    xml = plist.build(obj);
                    fs.writeFileSync(INFOPLISTPATH, xml, {
                        encoding: 'utf8'
                    });
                });

                // --- Update App Version ---

                console.log('Attempting to set app name for iOS');
                const iosFolder = path.join(root, 'platforms/ios');
                const dirs = fs.readdirSync(iosFolder).filter(d =>
                    fs.existsSync(path.join(iosFolder, d, `${d}-Info.plist`))
                );

                dirs.forEach(d => {
                    const plistPath = path.join(iosFolder, d, `${d}-Info.plist`);
                    const xml = fs.readFileSync(plistPath, 'utf8');
                    const obj = plist.parse(xml);
                    if (versionNumber) obj.CFBundleShortVersionString = versionNumber;
                    if (versionCode) obj.CFBundleVersion = versionCode;
                    fs.writeFileSync(plistPath, plist.build(obj), 'utf8');
                });
            }
        }
    }
};
