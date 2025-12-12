#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { getConfigParser } = require("./utils");

/**
 * Đọc backup data
 */
function readBackup(root) {
  const backupFile = path.join(root, ".cordova-build-backup", "app-info-backup.json");
  
  if (!fs.existsSync(backupFile)) {
    console.log("⚠️ Backup file not found");
    return null;
  }
  
  try {
    const data = fs.readFileSync(backupFile, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("❌ Failed to read backup:", err.message);
    return null;
  }
}

/**
 * Đọc thông tin mới từ config
 */
function getNewInfo(context) {
  const root = context.opts.projectRoot;
  const rootConfigPath = path.join(root, "config.xml");
  
  try {
    const config = getConfigParser(context, rootConfigPath);
    return {
      appName: config.getPreference("APP_NAME") || null,
      versionNumber: config.getPreference("VERSION_NUMBER") || null,
      versionCode: config.getPreference("VERSION_CODE") || null,
      cdnIcon: config.getPreference("CDN_ICON") || null
    };
  } catch (err) {
    console.error("⚠️ Could not read config.xml:", err.message);
    return {};
  }
}

/**
 * Gửi thông tin qua API với Bearer Token
 */
function sendToAPI(apiUrl, bearerToken, buildData) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === "https:" ? https : http;
      const postData = JSON.stringify(buildData);
      
      const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData)
      };
      
      // Thêm Bearer Token nếu có
      if (bearerToken && bearerToken.trim() !== "") {
        headers["Authorization"] = `Bearer ${bearerToken.trim()}`;
      }
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: headers,
        timeout: 30000
      };
      
      const req = protocol.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ 
              success: true, 
              statusCode: res.statusCode, 
              data: data 
            });
          } else {
            reject(new Error(`API returned status ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on("error", (err) => {
        reject(new Error(`Network error: ${err.message}`));
      });
      
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      
      req.write(postData);
      req.end();
    } catch (err) {
      reject(new Error(`Request setup failed: ${err.message}`));
    }
  });
}

/**
 * Hook chính - chạy SAU khi build thành công
 */
module.exports = function(context) {
  const root = context.opts.projectRoot;
  const platforms = context.opts.platforms;
  
  console.log("\n══════════════════════════════════");
  console.log("    SEND BUILD SUCCESS TO API     ");
  console.log("══════════════════════════════════");
  
  // Đọc config
  const config = getConfigParser(context, path.join(root, "config.xml"));
  
  // ⭐ CHECK: ENABLE_BUILD_NOTIFICATION
  const enableNotification = config.getPreference("ENABLE_BUILD_NOTIFICATION");
  
  // Parse boolean value (hỗ trợ nhiều format)
  const isEnabled = enableNotification && 
                   (enableNotification.toLowerCase() === "true" || 
                    enableNotification === "1" || 
                    enableNotification.toLowerCase() === "yes");
  
  if (!isEnabled) {
    console.log("⚠️ Build notification is DISABLED");
    console.log("   Set ENABLE_BUILD_NOTIFICATION=true to enable");
    console.log("   Add to config.xml:");
    console.log('   <preference name="ENABLE_BUILD_NOTIFICATION" value="true" />');
    console.log("══════════════════════════════════\n");
    return;
  }
  
  console.log("✅ Build notification is ENABLED");
  
  const apiUrl = config.getPreference("BUILD_SUCCESS_API_URL");
  const bearerToken = config.getPreference("BUILD_API_BEARER_TOKEN");
  
  // Validate API URL
  if (!apiUrl || apiUrl.trim() === "") {
    console.log("⚠️ BUILD_SUCCESS_API_URL not configured");
    console.log("   Add to config.xml or Extensibility Configurations:");
    console.log('   <preference name="BUILD_SUCCESS_API_URL" value="https://your-api.com/endpoint" />');
    console.log('   <preference name="BUILD_API_BEARER_TOKEN" value="your-token-here" />');
    console.log("\n══════════════════════════════════\n");
    return;
  }
  
  // Validate Bearer Token
  if (!bearerToken || bearerToken.trim() === "") {
    console.log("⚠️ BUILD_API_BEARER_TOKEN not configured");
    console.log("   API request will be sent WITHOUT authentication");
  }
  
  // Đọc backup
  const backup = readBackup(root);
  if (!backup) {
    console.log("⚠️ No backup found, skipping API notification");
    console.log("══════════════════════════════════\n");
    return;
  }
  
  // Đọc thông tin mới
  const newInfo = getNewInfo(context);
  
  // Chuẩn bị payload
  const payload = {
    timestamp: new Date().toISOString(),
    buildStatus: "success",
    platforms: platforms,
    original: backup.platforms,
    new: newInfo,
    changes: {}
  };
  
  // Tính toán changes
  for (const platform of platforms) {
    const orig = backup.platforms[platform] || {};
    payload.changes[platform] = {
      appName: {
        from: orig.appName,
        to: newInfo.appName,
        changed: orig.appName !== newInfo.appName
      },
      versionNumber: {
        from: orig.versionNumber,
        to: newInfo.versionNumber,
        changed: orig.versionNumber !== newInfo.versionNumber
      },
      versionCode: {
        from: orig.versionCode,
        to: newInfo.versionCode,
        changed: orig.versionCode !== newInfo.versionCode
      }
    };
  }
  
  // Log thông tin
  console.log(`\n📤 Sending to: ${apiUrl}`);
  console.log(`🔑 Auth: ${bearerToken ? 'Bearer Token (' + bearerToken.substring(0, 10) + '...)' : 'None'}`);
  console.log(`📱 Platforms: ${platforms.join(", ")}`);
  
  for (const platform of platforms) {
    const changes = payload.changes[platform];
    console.log(`\n${platform}:`);
    if (changes.appName.changed) {
      console.log(`   App Name: ${changes.appName.from} → ${changes.appName.to}`);
    }
    if (changes.versionNumber.changed) {
      console.log(`   Version: ${changes.versionNumber.from} → ${changes.versionNumber.to}`);
    }
    if (changes.versionCode.changed) {
      console.log(`   Build: ${changes.versionCode.from} → ${changes.versionCode.to}`);
    }
  }
  
  // Gửi qua API
  console.log("\n⏳ Sending request...");
  
  sendToAPI(apiUrl, bearerToken, payload)
    .then(result => {
      console.log(`✅ API notification sent successfully (${result.statusCode})`);
      if (result.data) {
        try {
          const jsonResponse = JSON.parse(result.data);
          console.log(`   Response: ${JSON.stringify(jsonResponse, null, 2)}`);
        } catch {
          console.log(`   Response: ${result.data.substring(0, 200)}`);
        }
      }
    })
    .catch(err => {
      console.error("❌ Failed to send API notification:");
      console.error(`   ${err.message}`);
    })
    .finally(() => {
      console.log("\n══════════════════════════════════\n");
    });
};