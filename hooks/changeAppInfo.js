#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getConfigParser } = require("./utils");

/**
 * Get preferences from root config.xml
 */
function getPreferences(context) {
  const root = context.opts.projectRoot;
  const rootConfigPath = path.join(root, "config.xml");
  
  if (!fs.existsSync(rootConfigPath)) {
    console.log("⚠ Root config.xml not found");
    return {};
  }

  try {
    const config = getConfigParser(context, rootConfigPath);
    
    // Get preferences (works with global preferences in OutSystems)
    // REMOVED: PACKAGE_NAME to avoid iOS provisioning profile conflicts
    const appName = config.getPreference("APP_NAME") || "";
    const versionNumber = config.getPreference("VERSION_NUMBER") || "";
    const versionCode = config.getPreference("VERSION_CODE") || "";
    
    // Validate VERSION_CODE and VERSION_NUMBER must exist together
    const hasVersionNumber = versionNumber.trim() !== "";
    const hasVersionCode = versionCode.trim() !== "";
    
    if (hasVersionNumber !== hasVersionCode) {
      console.log("⚠️ VERSION_NUMBER và VERSION_CODE phải tồn tại cùng nhau!");
      console.log(`   VERSION_NUMBER: ${versionNumber ? `'${versionNumber}'` : 'không có'}`);
      console.log(`   VERSION_CODE: ${versionCode ? `'${versionCode}'` : 'không có'}`);
      return {
        appName: appName.trim() !== "" ? appName : null,
        versionNumber: null,
        versionCode: null
      };
    }
    
    return {
      appName: appName.trim() !== "" ? appName : null,
      versionNumber: hasVersionNumber ? versionNumber : null,
      versionCode: hasVersionCode ? versionCode : null
    };
  } catch (err) {
    console.log("⚠ Could not read config.xml:", err.message);
    return {};
  }
}

/**
 * Create strings.xml if it doesn't exist
 */
