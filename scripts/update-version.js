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

            // Lấy giá trị plugin variables từ config.xml preference
            const preferences = widget.preference || [];
            let versionNumber, versionCode;
            preferences.forEach(pref => {
                switch(pref.$.name){
                    case "VERSION_NUMBER": versionNumber = pref.$.value; break;
                    case "VERSION_CODE": versionCode = pref.$.value; break;
                }
            });

            // Ghi vào widget
            if(versionNumber) widgetAttrs.version = versionNumber;
            if(versionCode){
                widgetAttrs['android-versionCode'] = versionCode;
                widgetAttrs['ios-CFBundleVersion'] = versionCode;
            }

            const builder = new xml2js.Builder();
            fs.writeFile(configXmlPath, builder.buildObject(result), (err)=>{
                if(err) return reject(err);
                console.log(`[ChangeAppInfo] version=${versionNumber}, versionCode=${versionCode}`);
                resolve();
            });
        });
    });
};
