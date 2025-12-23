#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const utils = require('./utils');

module.exports = function(context) {
    console.log('\n🎨 [INDEX-CSS] Injecting background color into index.html...\n');
    
    // Lấy background color từ preferences qua utils
    const bgColor = utils.getBackgroundColorPreference(context);
    
    if (!bgColor) {
        console.log('⚠️  No background color preference found, skipping index.html injection');
        return;
    }
    
    console.log(`📌 Using background color: ${bgColor}`);
    
    // Đường dẫn tới index.html sau khi prepare
    const platforms = ['android', 'ios'];
    
    platforms.forEach(platform => {
        let indexPath;
        
        if (platform === 'android') {
            indexPath = path.join(context.opts.projectRoot, 'platforms', platform, 'app', 'src', 'main', 'assets', 'www', 'index.html');
        } else if (platform === 'ios') {
            indexPath = path.join(context.opts.projectRoot, 'platforms', platform, 'www', 'index.html');
        }
        
        // Kiểm tra file tồn tại
        if (!fs.existsSync(indexPath)) {
            console.log(`ℹ️  index.html not found for ${platform}, skipping`);
            return;
        }
        
        try {
            let html = fs.readFileSync(indexPath, 'utf8');
            
            // CSS để inject
            const cssToInject = `
    <style id="cordova-plugin-webview-bg">
        html, body {
            background-color: ${bgColor} !important;
            margin: 0;
            padding: 0;
        }
    </style>`;
            
            // Kiểm tra đã inject chưa (tránh duplicate)
            if (html.includes('id="cordova-plugin-webview-bg"')) {
                console.log(`ℹ️  Background CSS already injected in ${platform} index.html`);
                return;
            }
            
            // Inject CSS trước thẻ đóng </head>
            if (html.includes('</head>')) {
                html = html.replace('</head>', cssToInject + '\n</head>');
                fs.writeFileSync(indexPath, html, 'utf8');
                console.log(`✅ Successfully injected background color into ${platform} index.html`);
            } else {
                console.warn(`⚠️  Could not find </head> tag in ${platform} index.html`);
            }
            
        } catch (error) {
            console.error(`❌ Error injecting CSS into ${platform} index.html:`, error.message);
        }
    });
    
    console.log('\n✨ Index.html CSS injection completed\n');
};
