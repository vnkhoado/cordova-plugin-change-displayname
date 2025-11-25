#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

module.exports = function(context) {
    return new Promise((resolve, reject) => {
        const configXmlPath = path.join(context.opts.projectRoot, 'config.xml');
        if (!fs.existsSync(configXmlPath)) return reject('config.xml not found');

        const xml = fs.readFileSync(configXmlPath, 'utf-8');

        xml2js.parseString(xml, (err, result) => {
            if (err) return reject(err);

            const widget = result.widget;
            const widgetAttrs = widget.$;

            // Lấy từ biến môi trường hoặc plugin riêng
            const versionNumber = process.env.VERSION_NUMBER || '1.0.0';
            const versionCode = process.env.VERSION_CODE || '1';

            widgetAttrs.version = versionNumber;
            widgetAttrs['android-versionCode'] = versionCode;
            widgetAttrs['ios-CFBundleVersion'] = versionCode;

            const builder = new xml2js.Builder();
            fs.writeFile(configXmlPath, builder.buildObject(result), (err) => {
                if (err) return reject(err);
                console.log(`[VersionHook] version=${versionNumber}, versionCode=${versionCode}`);
                resolve();
            });
        });
    });
};
