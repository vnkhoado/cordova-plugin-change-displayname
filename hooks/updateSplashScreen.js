#!/usr/bin/env node

/**
 * Hook for updating splash screen with gradient support
 * This hook is called before build to process SPLASH_GRADIENT configuration
 */

const fs = require('fs');
const path = require('path');
const GradientParser = require('./gradient-parser');
const AndroidGradientGenerator = require('./android/gradient-generator');
const IOSGradientGenerator = require('./ios/gradient-generator');

module.exports = function(ctx) {
  console.log('\n[Splash Screen] Starting splash screen configuration...');
  
  try {
    const projectRoot = ctx.opts.projectRoot;
    const platforms = ctx.opts.cordova.platforms;
    
    // Get preferences from config.xml
    const preferences = getPreferences(ctx);
    
    console.log('[Splash Screen] Detected platforms:', platforms.join(', '));
    console.log('[Splash Screen] Configuration loaded');
    
    // Check for gradient preference
    const splashGradient = preferences.SPLASH_GRADIENT;
    
    if (!splashGradient) {
      console.log('[Splash Screen] No SPLASH_GRADIENT preference found, skipping gradient setup');
      return;
    }
    
    console.log('[Splash Screen] Found SPLASH_GRADIENT preference');
    console.log('[Splash Screen] Value:', splashGradient.substring(0, 60) + '...');
    
    // Validate gradient format
    if (!GradientParser.isValid(splashGradient)) {
      console.warn('[Splash Screen] Invalid gradient format, using fallback color');
      return;
    }
    
    // Parse gradient
    const parsed = GradientParser.parse(splashGradient);
    if (!parsed) {
      console.warn('[Splash Screen] Failed to parse gradient, using fallback color');
      return;
    }
    
    console.log('[Splash Screen] ✓ Gradient parsed successfully');
    console.log('[Splash Screen]   - Angle:', parsed.angle + 'deg');
    console.log('[Splash Screen]   - Colors:', parsed.colors.length);
    
    // Process Android gradient
    if (platforms.includes('android')) {
      console.log('\n[Android] Processing gradient splash screen...');
      try {
        const androidGen = new AndroidGradientGenerator(projectRoot);
        
        // Generate drawable
        console.log('[Android] Generating drawable XML...');
        androidGen.generateDrawable(splashGradient, 'splash_gradient_bg');
        
        // Generate layout
        console.log('[Android] Generating splash layout...');
        androidGen.generateSplashLayout(splashGradient);
        
        // Update manifest
        console.log('[Android] Updating AndroidManifest.xml...');
        androidGen.updateManifestWithGradient(splashGradient);
        
        console.log('[Android] ✓ Gradient splash screen configured successfully');
      } catch (error) {
        console.error('[Android] ✗ Error processing gradient:', error.message);
        console.warn('[Android] Falling back to solid color');
      }
    }
    
    // Process iOS gradient
    if (platforms.includes('ios')) {
      console.log('\n[iOS] Processing gradient splash screen...');
      try {
        const iosGen = new IOSGradientGenerator(projectRoot);
        
        // Generate images
        console.log('[iOS] Generating splash images...');
        const images = iosGen.generateSplashImages(splashGradient);
        
        // Generate Contents.json
        console.log('[iOS] Generating Contents.json...');
        iosGen.generateContentsJson();
        
        console.log('[iOS] ✓ Gradient splash screen configured successfully');
      } catch (error) {
        console.error('[iOS] ✗ Error processing gradient:', error.message);
        console.warn('[iOS] Falling back to solid color');
      }
    }
    
    console.log('\n[Splash Screen] ✓ All platforms configured');
    console.log('[Splash Screen] Completed successfully\n');
    
  } catch (error) {
    console.error('[Splash Screen] Fatal error:', error);
    throw error;
  }
};

/**
 * Extract preferences from config.xml
 */
function getPreferences(ctx) {
  try {
    const ConfigParser = ctx.requireCordovaModule('cordova-lib').configparser.ConfigParser;
    const configPath = path.join(ctx.opts.projectRoot, 'config.xml');
    
    const cfgFile = new ConfigParser(configPath);
    const preferences = {};
    
    // Get global preferences
    const globalPrefs = cfgFile.getGlobalPreferences();
    for (const key in globalPrefs) {
      preferences[key] = globalPrefs[key];
    }
    
    return preferences;
  } catch (error) {
    console.error('[Splash Screen] Error reading config.xml:', error.message);
    return {};
  }
}
