const fs = require('fs');
const path = require('path');
const { DOMParser, XMLSerializer } = require('xmldom');

const BACKGROUND_COLOR = '#001833';

module.exports = function(context) {
    console.log('🔧 FIX RED FLASH AFTER SPLASH SCREEN (Enhanced)');
    console.log('🎨 Background color:', BACKGROUND_COLOR);
    console.log('📂 Project root:', context.opts.projectRoot);

    const platformRoot = path.join(context.opts.projectRoot, 'platforms', 'android');

    // ============================================
    // SOLUTION 1: Patch MainActivity.java
    // ============================================
    console.log('\n🔧 SOLUTION 1: Patch MainActivity.java');
    console.log('   Set window background BEFORE super.onCreate()');
    
    const mainActivitySearchPaths = [
        path.join(platformRoot, 'app', 'src', 'main', 'java'),
        path.join(platformRoot, 'src')
    ];

    let mainActivityPath = null;
    
    for (const searchPath of mainActivitySearchPaths) {
        console.log('   🔍 Searching in:', searchPath);
        
        if (fs.existsSync(searchPath)) {
            const files = findJavaFiles(searchPath, 'MainActivity.java');
            if (files.length > 0) {
                mainActivityPath = files[0];
                console.log('   ✅ Found MainActivity.java at:', mainActivityPath);
                break;
            }
        }
    }

    if (mainActivityPath && fs.existsSync(mainActivityPath)) {
        try {
            console.log('   📄 Reading MainActivity from:', mainActivityPath);
            let content = fs.readFileSync(mainActivityPath, 'utf8');
            
            // Check if already patched
            if (content.includes('FIX_RED_FLASH_ENHANCED')) {
                console.log('   ⏭️  MainActivity already patched (enhanced version)');
            } else {
                // Add imports if not present
                if (!content.includes('import android.graphics.Color;')) {
                    console.log('   📦 Adding Color import...');
                    content = content.replace(
                        /(package [^;]+;)/,
                        '$1\n\nimport android.graphics.Color;'
                    );
                }
                if (!content.includes('import android.graphics.drawable.ColorDrawable;')) {
                    console.log('   📦 Adding ColorDrawable import...');
                    content = content.replace(
                        /(package [^;]+;)/,
                        '$1\nimport android.graphics.drawable.ColorDrawable;'
                    );
                }

                // Find onCreate method and inject BEFORE super.onCreate()
                const onCreateRegex = /(@Override\s+public\s+void\s+onCreate\s*\(Bundle\s+savedInstanceState\)\s*\{)/;
                
                if (onCreateRegex.test(content)) {
                    console.log('   🎯 Found onCreate method, injecting BEFORE super.onCreate()...');
                    
                    const injectionCode = `
    // FIX_RED_FLASH_ENHANCED: Set window background BEFORE super.onCreate()
    // This ensures the background is set before any view is created
    try {
        int bgColor = Color.parseColor("${BACKGROUND_COLOR}");
        getWindow().setBackgroundDrawable(new ColorDrawable(bgColor));
        getWindow().getDecorView().setBackgroundColor(bgColor);
    } catch (Exception e) {
        android.util.Log.e("FixRedFlash", "Failed to set background: " + e.getMessage());
    }
    `;

                    content = content.replace(
                        onCreateRegex,
                        '$1' + injectionCode
                    );
                    
                    fs.writeFileSync(mainActivityPath, content, 'utf8');
                    console.log('   ✅ MainActivity patched successfully!');
                    console.log('   📍 Code injected BEFORE super.onCreate()');
                } else {
                    console.log('   ⚠️  Could not find onCreate method');
                }
            }
        } catch (error) {
            console.error('   ❌ Error patching MainActivity:', error.message);
        }
    } else {
        console.log('   ⚠️  MainActivity.java not found');
    }

    // ============================================
    // SOLUTION 2: Update AndroidManifest.xml
    // ============================================
    console.log('\n🔧 SOLUTION 2: Update AndroidManifest.xml');
    console.log('   Add windowBackground to theme');

    const manifestPath = path.join(platformRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
    
    if (fs.existsSync(manifestPath)) {
        try {
            console.log('   📄 Reading AndroidManifest.xml');
            let manifestContent = fs.readFileSync(manifestPath, 'utf8');
            const parser = new DOMParser();
            const doc = parser.parseFromString(manifestContent, 'text/xml');
            
            // Find the main activity
            const activities = doc.getElementsByTagName('activity');
            let mainActivity = null;
            
            for (let i = 0; i < activities.length; i++) {
                const activity = activities[i];
                const name = activity.getAttribute('android:name');
                if (name && name.includes('MainActivity')) {
                    mainActivity = activity;
                    break;
                }
            }
            
            if (mainActivity) {
                const currentTheme = mainActivity.getAttribute('android:theme');
                console.log('   📋 Current theme:', currentTheme || 'none');
                
                // Get or create theme name
                let themeName = currentTheme;
                if (!themeName) {
                    themeName = '@style/AppTheme.NoActionBar.FullScreen';
                    mainActivity.setAttribute('android:theme', themeName);
                    console.log('   ✅ Set theme to:', themeName);
                }
                
                // Save updated manifest
                const serializer = new XMLSerializer();
                manifestContent = serializer.serializeToString(doc);
                fs.writeFileSync(manifestPath, manifestContent, 'utf8');
                console.log('   ✅ AndroidManifest.xml updated');
                
                // Now update the theme in styles.xml
                updateThemeStyles(platformRoot, themeName);
            } else {
                console.log('   ⚠️  MainActivity not found in manifest');
            }
        } catch (error) {
            console.error('   ❌ Error updating AndroidManifest:', error.message);
        }
    } else {
        console.log('   ⚠️  AndroidManifest.xml not found at:', manifestPath);
    }

    console.log('\n✅ Enhanced red flash fix completed!');
};

function findJavaFiles(dir, filename) {
    let results = [];
    
    if (!fs.existsSync(dir)) {
        return results;
    }
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            results = results.concat(findJavaFiles(filePath, filename));
        } else if (file === filename) {
            results.push(filePath);
        }
    }
    
    return results;
}

