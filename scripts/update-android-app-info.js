#!/usr/bin/env node

const fs = require('fs');
const path = require("path");
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const { getConfigParser } = require('./utils');
const builder = new xml2js.Builder({
    xmldec: {
        version: '1.0',
        encoding: 'UTF-8'
    }
});

module.exports = function (context) {
    if (!context.opts.platforms.includes('android')) return;

    console.log('🔧 Updating Android app info');

    const projectRoot = context.opts.projectRoot;
    const usesNewStructure = fs.existsSync(path.join(projectRoot, 'platforms', 'android', 'app'));
    const basePath = usesNewStructure
        ? path.join(projectRoot, 'platforms', 'android', 'app', 'src', 'main')
        : path.join(projectRoot, 'platforms', 'android');

    const configPath = path.join(basePath, 'res', 'xml', 'config.xml');
    const stringsPath = path.join(basePath, 'res', 'values', 'strings.xml');
    const manifestPath = path.join(basePath, 'AndroidManifest.xml');
    const buildGradlePath = path.join(projectRoot, 'platforms', 'android', 'app', 'build.gradle');

    // kiểm tra config.xml
    try {
        fs.accessSync(configPath, fs.F_OK);
    } catch (e) {
        console.error(`⚠ Could not find Android config.xml at ${configPath}`);
        return;
    }

    const config = getConfigParser(context, configPath);
    const appName = config.getPreference("appName");
    const packageName = config.getPreference("packageName");
    const appVersion = config.getPreference("appVersion");
    const appVersionCode = config.getPreference("appVersionCode");

    // --------- strings.xml (app_name) ---------
    if (appName && fs.existsSync(stringsPath)) {
        const stringsXml = fs.readFileSync(stringsPath, 'utf-8');
        parser.parseString(stringsXml, (err, data) => {
            if (err) return;
            data.resources.string.forEach(str => {
                if (str.$.name === 'app_name') {
                    console.log('➡ Setting App Name:', appName);
                    str._ = appName;
                }
            });
            fs.writeFileSync(stringsPath, builder.buildObject(data));
        });
    }

    // --------- Update build.gradle (namespace / version / versionCode) --------- 
    if (fs.existsSync(buildGradlePath)) {
        let gradle = fs.readFileSync(buildGradlePath, 'utf8');

        // Update namespace / package
        if (packageName) {
            config.setPackageName(packageName);
            console.log('✅ Updated namespace in build.gradle');
        }

        // Update versionName
        if (appVersion) {
            if (gradle.match(/versionName\s+"[^"]*"/)) {
                gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${appVersion}"`);
            } else {
                gradle = gradle.replace(/android\s*{/, `android {\n    defaultConfig {\n        versionName "${appVersion}"\n    }`);
            }
            console.log('✅ Updated versionName in build.gradle');
        }

        // Update versionCode
        if (appVersionCode) {
            let numericCode = parseInt(appVersionCode, 10);
            if (isNaN(numericCode)) {
                console.warn(`⚠ Invalid APP_VERSION_CODE ('${appVersionCode}'), fallback to 1`);
                numericCode = 1;
            }
            if (gradle.match(/versionCode\s+\d+/)) {
                gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${numericCode}`);
            } else {
                gradle = gradle.replace(/android\s*{/, `android {\n    defaultConfig {\n        versionCode ${numericCode}\n    }`);
            }
            console.log('✅ Updated versionCode in build.gradle');
        }

        fs.writeFileSync(buildGradlePath, gradle, 'utf8');
    }

    console.log('✅ Android app info update completed.');
};
