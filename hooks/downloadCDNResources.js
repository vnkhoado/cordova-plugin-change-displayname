#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const url = require('url');
const utils = require('./utils');

module.exports = function(context) {
  return downloadCDNResourcesAsync(context);
};

/**
 * Main async function
 */
async function downloadCDNResourcesAsync(context) {
  const projectRoot = context.opts.projectRoot;
  const assetsDir = path.join(projectRoot, 'www', 'assets');
  const indexHtmlPath = path.join(projectRoot, 'www', 'index.html');

  console.log('\n📥 [CDN-DOWNLOAD] Starting CDN resource download...\n');

  try {
    // Get config parser from utils
    const configParser = utils.getConfigParser(context);
    if (!configParser) {
      console.log('⚠️  Could not initialize config parser, skipping CDN download');
      return;
    }

    // Read CDN_RESOURCE preference from config.xml
    const cdnResource = configParser.getPreference('CDN_RESOURCE');
    if (!cdnResource) {
      console.log('⚠️  CDN_RESOURCE not configured in config.xml, skipping download');
      return;
    }

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

    // Wait for download to complete
    try {
      await downloadFilePromise(cdnResource, localFilePath);
      console.log(`✅ Downloaded: www/assets/${fileName}`);

      // Inject local reference into index.html
      const localReference = `assets/${fileName}`;
      injectLocalLink(indexHtmlPath, localReference);

      console.log(`✅ Injected: <link rel="stylesheet" href="${localReference}">`);
    } catch (downloadError) {
      console.log(`⚠️  Failed to download from CDN: ${downloadError.message}`);
      console.log(`📋 Will use CDN URL directly: ${cdnResource}`);
      injectCDNLink(indexHtmlPath, cdnResource);
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Download file from URL - Promise version
 */
function downloadFilePromise(urlString, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = urlString.startsWith('https') ? https : http;
    const timeoutMs = 30000; // 30 second timeout
    let fileStream = null;
    let isResolved = false;

    try {
      const request = protocol.get(urlString, { timeout: timeoutMs }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          if (fileStream) fileStream.destroy();
          return downloadFilePromise(response.headers.location, filePath)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          if (fileStream) fileStream.destroy();
          fs.unlink(filePath, () => {});
          const err = new Error(`HTTP ${response.statusCode} - Failed to download from CDN`);
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
          return;
        }

        fileStream = fs.createWriteStream(filePath);

        response.on('error', (err) => {
          if (fileStream) fileStream.destroy();
          fs.unlink(filePath, () => {});
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
        });

        fileStream.on('error', (err) => {
          if (fileStream) fileStream.destroy();
          fs.unlink(filePath, () => {});
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
        });

        fileStream.on('finish', () => {
          fileStream.close();
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        });

        response.pipe(fileStream);
      });

      request.on('error', (err) => {
        if (fileStream) fileStream.destroy();
        fs.unlink(filePath, () => {});
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
      });

      request.on('timeout', () => {
        request.destroy();
        if (fileStream) fileStream.destroy();
        fs.unlink(filePath, () => {});
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Download timeout (30s)'));
        }
      });

    } catch (error) {
      if (fileStream) fileStream.destroy();
      fs.unlink(filePath, () => {});
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    }
  });
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

  // Remove old CDN link if exists (regex on single line)
  const cdnLinkRegex = /<link[^>]*href=['"]https?:\/\/[^'"]*['"]*>/g;
  content = content.replace(cdnLinkRegex, '');

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
