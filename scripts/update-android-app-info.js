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

    // --------- AndroidManifest.xml (package, versionName, versionCode) ---------
    if (fs.existsSync(manifestPath)) {
        const manifestXml = fs.readFileSync(manifestPath, 'utf-8');
        parser.parseString(manifestXml, (err, data) => {
            if (err) return;
            if (data.manifest && data.manifest.$) {
                if (packageName) {
                    console.log('➡ Setting Package Name: ', packageName);
                    data.manifest.$.package = packageName;
                }
                if (appVersion) {
                    console.log('➡ Setting Version Name: ', appVersion);
                    data.manifest.$['android:versionName'] = appVersion;
                }
                if (appVersionCode) {
                    console.log('➡ Setting Version Code: ', appVersionCode);
                    data.manifest.$['android:versionCode'] = appVersionCode;
                }
                fs.writeFileSync(manifestPath, builder.buildObject(data));
            }
        });
    }

    // --------- build.gradle (applicationId) ---------
    if (fs.existsSync(buildGradlePath) && packageName) {
        let gradleText = fs.readFileSync(buildGradlePath, 'utf-8');
        gradleText = gradleText.replace(/applicationId\s+"[^"]+"/, `applicationId "${packageName}"`);
        fs.writeFileSync(buildGradlePath, gradleText);
        console.log('➡ build.gradle updated with applicationId');
    }

    console.log('✅ Android app info updated');
};
