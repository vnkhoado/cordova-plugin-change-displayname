#!/usr/bin/env node

/**
 * Configure Splash Color Hook (after_prepare)
 * 
 * Simplified hook that replaces customizeSplashScreen.js
 * Uses centralized splashColorManager for all operations.
 * 
 * Responsibilities:
 * - Update config.xml preferences
 * - Update Android native files (colors.xml, themes.xml)
 * 
 * Runs during: after_prepare phase
 */

const { logSection, logSectionComplete } = require('./utils');
const splashManager = require('./lib/splashColorManager');

module.exports = function(context) {
  const platforms = context.opts.platforms;

  logSection('🎨 CONFIGURE SPLASH COLOR (after_prepare)');
  console.log('📝 Purpose: Set splash screen background color');
  console.log('🔧 Phase: Prepare (before compilation)\n');

  // Get splash color configuration (single source of truth)
  const colorConfig = splashManager.getSplashColorConfig(context);
  console.log(`🎨 Splash Color: ${colorConfig.newColor}`);
  console.log(`🔄 Old Color (will replace): ${colorConfig.oldColor}\n`);

  for (const platform of platforms) {
    console.log(`📱 Processing ${platform}...`);

    try {
      if (platform === 'android') {
        // Update config.xml preferences
        const configUpdated = splashManager.updateConfigXml(
          context,
          platform,
          colorConfig
        );

        // Update native Android files
        const nativeUpdated = splashManager.updateAndroidNativeFiles(
          context,
          colorConfig
        );

        if (configUpdated || nativeUpdated) {
          console.log(`   ✅ Android splash color configured\n`);
        } else {
          console.log(`   ⚠️  No files updated (may need manual check)\n`);
        }
      } else if (platform === 'ios') {
        // iOS splash color is handled by native-gradient-splash.js
        console.log('   ℹ️  iOS splash handled by separate hook\n');
      } else {
        console.log(`   ℹ️  Platform ${platform} not supported\n`);
      }
    } catch (err) {
      console.error(`   ❌ Failed to configure splash for ${platform}:`, err.message);
      console.error(err.stack);
    }
  }

  logSectionComplete('✅ Splash color configuration completed!');
};
