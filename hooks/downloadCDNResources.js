#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const url = require('url');

module.exports = function(context) {
  const projectRoot = context.opts.projectRoot;
  const configXmlPath = path.join(projectRoot, 'config.xml');
  const assetsDir = path.join(projectRoot, 'www', 'assets');
  const indexHtmlPath = path.join(projectRoot, 'www', 'index.html');

  console.log('\n📥 [CDN-DOWNLOAD] Starting CDN resource download...\n');

  try {
    // Read config.xml to get CDN_RESOURCE
    if (!fs.existsSync(configXmlPath)) {
      console.log('⚠️  config.xml not found, skipping CDN download');
      return;
    }

    const configContent = fs.readFileSync(configXmlPath, 'utf8');
    
    // Extract CDN_RESOURCE preference
    const cdnMatch = configContent.match(/<preference name="CDN_RESOURCE" value="([^"]+)" \/>/i);
    if (!cdnMatch || !cdnMatch[1]) {
      console.log('⚠️  CDN_RESOURCE not configured in config.xml, skipping download');
      return;
    }

    const cdnResource = cdnMatch[1];
    console.log(`✅ Found CDN_RESOURCE: ${cdnResource}`);

    // Parse CDN URL
    const resourceUrl = new url.URL(cdnResource);
    const fileName = path.basename(resourceUrl.pathname) || 'styles.css';

    // Create assets directory
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      console.log(`✅ Created: www/assets/`);
    }

    const localFilePath = path.join(assetsDir, fileName);

    // Download file
    downloadFile(cdnResource, localFilePath, (error) => {
      if (error) {
        console.log(`⚠️  Failed to download from CDN: ${error.message}`);
        console.log(`📌 Will use CDN URL directly: ${cdnResource}`);
        injectCDNLink(indexHtmlPath, cdnResource);
        return;
      }

      console.log(`✅ Downloaded: www/assets/${fileName}`);

      // Inject local reference into index.html
      const localReference = `assets/${fileName}`;
      injectLocalLink(indexHtmlPath, localReference);

      console.log(`✅ Injected: <link rel="stylesheet" href="${localReference}">`);
    });

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
};

/**
 * Download file from URL
 */
function downloadFile(urlString, filePath, callback) {
  const protocol = urlString.startsWith('https') ? https : http;
  const timeoutMs = 10000; // 10 second timeout
  let fileStream = null;

  try {
    const request = protocol.get(urlString, { timeout: timeoutMs }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadFile(response.headers.location, filePath, callback);
      }

      if (response.statusCode !== 200) {
        throw new Error(`HTTP ${response.statusCode}`);
      }

      fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        callback(null);
      });
    });

    request.on('error', (error) => {
      if (fileStream) fileStream.destroy();
      fs.unlink(filePath, () => {}); // Delete partial file
      callback(error);
    });

    request.on('timeout', () => {
      request.destroy();
      if (fileStream) fileStream.destroy();
      fs.unlink(filePath, () => {});
      callback(new Error('Download timeout'));
    });

  } catch (error) {
    if (fileStream) fileStream.destroy();
    fs.unlink(filePath, () => {});
    callback(error);
  }
}

/**
 * Inject link tag for local file
 */
function injectLocalLink(indexHtmlPath, localReference) {
  if (!fs.existsSync(indexHtmlPath)) {
    console.log(`⚠️  index.html not found at ${indexHtmlPath}`);
    return;
  }

  let content = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check if already injected
  if (content.includes(localReference)) {
    console.log('ℹ️  Local resource link already in index.html');
    return;
  }

  // Remove old CDN link if exists
  content = content.replace(/<link[^>]*href=['"]https?:\/\/[^'"]*['"][^>]*>
/g, '');

  // Add link tag before </head>
  const linkTag = `    <link rel="stylesheet" href="${localReference}">`;
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${linkTag}\n</head>`);
  } else if (content.includes('<head>')) {
    // If no </head>, add after <head>
    content = content.replace('<head>', `<head>\n${linkTag}`);
  }

  fs.writeFileSync(indexHtmlPath, content);
}

/**
 * Inject link tag for CDN URL (fallback)
 */
function injectCDNLink(indexHtmlPath, cdnUrl) {
  if (!fs.existsSync(indexHtmlPath)) {
    console.log(`⚠️  index.html not found at ${indexHtmlPath}`);
    return;
  }

  let content = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check if already injected
  if (content.includes(cdnUrl)) {
    console.log('ℹ️  CDN resource link already in index.html');
    return;
  }

  // Add link tag before </head>
  const linkTag = `    <link rel="stylesheet" href="${cdnUrl}">`;
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${linkTag}\n</head>`);
  } else if (content.includes('<head>')) {
    content = content.replace('<head>', `<head>\n${linkTag}`);
  }

  fs.writeFileSync(indexHtmlPath, content);
}
