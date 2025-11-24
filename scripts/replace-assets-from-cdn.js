#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const semver = require('semver');
const { URL } = require('url');

function getConfigParser(context, config) {
    let ConfigParser;
    if (semver.lt(context.opts.cordova.version, '5.4.0')) {
        ConfigParser = context.requireCordovaModule('cordova-lib/src/ConfigParser/ConfigParser');
    } else {
        ConfigParser = context.requireCordovaModule('cordova-common/src/ConfigParser/ConfigParser');
    }
    return new ConfigParser(config);
}

// Hàm download file từ URL và ghi đè local
function downloadAndReplaceFile(urlStr, localPath) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(urlStr);
            https.get(url, (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to download ${urlStr}, status: ${res.statusCode}`));
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    fs.writeFileSync(localPath, data, 'utf8');
                    console.log(`✔ Replaced ${localPath} from CDN`);
                    resolve();
                });
            }).on('error', err => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = async function(context) {
    try {
        const root = context.opts.projectRoot;
        const platform = context.opts.platforms[0];

        let configPath;
        let platformName = platform.toLowerCase();

        if (platformName === 'android') {
            const basePath = path.join(root, 'platforms', 'android');
            configPath = path.join(basePath, 'res', 'xml', 'config.xml');
        } else if (platformName === 'ios') {
            const PLATFORMPATH = path.join(root, 'platforms', 'ios');
            const targetDirs = fs.readdirSync(PLATFORMPATH).filter(f =>
                fs.statSync(path.join(PLATFORMPATH, f)).isDirectory()
            );
            const PROJECTNAME = targetDirs[0]; // giả định chỉ 1 project iOS
            configPath = path.join(PLATFORMPATH, PROJECTNAME, 'config.xml');
        } else {
            console.log(`ℹ Platform ${platformName} not supported by this hook`);
            return;
        }

        if (!fs.existsSync(configPath)) {
            console.warn(`⚠ Config file not found at ${configPath}`);
            return;
        }

        const config = getConfigParser(context, configPath);
        const cdnConfigUrl = config.getPreference('CDN_ASSETS');

        if (!cdnConfigUrl) {
            console.log('ℹ No CDN_ASSETS URL provided, skipping replacement.');
            return;
        }

        console.log('📥 Downloading CDN config JSON from:', cdnConfigUrl);

        // Download JSON config từ CDN
        https.get(cdnConfigUrl, (res) => {
            if (res.statusCode !== 200) {
                console.error(`⚠ Failed to download CDN config: ${res.statusCode}`);
                process.exit(1);
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                let assets = [];
                try {
                    assets = JSON.parse(data);
                } catch (err) {
                    console.error('⚠ Failed to parse CDN JSON config', err);
                    process.exit(1);
                }

                // Download và replace từng file
                for (const { localFile, cdn } of assets) {
                    const absPath = path.join(root, localFile);
                    if (!fs.existsSync(absPath)) {
                        console.warn(`⚠ Local file not found: ${absPath}`);
                        continue;
                    }
                    try {
                        await downloadAndReplaceFile(cdn, absPath);
                    } catch (err) {
                        console.error(`⚠ Error replacing ${localFile}:`, err);
                        process.exit(1);
                    }
                }
            });
        }).on('error', err => {
            console.error('⚠ Failed to download CDN config', err);
            process.exit(1);
        });

    } catch (err) {
        console.error('⚠ Unexpected error in replace-assets-from-cdn hook:', err);
        process.exit(1); // exit code number, không phải string
    }
};
