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
      return;
    }

    // Create assets directory
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
      console.log(`✅ Created: www/assets/`);
    }

    const fileName = path.basename(resourceUrl.pathname) || 'styles.css';
    const cssFileName = fileName.endsWith('.css') ? fileName : fileName + '.css';
    const tempFilePath = path.join(assetsDir, fileName);
    const cssFilePath = path.join(assetsDir, cssFileName);

    let cssContent = '';
    let downloadSuccess = false;

    // Try to download from CDN
    try {
      const downloadResult = await downloadFilePromise(cdnResource, tempFilePath);
      
      console.log(`✅ Downloaded from CDN: www/assets/${fileName}`);
      console.log(`   File size: ${downloadResult.size} bytes`);
      console.log(`   Status: ${downloadResult.statusCode}`);
      console.log(`   Content-Type: ${downloadResult.contentType || 'unknown'}`);

      cssContent = fs.readFileSync(tempFilePath, 'utf8');
      downloadSuccess = true;

      // Check if MIME type is not CSS
      if (downloadResult.contentType && !downloadResult.contentType.includes('text/css')) {
        console.log(`\n⚠️  WARNING: Downloaded file has MIME type '${downloadResult.contentType}'`);
        
        if (downloadResult.contentType.includes('text/html')) {
          console.log(`🔄 Attempting to extract CSS from HTML...`);
          
          // Extract CSS from HTML
          const extractedCSS = extractCSSFromHTML(cssContent);
          
          if (extractedCSS.trim()) {
            cssContent = extractedCSS;
            console.log(`✅ Extracted CSS from HTML`);
          } else {
            console.log(`   No <style> tags found in HTML`);
          }
        }
      } else if (downloadResult.contentType && downloadResult.contentType.includes('text/css')) {
        console.log(`✅ Correct MIME type (text/css)`);
      }

      // Save CSS file locally
      fs.writeFileSync(cssFilePath, cssContent, 'utf8');
      console.log(`✅ Cached locally: www/assets/${cssFileName} (${cssContent.length} bytes)`);
      
      // Delete temp file if different
      if (tempFilePath !== cssFilePath) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          // Ignore
        }
      }

    } catch (downloadError) {
      console.log(`\n⚠️  Failed to download from CDN: ${downloadError.message}`);
      console.log(`   URL: ${cdnResource}`);
      console.log(`📋 Will create fallback CSS file\n`);
      downloadSuccess = false;
    }

    // Inject into index.html
    if (cssContent.trim()) {
      // Strategy 1: Use CDN link as primary, with inline fallback
      injectCSSWithFallback(indexHtmlPath, cdnResource, cssContent);
      console.log(`✅ Injected: CDN link with fallback`);
    } else {
      // Strategy 2: If no content, just use CDN link
      injectCDNLinkOnly(indexHtmlPath, cdnResource);
      console.log(`✅ Injected: CDN link only`);
    }

    console.log('');

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
  
  return cssContent.trim();
}

/**
 * Inject CSS with strategy:
 * 1. Primary: Load from CDN (lightweight)
 * 2. Fallback: Inline CSS if CDN fails to load
 * 
 * This uses JavaScript to check if CDN CSS loaded, and inject inline as fallback
 */
