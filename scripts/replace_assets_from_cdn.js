#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');
const semver = require('semver');

function getConfigParser(context, config) {
    let ConfigParser;
    if (semver.lt(context.opts.cordova.version, '5.4.0')) {
        ConfigParser = context.requireCordovaModule('cordova-lib/src/ConfigParser/ConfigParser');
    } else {
        ConfigParser = context.requireCordovaModule('cordova-common/src/ConfigParser/ConfigParser');
    }
    return new ConfigParser(config);
}

module.exports = function(context) {
    const root = context.opts.projectRoot;
    const configPath = path.join(root, 'config.xml');
    const config = getConfigParser(context, configPath);
    const cdnConfigUrl = config.getPreference('CDN_ASSETS');

    if (!cdnConfigUrl) {
        console.log('ℹ No CDN_ASSETS URL provided, skipping replacement.');
        return;
    }

    console.log('📥 Downloading CDN config from:', cdnConfigUrl);

    https.get(cdnConfigUrl, res => {
        if (res.statusCode !== 200) {
            console.error(`⚠ Failed to download CDN config: ${res.statusCode}`);
            return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            let assets = [];
            try {
                assets = JSON.parse(data);
            } catch (e) {
                console.error('⚠ Failed to parse CDN JSON config', e);
                return;
            }

            assets.forEach(({localFile, cdn}) => {
                const absPath = path.join(root, localFile);
                if (!fs.existsSync(absPath)) {
                    console.warn(`⚠ Local file not found: ${absPath}`);
                    return;
                }

                console.log(`📥 Replacing ${localFile} from CDN: ${cdn}`);

                https.get(cdn, resFile => {
                    if (resFile.statusCode !== 200) {
                        console.error(`⚠ Failed to download ${cdn}: ${resFile.statusCode}`);
                        return;
                    }

                    let fileData = '';
                    resFile.on('data', chunk => fileData += chunk);
                    resFile.on('end', () => {
                        fs.writeFileSync(absPath, fileData, 'utf8');
                        console.log(`✔ Replaced ${localFile} successfully`);
                    });
                }).on('error', err => console.error(err));
            });
        });
    }).on('error', err => console.error(err));
};