function updateThemeStyles(platformRoot, themeName) {
    console.log('\n   🎨 Updating theme styles...');
    
    const stylesPath = path.join(platformRoot, 'app', 'src', 'main', 'res', 'values', 'styles.xml');
    
    if (!fs.existsSync(stylesPath)) {
        console.log('   ⚠️  styles.xml not found');
        return;
    }
    
    try {
        let stylesContent = fs.readFileSync(stylesPath, 'utf8');
        const parser = new DOMParser();
        const doc = parser.parseFromString(stylesContent, 'text/xml');
        
        // Extract style name from theme name (e.g., @style/AppTheme -> AppTheme)
        const styleName = themeName.replace('@style/', '');
        
        // Find or create the style
        const styles = doc.getElementsByTagName('style');
        let targetStyle = null;
        
        for (let i = 0; i < styles.length; i++) {
            const style = styles[i];
            if (style.getAttribute('name') === styleName) {
                targetStyle = style;
                break;
            }
        }
        
        // Check if windowBackground item already exists
        let hasWindowBackground = false;
        if (targetStyle) {
            const items = targetStyle.getElementsByTagName('item');
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.getAttribute('name') === 'android:windowBackground') {
                    hasWindowBackground = true;
                    // Update existing value
                    item.textContent = BACKGROUND_COLOR;
                    console.log('   ✅ Updated existing windowBackground in theme');
                    break;
                }
            }
            
            // Add windowBackground if not exists
            if (!hasWindowBackground) {
                const newItem = doc.createElement('item');
                newItem.setAttribute('name', 'android:windowBackground');
                newItem.textContent = BACKGROUND_COLOR;
                targetStyle.appendChild(newItem);
                console.log('   ✅ Added windowBackground to theme');
            }
            
            // Save updated styles.xml
            const serializer = new XMLSerializer();
            stylesContent = serializer.serializeToString(doc);
            fs.writeFileSync(stylesPath, stylesContent, 'utf8');
            console.log('   ✅ styles.xml updated');
        } else {
            console.log('   ⚠️  Style', styleName, 'not found in styles.xml');
            console.log('   💡 Creating new style...');
            
            // Create new style with windowBackground
            const resources = doc.getElementsByTagName('resources')[0];
            if (resources) {
                const newStyle = doc.createElement('style');
                newStyle.setAttribute('name', styleName);
                newStyle.setAttribute('parent', 'Theme.AppCompat.NoActionBar');
                
                const windowBackgroundItem = doc.createElement('item');
                windowBackgroundItem.setAttribute('name', 'android:windowBackground');
                windowBackgroundItem.textContent = BACKGROUND_COLOR;
                newStyle.appendChild(windowBackgroundItem);
                
                resources.appendChild(newStyle);
                
                const serializer = new XMLSerializer();
                stylesContent = serializer.serializeToString(doc);
                fs.writeFileSync(stylesPath, stylesContent, 'utf8');
                console.log('   ✅ Created new style with windowBackground');
            }
        }
    } catch (error) {
        console.error('   ❌ Error updating styles.xml:', error.message);
    }
}
