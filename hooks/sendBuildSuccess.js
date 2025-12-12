#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { getConfigParser } = require("./utils");

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
  
  console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  console.log("    SEND BUILD SUCCESS TO API     ");
  console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  
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
    console.log("\u26a0\ufe0f Build notification is DISABLED");
    console.log("   Set ENABLE_BUILD_NOTIFICATION=true to enable");
    console.log("   Add to config.xml:");
    console.log('   <preference name="ENABLE_BUILD_NOTIFICATION" value="true" />');
    console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n");
    return;
  }
  
  console.log("\u2705 Build notification is ENABLED");
  
  const apiBaseUrl = config.getPreference("BUILD_SUCCESS_API_URL");
  const bearerToken = config.getPreference("BUILD_API_BEARER_TOKEN");
  
  // Validate API URL
  if (!apiBaseUrl || apiBaseUrl.trim() === "") {
    console.log("\u26a0\ufe0f BUILD_SUCCESS_API_URL not configured");
    console.log("   Add to config.xml or Extensibility Configurations:");
    console.log('   <preference name="BUILD_SUCCESS_API_URL" value="https://your-api.com/builds" />');
    console.log('   <preference name="BUILD_API_BEARER_TOKEN" value="your-token-here" />');
    console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n");
    return;
  }
  
  // Validate Bearer Token
  if (!bearerToken || bearerToken.trim() === "") {
    console.log("\u26a0\ufe0f BUILD_API_BEARER_TOKEN not configured");
    console.log("   API request will be sent WITHOUT authentication");
  }
  
  // Đọc thông tin từ config
  const appName = config.getPreference("APP_NAME") || config.name() || "Unknown App";
  const appDomain = config.getPreference("API_HOSTNAME") || "";
  const versionNumber = config.getPreference("VERSION_NUMBER") || config.version() || "0.0.0";
  
  // Log thông tin
  console.log(`\n\ud83d\udcf1 App Name: ${appName}`);
  console.log(`\ud83c\udf10 App Domain: ${appDomain}`);
  console.log(`\ud83d\udd22 Version: ${versionNumber}`);
  console.log(`\ud83d\udce6 Platforms: ${platforms.join(", ")}`);
  
  // Gửi request cho từng platform
  const promises = platforms.map(platform => {
    // Build URL với version trên path: /builds/{version}
    const apiUrl = `${apiBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(versionNumber)}`;
    
    // Chuẩn bị payload
    const payload = {
      app_name: appName,
      app_domain: appDomain,
      app_platform: platform,
      config_version: versionNumber
    };
    
    console.log(`\n\ud83d\udce4 Sending ${platform} to: ${apiUrl}`);
    console.log(`   Body: ${JSON.stringify(payload)}`);
    
    return sendToAPI(apiUrl, bearerToken, payload)
      .then(result => {
        console.log(`\u2705 ${platform}: API notification sent successfully (${result.statusCode})`);
        if (result.data) {
          try {
            const jsonResponse = JSON.parse(result.data);
            console.log(`   Response: ${JSON.stringify(jsonResponse)}`);
          } catch {
            console.log(`   Response: ${result.data.substring(0, 100)}`);
          }
        }
        return { platform, success: true };
      })
      .catch(err => {
        console.error(`\u274c ${platform}: Failed to send API notification`);
        console.error(`   Error: ${err.message}`);
        return { platform, success: false, error: err.message };
      });
  });
  
  // Đợi tất cả requests hoàn thành
  Promise.all(promises)
    .then(results => {
      console.log("\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      console.log(`\ud83d\udce6 Build notifications completed:`);
      console.log(`   \u2705 Success: ${successCount}`);
      if (failCount > 0) {
        console.log(`   \u274c Failed: ${failCount}`);
      }
      console.log("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n");
    });
};