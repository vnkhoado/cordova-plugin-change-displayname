#!/usr/bin/env node

/**
 * Enforce Splash Color Hook (before_compile + post_compile)
 * 
 * Unified hook that replaces 4 separate hooks:
 * - forceOverrideSplashColor.js
 * - forceOverrideNativeColors.js
 * - forceMBASSplashColor.js
 * - scanAndReplaceColor.js
 * 
 * Responsibilities:
 * - Scan and replace colors in www/ files (before_compile)
 * - Force MABS override after compilation (post_compile)
 * 
 * Runs during: before_compile AND post_compile phases
 */

const { logSection, logSectionComplete } = require('./utils');
const splashManager = require('./lib/splashColorManager');

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const hook = context.hook;

  // Determine which phase we're in
  const isBeforeCompile = hook === 'before_compile';
  const isPostCompile = hook === 'post_compile';

  if (isBeforeCompile) {
    handleBeforeCompile(context, platforms);
  } else if (isPostCompile) {
    handlePostCompile(context, platforms);
  } else {
    console.warn('⚠️  enforceSplashColor called from unexpected hook:', hook);
  }
};

/**
 * Handle before_compile phase
 * Scan and replace colors in www/ files
 */
function handleBeforeCompile(context, platforms) {
  logSection('🔍 ENFORCE SPLASH COLOR (before_compile)');
  console.log('📝 Purpose: Scan and replace colors in www/ files');
  console.log('🔧 Phase: Before compilation');
  console.log('ℹ️  This prevents OutSystems theme override\n');

  // Get splash color configuration
  const colorConfig = splashManager.getSplashColorConfig(context);
  console.log(`🎨 New Color: ${colorConfig.newColor}`);
  console.log(`🔄 Replacing: ${colorConfig.oldColor}\n`);

  for (const platform of platforms) {
    console.log(`📱 Processing ${platform}...`);

    try {
      if (platform === 'android') {
        // Scan and replace colors in CSS/HTML files
        const replaced = splashManager.scanAndReplaceColors(
          context,
          platform,
          colorConfig
        );

        if (replaced) {
          console.log(`   ✅ Colors enforced in www/ files\n`);
        } else {
          console.log(`   ℹ️  No color replacements needed\n`);
        }
      } else if (platform === 'ios') {
        console.log('   ℹ️  iOS color enforcement not needed\n');
      } else {
        console.log(`   ℹ️  Platform ${platform} not supported\n`);
      }
    } catch (err) {
      console.error(`   ❌ Failed to enforce splash for ${platform}:`, err.message);
      console.error(err.stack);
    }
  }

  logSectionComplete('✅ Splash color enforcement (before_compile) completed!');
}

/**
 * Handle post_compile phase
 * Force MABS override (OutSystems-specific)
 */
function handlePostCompile(context, platforms) {
  logSection('🔒 FORCE MABS OVERRIDE (post_compile)');
  console.log('📝 Purpose: Override MABS compilation changes');
  console.log('🔧 Phase: After compilation');
  console.log('ℹ️  This ensures color persists after MABS build\n');

  // Get splash color configuration
  const colorConfig = splashManager.getSplashColorConfig(context);
  console.log(`🎨 Enforcing Color: ${colorConfig.newColor}\n`);

  for (const platform of platforms) {
    console.log(`📱 Processing ${platform}...`);

    try {
      if (platform === 'android') {
        // Force MABS override
        const overridden = splashManager.forceMBASOverride(
          context,
          platform,
          colorConfig
        );

        if (overridden) {
          console.log(`   ✅ MABS override successful\n`);
        } else {
          console.log(`   ⚠️  MABS override had issues\n`);
        }
      } else if (platform === 'ios') {
        console.log('   ℹ️  iOS MABS override not needed\n');
      } else {
        console.log(`   ℹ️  Platform ${platform} not supported\n`);
      }
    } catch (err) {
      console.error(`   ❌ Failed MABS override for ${platform}:`, err.message);
      console.error(err.stack);
    }
  }

  logSectionComplete('✅ MABS override (post_compile) completed!');
}
