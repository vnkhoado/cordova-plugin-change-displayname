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
  const indexHtmlPath = path.join(projectRoot, 'www', 'index.html');

  console.log('\n📥 [CDN-DOWNLOAD] Downloading CSS from CDN...\n');

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
    try {
      new url.URL(cdnResource);
    } catch (urlError) {
      console.log(`❌ Invalid CDN URL format: ${urlError.message}`);
      return;
    }

    // Download CSS content
    try {
      console.log('   Downloading CSS...');
      const cssContent = await downloadFileAsString(cdnResource);
      console.log(`✅ Downloaded: ${cssContent.length} bytes`);

      // Inject CSS inline into index.html
      injectCSSInline(indexHtmlPath, cssContent);
      console.log(`✅ Injected CSS inline into <head>\n`);

    } catch (downloadError) {
      console.log(`❌ ERROR: Failed to download from CDN`);
      console.log(`   URL: ${cdnResource}`);
      console.log(`   Error: ${downloadError.message}`);
      console.log(`\n🧰 Troubleshooting:`);
      console.log(`   1. Verify CDN URL is correct`);
      console.log(`   2. Check if file exists on server`);
      console.log(`   3. Verify server is accessible\n`);
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Download file from URL and return as string
 */
function downloadFileAsString(urlString) {
  return new Promise((resolve, reject) => {
    const protocol = urlString.startsWith('https') ? https : http;
    const timeoutMs = 30000;
    let isResolved = false;
    let data = '';

    try {
      const request = protocol.get(urlString, { timeout: timeoutMs }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`   Redirecting to: ${response.headers.location}`);
          return downloadFileAsString(response.headers.location)
            .then(resolve)
            .catch(reject);
        }

        // Check for errors
        if (response.statusCode !== 200) {
          const err = new Error(`HTTP ${response.statusCode} - ${http.STATUS_CODES[response.statusCode] || 'Unknown error'}`);
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
          return;
        }

        response.on('data', (chunk) => {
          data += chunk.toString();
        });

        response.on('error', (err) => {
          if (!isResolved) {
            isResolved = true;
            reject(new Error(`Response error: ${err.message}`));
          }
        });

        response.on('end', () => {
          if (!isResolved) {
            isResolved = true;
            resolve(data);
          }
        });
      });

      request.on('error', (err) => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Request error: ${err.message}`));
        }
      });

      request.on('timeout', () => {
        request.destroy();
        if (!isResolved) {
          isResolved = true;
          reject(new Error('Download timeout (30s)'));
        }
      });

    } catch (error) {
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    }
  });
}

/**
 * Inject CSS content INLINE into index.html
 */
function injectCSSInline(indexHtmlPath, cssContent) {
  if (!fs.existsSync(indexHtmlPath)) {
    console.log(`⚠️  index.html not found at ${indexHtmlPath}`);
    return;
  }

  if (!cssContent || !cssContent.trim()) {
    console.log(`⚠️  CSS content is empty, skipping injection`);
    return;
  }

  let content = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check if CSS already injected
  if (content.includes('<!-- CDN Styles -->')) {
    console.log('ℹ️  CSS already injected in index.html');
    return;
  }

  // Create style tag with CSS content
  const styleTag = `    <!-- CDN Styles -->
    <style>
${cssContent}
    </style>`;

  // Inject before </head>
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${styleTag}\n</head>`);
  } else if (content.includes('<head>')) {
    // If no </head>, add after <head>
    content = content.replace('<head>', `<head>\n${styleTag}`);
  }

  fs.writeFileSync(indexHtmlPath, content);
}
