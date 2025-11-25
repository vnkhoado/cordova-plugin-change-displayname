#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

module.exports = function(context) {
    const rootDir = context.opts.projectRoot;
    const configXmlPath = path.join(rootDir, 'config.xml');

    if (!fs.existsSync(configXmlPath)) {
        console.error('config.xml not found!');
        return;
    }

    const xml = fs.readFileSync(configXmlPath, 'utf-8');
    xml2js.parseString(xml, (err, result) => {
        if (err) throw err;

        // Thay đổi version và versionCode
        const newVersion = "1.2.3";
        const newVersionCode = "123";

        if (result.widget.$) {
            result.widget.$.version = newVersion;
            result.widget.$['android-versionCode'] = newVersionCode;
        }

        const builder = new xml2js.Builder();
        const updatedXml = builder.buildObject(result);

        fs.writeFileSync(configXmlPath, updatedXml);
        console.log(`Updated version to ${newVersion} and versionCode to ${newVersionCode}`);
    });
};
