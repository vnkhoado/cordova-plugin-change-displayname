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
    try {
      new url.URL(cdnResource);
    } catch (urlError) {
      console.log(`❌ Invalid CDN URL format: ${urlError.message}`);
      return;
    }

    // Inject CDN link into index.html
    injectCDNLink(indexHtmlPath, cdnResource);
    console.log(`✅ Injected: <link rel="stylesheet" href="${cdnResource}">\n`);

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Inject CDN link into index.html
 */
function injectCDNLink(indexHtmlPath, cdnUrl) {
  if (!fs.existsSync(indexHtmlPath)) {
    console.log(`⚠️  index.html not found at ${indexHtmlPath}`);
    return;
  }

  let content = fs.readFileSync(indexHtmlPath, 'utf8');

  // Check if already injected
  if (content.includes(cdnUrl)) {
    console.log('ℹ️  CDN link already in index.html');
    return;
  }

  // Remove old CDN links from other URLs
  const cdnLinkRegex = /<link[^>]*href=['"]https?:\/\/[^'"]*['"][^>]*>/g;
  content = content.replace(cdnLinkRegex, '');

  // Add new CDN link before </head>
  const linkTag = `    <link rel="stylesheet" href="${cdnUrl}">`;
  
  if (content.includes('</head>')) {
    content = content.replace('</head>', `${linkTag}\n</head>`);
  } else if (content.includes('<head>')) {
    content = content.replace('<head>', `<head>\n${linkTag}`);
  }

  fs.writeFileSync(indexHtmlPath, content);
}