function injectCSSWithFallback(indexHtmlPath, cdnUrl, cssContent) {
  if (!fs.existsSync(indexHtmlPath)) {
    console.log(`⚠️  index.html not found at ${indexHtmlPath}`);
    return;
  }

  let content = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check if already injected
  if (content.includes('<!-- CDN CSS with Fallback -->')) {
    console.log('ℹ️  CSS already injected in index.html');
    return;
  }

  // Remove old external CDN links
  const cdnLinkRegex = /<link[^>]*href=['"]https?:\/\/[^'"]*['"][^>]*>/g;
  content = content.replace(cdnLinkRegex, '');

  // Escape CSS content for use in JavaScript string
  const escapedCSS = cssContent
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\'")
    .replace(/\n/g, '\\n');

  // Create injection with fallback mechanism
  const injection = `    <!-- CDN CSS with Fallback -->
    <link id="cdn-style" rel="stylesheet" href="${cdnUrl}">
    <style id="css-fallback" style="display:none;">
${cssContent}
    </style>
    <script>
    // Fallback: If CDN CSS fails to load, use inline fallback
    (function() {
      var cdnLink = document.getElementById('cdn-style');
      var fallback = document.getElementById('css-fallback');
      
      // Check if CDN link loaded successfully
      var timeout = setTimeout(function() {
        if (!isCSSLoaded(cdnLink)) {
          console.warn('CDN CSS failed to load, using fallback');
          fallback.style.display = 'block';
          var style = document.createElement('style');
          style.textContent = fallback.textContent;
          document.head.appendChild(style);
        }
      }, 2000); // Wait 2 seconds for CDN to load
      
      // Listen for load/error events
      cdnLink.onload = function() {
        clearTimeout(timeout);
        console.log('CDN CSS loaded successfully');
        fallback.style.display = 'none';
      };
      cdnLink.onerror = function() {
        clearTimeout(timeout);
        console.warn('CDN CSS load error, using fallback');
        fallback.style.display = 'block';
        var style = document.createElement('style');
        style.textContent = fallback.textContent;
        document.head.appendChild(style);
      };
    })();
    
    function isCSSLoaded(link) {
      try {
        var sheet = link.sheet;
        return sheet && sheet.cssRules !== undefined;
      } catch (e) {
        return false;
      }
    }
    </script>`;

  // Inject before </head>
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${injection}\n</head>`);
  } else if (content.includes('<head>')) {
    content = content.replace('<head>', `<head>\n${injection}`);
  }

  fs.writeFileSync(indexHtmlPath, content);
}

/**
 * Inject CDN link only (without fallback)
 * Used when CSS content is not available
 */
function injectCDNLinkOnly(indexHtmlPath, cdnUrl) {
  if (!fs.existsSync(indexHtmlPath)) {
    console.log(`⚠️  index.html not found at ${indexHtmlPath}`);
    return;
  }

  let content = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check if already injected
  if (content.includes(cdnUrl)) {
    console.log('ℹ️  CDN CSS link already in index.html');
    return;
  }

  // Remove old CDN links
  const cdnLinkRegex = /<link[^>]*href=['"]https?:\/\/[^'"]*['"][^>]*>/g;
  content = content.replace(cdnLinkRegex, '');

  const linkTag = `    <link rel="stylesheet" href="${cdnUrl}">`;
  
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${linkTag}\n</head>`);
  } else if (content.includes('<head>')) {
    content = content.replace('<head>', `<head>\n${linkTag}`);
  }

  fs.writeFileSync(indexHtmlPath, content);
}

/**
 * Download file from URL - Promise version
 */
function downloadFilePromise(urlString, filePath) {
  return new Promise((resolve, reject) => {
    const protocol = urlString.startsWith('https') ? https : http;
    const timeoutMs = 30000;
    let fileStream = null;
    let isResolved = false;
    let contentType = null;
    let statusCode = null;
    let fileSize = 0;

    try {
      const request = protocol.get(urlString, { timeout: timeoutMs }, (response) => {
        statusCode = response.statusCode;
        contentType = response.headers['content-type'];

        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          if (fileStream) fileStream.destroy();
          return downloadFilePromise(response.headers.location, filePath)
            .then(resolve)
            .catch(reject);
        }

        // Check for errors
        if (response.statusCode !== 200) {
          if (fileStream) fileStream.destroy();
          fs.unlink(filePath, () => {});
          const err = new Error(`HTTP ${response.statusCode}`);
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
          reject(err);
        }
      });

      request.on('timeout', () => {
        request.destroy();
        if (fileStream) fileStream.destroy();
        fs.unlink(filePath, () => {});
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Download timeout'));
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
