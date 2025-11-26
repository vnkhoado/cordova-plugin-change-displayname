#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getConfigPath, getConfigParser } = require("./utils");

/**
 * Update Android app info
 */
function updateAndroidAppInfo(root, config) {
  const packageName = config.getPreference("PACKAGE_NAME");
  const appName = config.getPreference("APP_NAME");
  const versionNumber = config.getPreference("VERSION_NUMBER");
  const versionCode = config.getPreference("VERSION_CODE");

  console.log(`📦 Package: ${packageName}`);
  console.log(`📝 App Name: ${appName}`);
  console.log(`🔢 Version: ${versionNumber} (${versionCode})`);

  // Update strings.xml
  if (appName) {
    const stringsPath = path.join(
      root,
      "platforms/android/app/src/main/res/values/strings.xml"
    );

    if (fs.existsSync(stringsPath)) {
      try {
        let content = fs.readFileSync(stringsPath, "utf8");
        
        const appNameRegex = /<string name="app_name">.*?<\/string>/;
        if (appNameRegex.test(content)) {
          content = content.replace(
            appNameRegex,
            `<string name="app_name">${appName}</string>`
          );
        } else {
          content = content.replace(
            "</resources>",
            `    <string name="app_name">${appName}</string>\n</resources>`
          );
        }

        fs.writeFileSync(stringsPath, content, "utf8");
        console.log(`✅ Android app name updated`);
      } catch (err) {
        console.error("✖ Failed to update strings.xml:", err.message);
      }
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
function updateIOSAppInfo(root, appFolderName, config) {
  const packageName = config.getPreference("PACKAGE_NAME");
  const appName = config.getPreference("APP_NAME");
  const versionNumber = config.getPreference("VERSION_NUMBER");
  const versionCode = config.getPreference("VERSION_CODE");

  console.log(`📦 Bundle ID: ${packageName}`);
  console.log(`📝 App Name: ${appName}`);
  console.log(`🔢 Version: ${versionNumber} (${versionCode})`);

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
function updateIOSProject(root, appFolderName, config) {
  const packageName = config.getPreference("PACKAGE_NAME");
  
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

  for (const platform of platforms) {
    console.log(`\n📱 Processing platform: ${platform}`);
    
    const configPath = getConfigPath(context, platform);
    if (!configPath) {
      console.log(`⚠ config.xml not found for ${platform}. Skip.`);
      continue;
    }

    const config = getConfigParser(context, configPath);

    try {
      if (platform === "android") {
        updateAndroidAppInfo(root, config);
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
        
        updateIOSAppInfo(root, appFolderName, config);
        updateIOSProject(root, appFolderName, config);
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