#!/usr/bin/env node

const fs = require('fs');
const plist = require('plist');
const path = require("path");
const { getConfigParser } = require('./utils');

module.exports = function (context) {

    if (!context.opts.platforms.includes('ios')) return;

    console.log('🔧 Updating iOS app info');

    const PROJECTROOT = context.opts.projectRoot;
    const PLATFORMPATH = path.resolve(path.join(PROJECTROOT, 'platforms', 'ios'));
    const EXTENSION = '.xcodeproj';

    // tìm file .xcodeproj
    const files = fs.readdirSync(PLATFORMPATH);
    const targetFiles = files.filter(file => path.extname(file).toLowerCase() === EXTENSION);

    if (!targetFiles || targetFiles.length !== 1) {
        console.warn("❌ Could not find exactly one .xcodeproj file. Exiting.");
        return;
    }

    const PROJECTNAME = path.basename(targetFiles[0], EXTENSION);
    const INFOPLISTPATH = path.join(PLATFORMPATH, PROJECTNAME, `${PROJECTNAME}-Info.plist`);
    const CONFIGPATH = path.join(PLATFORMPATH, PROJECTNAME, 'config.xml');

    if (!fs.existsSync(INFOPLISTPATH)) {
        console.warn(`❌ Info.plist not found at ${INFOPLISTPATH}`);
        return;
    }

    const config = getConfigParser(context, CONFIGPATH);

    const appName = config.getPreference('appName');           // App Name
    const bundleId = config.getPreference('packageName');      // CFBundleIdentifier
    const appVersion = config.getPreference('appVersion');     // CFBundleShortVersionString
    const buildNumber = config.getPreference('appVersionCode');// CFBundleVersion

    console.log('📌 Config values from config.xml:');
    console.log('  App Name           :', appName);
    console.log('  Package Name       :', bundleId);
    console.log('  App Version        :', appVersion);
    console.log('  Build Number       :', buildNumber);
    console.log('  CDN Assets         :', cdnAssets);

    // đọc plist
    const xml = fs.readFileSync(INFOPLISTPATH, 'utf8');
    const obj = plist.parse(xml);

    // cập nhật thông tin
    if (appName) {
        console.log('➡ Setting CFBundleDisplayName:', appName);
        obj.CFBundleDisplayName = appName;
        // tùy chọn: đảm bảo CFBundleExecutable hợp lệ
        obj.CFBundleExecutable = appName.replace(/[/\\?%*:|"<>\+]/g, '');
    }

    if (bundleId) {
        console.log('➡ Setting CFBundleIdentifier:', bundleId);
        obj.CFBundleIdentifier = bundleId;
    }

    if (appVersion) {
        console.log('➡ Setting CFBundleShortVersionString:', appVersion);
        obj.CFBundleShortVersionString = appVersion;
    }

    if (buildNumber) {
        console.log('➡ Setting CFBundleVersion:', buildNumber);
        obj.CFBundleVersion = buildNumber;
    }

    // ghi lại plist
    fs.writeFileSync(INFOPLISTPATH, plist.build(obj), { encoding: 'utf8' });

    console.log('✅ iOS app info updated');
};