function ensureStringsXml(stringsPath, appName) {
  const valuesDir = path.dirname(stringsPath);
  
  // Ensure values directory exists
  if (!fs.existsSync(valuesDir)) {
    console.log(`   📁 Creating values directory: ${valuesDir}`);
    fs.mkdirSync(valuesDir, { recursive: true });
  }
  
  // Create strings.xml with app_name
  const stringsContent = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${appName}</string>
</resources>
`;
  
  fs.writeFileSync(stringsPath, stringsContent, "utf8");
  console.log(`   ✅ Created strings.xml with app_name: ${appName}`);
}

/**
 * Update Android app info
 */
function updateAndroidAppInfo(root, prefs) {
  const { appName, versionNumber, versionCode } = prefs;

  console.log(`📝 App Name: ${appName || 'không thay đổi'}`);
  console.log(`🔢 Version: ${versionNumber || 'không thay đổi'} (${versionCode || 'không thay đổi'})`);  // Update strings.xml - only if appName is set
  if (appName) {
    const stringsPath = path.join(
      root,
      "platforms/android/app/src/main/res/values/strings.xml"
    );

    console.log(`   🔍 Checking strings.xml: ${stringsPath}`);
    
    if (fs.existsSync(stringsPath)) {
      try {
        let content = fs.readFileSync(stringsPath, "utf8");
        console.log(`   📄 Found existing strings.xml (${content.length} bytes)`);
        
        // Remove ALL existing app_name entries to prevent duplicates
        content = content.replace(/<string name="app_name">.*?<\/string>\s*/g, '');
        
        // Add new app_name before closing </resources> tag
        content = content.replace(
          "</resources>",
          `    <string name="app_name">${appName}</string>\n</resources>`
        );

        fs.writeFileSync(stringsPath, content, "utf8");
        console.log(`   ✅ Updated app_name in existing strings.xml`);
      } catch (err) {
        console.error("   ✖ Failed to update strings.xml:", err.message);
      }
    } else {
      // CREATE strings.xml if missing (OutSystems MABS case)
      console.log(`   ⚠️  strings.xml not found - creating new file`);
      try {
        ensureStringsXml(stringsPath, appName);
      } catch (err) {
        console.error("   ✖ Failed to create strings.xml:", err.message);
      }
    }
  }

  // Update AndroidManifest.xml - only version info
  const needManifestUpdate = versionNumber || versionCode;
  if (needManifestUpdate) {
    const manifestPath = path.join(
      root,
      "platforms/android/app/src/main/AndroidManifest.xml"
    );

    if (fs.existsSync(manifestPath)) {
      try {
        let content = fs.readFileSync(manifestPath, "utf8");
        
        if (versionNumber) {
          content = content.replace(
            /android:versionName="[^"]*"/,
            `android:versionName="${versionNumber}"`
          );
        }
        
        if (versionCode) {
          content = content.replace(
            /android:versionCode="[^"]*"/,
            `android:versionCode="${versionCode}"`
          );
        }

        fs.writeFileSync(manifestPath, content, "utf8");
        console.log(`   ✅ Android manifest updated`);
      } catch (err) {
        console.error("   ✖ Failed to update AndroidManifest.xml:", err.message);
      }
    }
  }
}

/**
 * Update iOS app info
 * 
 * FIX: Ensure CFBundleName is CREATED if missing (not just updated)
 * This prevents old process name from appearing in app switcher
 */
function updateIOSAppInfo(root, appFolderName, prefs) {
  const { appName, versionNumber, versionCode } = prefs;

  console.log(`📝 App Name: ${appName || 'không thay đổi'}`);
  console.log(`🔢 Version: ${versionNumber || 'không thay đổi'} (${versionCode || 'không thay đổi'})`);  const plistPath = path.join(
    root,
    "platforms/ios",
    appFolderName,
    `${appFolderName}-Info.plist`
  );

  if (!fs.existsSync(plistPath)) {
    console.log("⚠ Info.plist not found:", plistPath);
    return false;
  }

  try {
    let content = fs.readFileSync(plistPath, "utf8");
    let modified = false;
    
    // ✅ FIX #1: Update/Create CFBundleDisplayName AND CFBundleName together
    // This ensures process name & display name are synchronized
    if (appName) {
      const finalAppName = appName.trim();
      
      // ────── Update or create CFBundleDisplayName ──────
      console.log('   🔄 Processing CFBundleDisplayName (Home Screen)...');
      const displayNameRegex = /<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/;
      if (displayNameRegex.test(content)) {
        // UPDATE existing
        content = content.replace(
          displayNameRegex,
          `<key>CFBundleDisplayName</key>\n\t<string>${finalAppName}</string>`
        );
        console.log('   ✅ Updated CFBundleDisplayName');
        modified = true;
      } else {
        // CREATE new if missing
        content = content.replace(
          /<\/dict>\s*<\/plist>/,
          `\t<key>CFBundleDisplayName</key>\n\t<string>${finalAppName}</string>\n</dict>\n</plist>`
        );
        console.log('   ✅ Created CFBundleDisplayName');
        modified = true;
      }
      
      // ────── Update or create CFBundleName (PROCESS NAME) ──────
      // THIS IS THE KEY FIX - CFBundleName was only being UPDATED, never CREATED
      // If missing, iOS uses cache from previous build → old process name appears!
      console.log('   🔄 Processing CFBundleName (Process Name)...');
      const bundleNameRegex = /<key>CFBundleName<\/key>\s*<string>.*?<\/string>/;
      if (bundleNameRegex.test(content)) {
        // UPDATE existing
        content = content.replace(
          bundleNameRegex,
          `<key>CFBundleName</key>\n\t<string>${finalAppName}</string>`
        );
        console.log('   ✅ Updated CFBundleName (Process Name)');
        modified = true;
      } else {
        // CREATE new (THIS WAS THE BUG - THIS CODE WAS MISSING!)
        // Without this, old process name from cache appears in app switcher
        content = content.replace(
          /<\/dict>\s*<\/plist>/,
          `\t<key>CFBundleName</key>\n\t<string>${finalAppName}</string>\n</dict>\n</plist>`
        );
        console.log('   ✅ Created CFBundleName (Process Name) - FIX APPLIED!');
        modified = true;
      }
    }

    // Update CFBundleShortVersionString (Version Number) - only if set
    if (versionNumber) {
      console.log('   🔄 Processing CFBundleShortVersionString (Version)...');
      const versionRegex = /<key>CFBundleShortVersionString<\/key>\s*<string>.*?<\/string>/;
      if (versionRegex.test(content)) {
        content = content.replace(
          versionRegex,
          `<key>CFBundleShortVersionString</key>\n\t<string>${versionNumber}</string>`
        );
        console.log('   ✅ Updated CFBundleShortVersionString');
        modified = true;
      }
    }

    // Update CFBundleVersion (Build Number) - only if set
    if (versionCode) {
      console.log('   🔄 Processing CFBundleVersion (Build Number)...');
      const buildRegex = /<key>CFBundleVersion<\/key>\s*<string>.*?<\/string>/;
      if (buildRegex.test(content)) {
        content = content.replace(
          buildRegex,
          `<key>CFBundleVersion</key>\n\t<string>${versionCode}</string>`
        );
        console.log('   ✅ Updated CFBundleVersion');
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(plistPath, content, "utf8");
      console.log(`✅ iOS Info.plist updated successfully`);
    } else {
      console.log(`ℹ️  No changes needed for iOS Info.plist`);
    }
    
    return true;
  } catch (err) {
    console.error("✖ Failed to update iOS Info.plist:", err.message);
    return false;
  }
}

/**
 * Main hook
 */
module.exports = function(context) {
  const root = context.opts.projectRoot;
  const platforms = context.opts.platforms;

  console.log("\n══════════════════════════════════");
  console.log("       CHANGE APP INFO HOOK        ");
  console.log("══════════════════════════════════");
  console.log("🆕 NEW: Auto-create strings.xml if missing");
  console.log("✅ Works with OutSystems MABS");
  console.log("⚠️ Note: PACKAGE_NAME feature removed to avoid iOS provisioning profile conflicts");

  // Get preferences from root config
  const prefs = getPreferences(context);

  for (const platform of platforms) {
    console.log(`\n📱 Processing platform: ${platform}`);

    try {
      if (platform === "android") {
        updateAndroidAppInfo(root, prefs);
      } 
      else if (platform === "ios") {
        const platformPath = path.join(root, "platforms/ios");
        
        if (!fs.existsSync(platformPath)) {
          console.log("⚠ iOS platform folder not found.");
          continue;
        }

        // Find app folder
        const iosFolders = fs.readdirSync(platformPath).filter(f => {
          const fullPath = path.join(platformPath, f);
          return (
            fs.statSync(fullPath).isDirectory() &&
            f !== "CordovaLib" &&
            f !== "www" &&
            f !== "cordova" &&
            f !== "build"
          );
        });

        if (!iosFolders.length) {
          console.log("⚠ No iOS app folder found.");
          continue;
        }

        const appFolderName = iosFolders[0];
        console.log(`ℹ️ iOS app folder: ${appFolderName}`);
        
        updateIOSAppInfo(root, appFolderName, prefs);
        // REMOVED: updateIOSProject - no longer changing bundle ID
      }
    } catch (err) {
      console.error(`✖ Failed to update app info for ${platform}:`, err);
      console.error(err.stack);
    }
  }

  console.log("\n══════════════════════════════════");
  console.log("✅ App info update completed!");
  console.log("══════════════════════════════════\n");
};