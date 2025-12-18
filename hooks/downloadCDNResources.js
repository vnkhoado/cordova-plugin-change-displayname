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

    // Validate URL format
    let resourceUrl;
    try {
      resourceUrl = new url.URL(cdnResource);
    } catch (urlError) {
      console.log(`❌ Invalid CDN URL format: ${urlError.message}`);
      console.log(`📋 Using CDN URL directly (invalid format detected)`);
      injectCDNLink(indexHtmlPath, cdnResource);
      return;
    }

    const fileName = path.basename(resourceUrl.pathname) || 'styles.css';
    const cssFileName = fileName.endsWith('.css') ? fileName : fileName + '.css';

    // Create assets directory
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      console.log(`✅ Created: www/assets/`);
    }

    const tempFilePath = path.join(assetsDir, fileName);
    const cssFilePath = path.join(assetsDir, cssFileName);

    // Wait for download to complete
    try {
      const downloadResult = await downloadFilePromise(cdnResource, tempFilePath);
      
      console.log(`✅ Downloaded: www/assets/${fileName}`);
      console.log(`   File size: ${downloadResult.size} bytes`);
      console.log(`   Status: ${downloadResult.statusCode}`);
      console.log(`   Content-Type: ${downloadResult.contentType || 'unknown'}`);

      // Check if MIME type is not CSS
      if (downloadResult.contentType && !downloadResult.contentType.includes('text/css')) {
        console.log(`\n⚠️  WARNING: Downloaded file has MIME type '${downloadResult.contentType}'`);
        console.log(`   Expected 'text/css' for CSS files`);
        
        if (downloadResult.contentType.includes('text/html')) {
          console.log(`\n🔄 Converting HTML to CSS...`);
          const htmlContent = fs.readFileSync(tempFilePath, 'utf8');
          
          // Extract CSS from HTML
          // Look for <style> tags or CSS content
          let cssContent = extractCSSFromHTML(htmlContent);
          
          // If no CSS found in HTML, try to use the HTML content as-is (might work)
          if (!cssContent.trim()) {
            console.log(`   No <style> tags found, using HTML content as CSS`);
            cssContent = htmlContent;
          }
          
          // Write CSS to proper file
          fs.writeFileSync(cssFilePath, cssContent, 'utf8');
          console.log(`✅ Created CSS file: www/assets/${cssFileName}`);
          console.log(`   CSS file size: ${cssContent.length} bytes`);
          
          // Delete temp HTML file
          try {
            fs.unlinkSync(tempFilePath);
            console.log(`✅ Cleaned up temp file`);
          } catch (e) {
            // Ignore if deletion fails
          }
        } else {
          console.log(`   Verify CDN URL is correct: ${cdnResource}`);
          // Use the file as-is
          const localReference = `assets/${fileName}`;
          injectLocalLink(indexHtmlPath, localReference);
          return;
        }
      } else if (downloadResult.contentType && downloadResult.contentType.includes('text/css')) {
        console.log(`✅ Correct MIME type detected (text/css)`);
        // File is already CSS, use it as-is
        if (tempFilePath !== cssFilePath) {
          // Rename to CSS extension if needed
          try {
            fs.renameSync(tempFilePath, cssFilePath);
          } catch (e) {
            // If rename fails, just copy
            fs.copyFileSync(tempFilePath, cssFilePath);
            fs.unlinkSync(tempFilePath);
          }
        }
      } else {
        // No MIME type info, assume it's CSS
        console.log(`⚠️  No MIME type detected, assuming CSS`);
        if (tempFilePath !== cssFilePath) {
          fs.copyFileSync(tempFilePath, cssFilePath);
          fs.unlinkSync(tempFilePath);
        }
      }

      // Inject local reference into index.html
      const localReference = `assets/${cssFileName}`;
      injectLocalLink(indexHtmlPath, localReference);

      console.log(`\n✅ Injected: <link rel="stylesheet" href="${localReference}">\n`);

    } catch (downloadError) {
      console.log(`\n❌ ERROR: Failed to download from CDN`);
      console.log(`   URL: ${cdnResource}`);
      console.log(`   Error: ${downloadError.message}`);
      console.log(`\n🧰 TROUBLESHOOTING:`);
      console.log(`   1. Check if CDN URL is accessible: curl -i "${cdnResource}"`);
      console.log(`   2. Check if Content-Type is text/css (not text/html)`);
      console.log(`   3. Check if 404 error - file may not exist on CDN`);
      console.log(`   4. Verify CDN URL in config.xml CDN_RESOURCE preference\n`);
      console.log(`📋 Falling back to CDN URL directly: ${cdnResource}\n`);
      injectCDNLink(indexHtmlPath, cdnResource);
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Extract CSS content from HTML string
 */
function extractCSSFromHTML(htmlContent) {
  let cssContent = '';
  
  // Extract from <style> tags
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleTagRegex.exec(htmlContent)) !== null) {
    cssContent += match[1] + '\n';
  }
  
  // Also look for <link> tags with href to extract inline
  // This handles cases where CSS is referenced
  const linkTagRegex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']*)["'][^>]*>/gi;
  while ((match = linkTagRegex.exec(htmlContent)) !== null) {
    // Just note the external link in a comment
    cssContent += `/* External stylesheet referenced: ${match[1]} */\n`;
  }
  
  return cssContent.trim();
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
    let contentType = null;
    let statusCode = null;
    let fileSize = 0;

    try {
      const request = protocol.get(urlString, { timeout: timeoutMs }, (response) => {
        statusCode = response.statusCode;
        contentType = response.headers['content-type'];
        
        console.log(`   Downloading...`);

        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`   Redirecting to: ${response.headers.location}`);
          if (fileStream) fileStream.destroy();
          return downloadFilePromise(response.headers.location, filePath)
            .then(resolve)
            .catch(reject);
        }

        // Check for errors
        if (response.statusCode !== 200) {
          if (fileStream) fileStream.destroy();
          fs.unlink(filePath, () => {});
          const err = new Error(`HTTP ${response.statusCode} - ${http.STATUS_CODES[response.statusCode] || 'Unknown error'}`);
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
            reject(new Error(`Response error: ${err.message}`));
          }
        });

        fileStream.on('error', (err) => {
          if (fileStream) fileStream.destroy();
          fs.unlink(filePath, () => {});
          if (!isResolved) {
            isResolved = true;
            reject(new Error(`File write error: ${err.message}`));
          }
        });

        fileStream.on('finish', () => {
          fileStream.close();
          fileSize = fs.statSync(filePath).size;
          if (!isResolved) {
            isResolved = true;
            resolve({
              statusCode: statusCode,
              contentType: contentType,
              size: fileSize
            });
          }
        });

        response.pipe(fileStream);
      });

      request.on('error', (err) => {
        if (fileStream) fileStream.destroy();
        fs.unlink(filePath, () => {});
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Request error: ${err.message}`));
        }
      });

      request.on('timeout', () => {
        request.destroy();
        if (fileStream) fileStream.destroy();
        fs.unlink(filePath, () => {});
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Download timeout (30s) - CDN server may be slow or unreachable'));
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

  // Remove old CDN link if exists
  const cdnLinkRegex = /<link[^>]*href=['"]https?:\/\/[^'"]*['"]*>/g;
  content = content.replace(cdnLinkRegex, '');

  // Add link tag before </head>
  const linkTag = `    <link rel="stylesheet" href="${localReference}">`;
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${linkTag}\n</head>`);
  } else if (content.includes('<head>')) {
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
