#!/usr/bin/env node

/**
 * Auto-Copy Config Files Hook
 * 
 * This hook automatically copies build config template files and config loaders
 * into the www/ directory during the before_prepare phase.
 * 
 * Problem: Cordova's prepare step deletes all files in platforms/www/ that don't
 * exist in the project's www/ directory. This causes build-config.json to be
 * deleted before the injectBuildInfo hook can update it.
 * 
 * Solution: Keep these files in www/ as "source files" so they're not deleted.
 * The injectBuildInfo hook then updates them with real build data.
 * 
 * Files managed:
 * - www/.cordova-app-data/build-config.json (template)
 * - www/.cordova-app-data/build-history.json (template)
 * - www/js/config-loader.js (source)
 * - www/js/config-loader-mobile.js (source)
 */

const fs = require('fs');
const path = require('path');

module.exports = function(context) {
  const projectRoot = context.opts.projectRoot;
  const sourceDir = path.join(projectRoot, 'www', '.cordova-app-data');
  const jsSourceDir = path.join(projectRoot, 'www', 'js');
  const pluginPath = path.join(projectRoot, 'plugins', 'cordova-plugin-change-app-info');

  console.log('\n════════════════════════════════════════════════════');
  console.log('  AUTO-COPY CONFIG FILES - Preserving source files');
  console.log('════════════════════════════════════════════════════\n');

  try {
    // Create directories if they don't exist
    [sourceDir, jsSourceDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${path.relative(projectRoot, dir)}`);
      }
    });

    // Create or maintain template JSON files
    const templates = {
      'build-config.json': {
        timestamp: 'will-be-updated-by-injectBuildInfo',
        version: '1.0',
        config: {}
      },
      'build-history.json': {
        builds: []
      }
    };

    Object.entries(templates).forEach(([name, content]) => {
      const filePath = path.join(sourceDir, name);
      // Create if missing, but don't overwrite if exists (let hook update it)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
        console.log(`✅ Created: ${path.relative(projectRoot, filePath)}`);
      }
    });

    // Copy config loaders from plugin
    const files = ['config-loader.js', 'config-loader-mobile.js'];
    files.forEach(file => {
      const src = path.join(pluginPath, 'hooks', 'lib', file);
      const dest = path.join(jsSourceDir, file);
      
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied: ${path.relative(projectRoot, dest)}`);
      } else {
        console.log(`⚠️  Not found: ${path.relative(projectRoot, src)}`);
      }
    });

    // Check if script tag is present in index.html
    const indexPath = path.join(projectRoot, 'www', 'index.html');
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      if (!indexContent.includes('config-loader-mobile.js')) {
        console.log('\n⚠️  Attention: Add this to www/index.html <head> section:');
        console.log('   <script src="js/config-loader-mobile.js"></script>\n');
      } else {
        console.log('✅ Script tag found in index.html');
      }
    }

    console.log('\n════════════════════════════════════════════════════');
    console.log('✅ Auto-copy completed! Files preserved for injectBuildInfo');
    console.log('════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error in auto-copy hook:', error.message);
    throw error;
  }
};
