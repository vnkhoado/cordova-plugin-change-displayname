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
    
    return {
      packageName: config.getPreference("PACKAGE_NAME"),
      appName: config.getPreference("APP_NAME"),
      versionNumber: config.getPreference("VERSION_NUMBER"),
      versionCode: config.getPreference("VERSION_CODE")
    };
  } catch (err) {
    console.log("⚠ Could not read config.xml:", err.message);
    return {};
  }
}

/**
 * Update Android app info
 */
function updateAndroidAppInfo(root, prefs) {
  const { packageName, appName, versionNumber, versionCode } = prefs;

  console.log(`📦 Package: ${packageName || 'not set'}`);
  console.log(`📝 App Name: ${appName || 'not set'}`);
  console.log(`🔢 Version: ${versionNumber || 'not set'} (${versionCode || 'not set'})`);

  // Update strings.xml
  if (appName) {
    const stringsPath = path.join(
      root,
      "platforms/android/app/src/main/res/values/strings.xml"
    );

    if (fs.existsSync(stringsPath)) {
      try {
        let content = fs.readFileSync(stringsPath, "utf8");
        
        // FIXED: Remove ALL existing app_name entries to prevent duplicates
        content = content.replace(/<string name="app_name">.*?<\/string>\s*/g, '');
        
        // Add new app_name before closing </resources> tag
        content = content.replace(
          "</resources>",
          `    <string name="app_name">${appName}</string>\n</resources>`
        );

        fs.writeFileSync(stringsPath, content, "utf8");
        console.log(`✅ Android app name updated (duplicates removed)`);
      } catch (err) {
        console.error("✖ Failed to update strings.xml:", err.message);
      }
    } else {
      console.log(`⚠ strings.xml not found: ${stringsPath}`);
    }
  }

  // Update AndroidManifest.xml
  if (packageName || versionNumber || versionCode) {
    const manifestPath = path.join(
      root,
      "platforms/android/app/src/main/AndroidManifest.xml"
    );

    if (fs.existsSync(manifestPath)) {
      try {
        let content = fs.readFileSync(manifestPath, "utf8");
        
        if (packageName) {
          content = content.replace(
            /package="[^"]*"/,
            `package="${packageName}"`
          );
        }
        
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
        console.log(`✅ Android manifest updated`);
      } catch (err) {
        console.error("✖ Failed to update AndroidManifest.xml:", err.message);
      }
    }
  }

  // Update build.gradle
  if (packageName) {
    const buildGradlePath = path.join(
      root,
      "platforms/android/app/build.gradle"
    );

    if (fs.existsSync(buildGradlePath)) {
      try {
        let content = fs.readFileSync(buildGradlePath, "utf8");
        
        content = content.replace(
          /applicationId\s+"[^"]*"/,
          `applicationId "${packageName}"`
        );

        fs.writeFileSync(buildGradlePath, content, "utf8");
        console.log(`✅ Android build.gradle updated`);
      } catch (err) {
        console.error("✖ Failed to update build.gradle:", err.message);
      }
    }
  }
}

/**
 * Update iOS app info
 */
function updateIOSAppInfo(root, appFolderName, prefs) {
  const { packageName, appName, versionNumber, versionCode } = prefs;

  console.log(`📦 Bundle ID: ${packageName || 'not set'}`);
  console.log(`📝 App Name: ${appName || 'not set'}`);
  console.log(`🔢 Version: ${versionNumber || 'not set'} (${versionCode || 'not set'})`);

  const plistPath = path.join(
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
    
    // Update CFBundleIdentifier (Package Name)
    if (packageName) {
      const bundleIdRegex = /<key>CFBundleIdentifier<\/key>\s*<string>.*?<\/string>/;
      if (bundleIdRegex.test(content)) {
        content = content.replace(
          bundleIdRegex,
          `<key>CFBundleIdentifier</key>\n\t<string>${packageName}</string>`
        );
      }
    }
    
    // Update CFBundleDisplayName
    if (appName) {
      const displayNameRegex = /<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/;
      if (displayNameRegex.test(content)) {
        content = content.replace(
          displayNameRegex,
          `<key>CFBundleDisplayName</key>\n\t<string>${appName}</string>`
        );
      } else {
        content = content.replace(
          /<\/dict>\s*<\/plist>/,
          `\t<key>CFBundleDisplayName</key>\n\t<string>${appName}</string>\n</dict>\n</plist>`
        );
      }

      // Update CFBundleName
      const bundleNameRegex = /<key>CFBundleName<\/key>\s*<string>.*?<\/string>/;
      if (bundleNameRegex.test(content)) {
        content = content.replace(
          bundleNameRegex,
          `<key>CFBundleName</key>\n\t<string>${appName}</string>`
        );
      }
    }

    // Update CFBundleShortVersionString (Version Number)
    if (versionNumber) {
      const versionRegex = /<key>CFBundleShortVersionString<\/key>\s*<string>.*?<\/string>/;
      if (versionRegex.test(content)) {
        content = content.replace(
          versionRegex,
          `<key>CFBundleShortVersionString</key>\n\t<string>${versionNumber}</string>`
        );
      }
    }

    // Update CFBundleVersion (Build Number)
    if (versionCode) {
      const buildRegex = /<key>CFBundleVersion<\/key>\s*<string>.*?<\/string>/;
      if (buildRegex.test(content)) {
        content = content.replace(
          buildRegex,
          `<key>CFBundleVersion</key>\n\t<string>${versionCode}</string>`
        );
      }
    }

    fs.writeFileSync(plistPath, content, "utf8");
    console.log(`✅ iOS Info.plist updated`);
    return true;
  } catch (err) {
    console.error("✖ Failed to update iOS Info.plist:", err.message);
    return false;
  }
}

/**
 * Update iOS project.pbxproj
 */
function updateIOSProject(root, appFolderName, prefs) {
  const { packageName } = prefs;
  
  if (!packageName) return;

  try {
    const xcode = require("xcode");
    const pbxPath = path.join(
      root,
      "platforms/ios",
      appFolderName + ".xcodeproj",
      "project.pbxproj"
    );

    if (!fs.existsSync(pbxPath)) {
      console.log("⚠ project.pbxproj not found");
      return;
    }

    const proj = xcode.project(pbxPath);
    proj.parseSync();

    // Update PRODUCT_BUNDLE_IDENTIFIER
    const configs = proj.pbxXCBuildConfigurationSection();
    for (const key in configs) {
      if (!key.endsWith('_comment') && configs[key].buildSettings) {
        configs[key].buildSettings.PRODUCT_BUNDLE_IDENTIFIER = packageName;
      }
    }

    fs.writeFileSync(pbxPath, proj.writeSync());
    console.log(`✅ iOS project.pbxproj updated`);
  } catch (err) {
    console.error("⚠ Could not update project.pbxproj:", err.message);
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

  // Get preferences from root config once
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
        console.log(`ℹ iOS app folder: ${appFolderName}`);
        
        updateIOSAppInfo(root, appFolderName, prefs);
        updateIOSProject(root, appFolderName, prefs);
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