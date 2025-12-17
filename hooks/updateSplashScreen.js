#!/usr/bin/env node

/**
 * Hook for updating splash screen with gradient support
 * This hook is called before build to process SPLASH_GRADIENT configuration
 * 
 * Priority:
 * 1. If SPLASH_GRADIENT exists → Generate gradient splash
 * 2. If SPLASH_GRADIENT missing → Skip (don't override existing SplashScreenBackgroundColor)
 * 3. Only affects gradient generation, leaves other splash configs untouched
 */

const fs = require('fs');
const path = require('path');
const GradientParser = require('./gradient-parser');
const AndroidGradientGenerator = require('./android/gradient-generator');
const IOSGradientGenerator = require('./ios/gradient-generator');
const utils = require('./utils');

// IMPORTANT: This must be async to properly handle iOS image generation
module.exports = async function(ctx) {
  console.log('\n[Splash Screen] Starting splash screen configuration...');
  
  try {
    const projectRoot = ctx.opts.projectRoot;
    const platforms = ctx.opts.cordova.platforms;
    
    // Get preferences from config.xml
    const preferences = getPreferences(ctx, projectRoot);
    
    console.log('[Splash Screen] Detected platforms:', platforms.join(', '));
    console.log('[Splash Screen] Configuration loaded');
    
    // Check for gradient preference
    const splashGradient = preferences.SPLASH_GRADIENT;
    const splashBackgroundColor = preferences.SplashScreenBackgroundColor || preferences.BackgroundColor;
    
    if (!splashGradient) {
      console.log('[Splash Screen] No SPLASH_GRADIENT preference found');
      if (splashBackgroundColor) {
        console.log('[Splash Screen] Using existing SplashScreenBackgroundColor:', splashBackgroundColor);
      }
      console.log('[Splash Screen] Skipping gradient splash generation (normal splash screen will be used)');
      return;
    }
    
    console.log('[Splash Screen] Found SPLASH_GRADIENT preference');
    console.log('[Splash Screen] Value:', splashGradient.substring(0, 60) + '...');
    
    if (splashBackgroundColor) {
      console.log('[Splash Screen] Note: SplashScreenBackgroundColor will be overridden by gradient');
    }
    
    // Validate gradient format
    if (!GradientParser.isValid(splashGradient)) {
      console.warn('[Splash Screen] ⚠️  Invalid gradient format');
      console.log('[Splash Screen] Skipping gradient (existing splash screen will be used)');
      return;
    }
    
    // Parse gradient
    const parsed = GradientParser.parse(splashGradient);
    if (!parsed) {
      console.warn('[Splash Screen] ⚠️  Failed to parse gradient');
      console.log('[Splash Screen] Skipping gradient (existing splash screen will be used)');
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
        console.warn('[Android] ⚠️  Falling back to existing splash screen');
      }
    }
    
    // Process iOS gradient - MUST USE AWAIT!
    if (platforms.includes('ios')) {
      console.log('\n[iOS] Processing gradient splash screen...');
      try {
        const iosGen = new IOSGradientGenerator(projectRoot);
        
        // Generate images - WAIT for this to complete!
        console.log('[iOS] Generating splash images...');
        const images = await iosGen.generateSplashImages(splashGradient);
        
        if (!images || images.length === 0) {
          console.warn('[iOS] ⚠️  No images were generated');
          throw new Error('Image generation returned no results');
        }
        
        console.log(`[iOS] ✓ Generated ${images.length} splash images`);
        
        // Generate Contents.json
        console.log('[iOS] Generating Contents.json...');
        iosGen.generateContentsJson();
        
        console.log('[iOS] ✓ Gradient splash screen configured successfully');
      } catch (error) {
        console.error('[iOS] ✗ Error processing gradient:', error.message);
        console.warn('[iOS] ⚠️  Falling back to existing splash screen');
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
 * Extract preferences from config.xml using utils helper
 * 
 * Priority for config reading:
 * 1. Use utils.getConfigParser() - Official Cordova way
 * 2. Fallback to direct XML parsing if ConfigParser fails
 * 3. Return empty object if all methods fail (graceful degradation)
 */
function getPreferences(ctx, projectRoot) {
  try {
    // Use utils.getConfigParser which handles ConfigParser correctly
    const config = utils.getConfigParser(ctx);
    const preferences = {};
    
    // Get all relevant preferences
    try {
      const possibleKeys = [
        'SPLASH_GRADIENT',
        'SplashGradient',
        'splashGradient',
        'SplashScreenBackgroundColor',
        'BackgroundColor',
        'WEBVIEW_BACKGROUND_COLOR'
      ];
      
      for (const key of possibleKeys) {
        const value = config.getPreference(key);
        if (value) {
          preferences[key] = value;
          // Normalize gradient keys
          if (key === 'splashGradient' || key === 'SplashGradient') {
            preferences['SPLASH_GRADIENT'] = value;
          }
        }
      }
    } catch (err) {
      console.warn('[Splash Screen] Could not read preferences from ConfigParser:', err.message);
    }
    
    return preferences;
  } catch (error) {
    console.error('[Splash Screen] Error reading config.xml:', error.message);
    console.warn('[Splash Screen] Attempting fallback config read...');
    
    // Fallback: Read config.xml directly
    try {
      const configPath = path.join(projectRoot, 'config.xml');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const preferences = {};
        
        // Parse preferences using regex
        const preferenceRegex = /name=['"]([^'"]+)['"]\s+value=['"]([^'"]+)['"]|\/>/g;
        let match;
        
        while ((match = preferenceRegex.exec(configContent)) !== null) {
          if (match[1] && match[2]) {
            preferences[match[1]] = match[2];
          }
        }
        
        console.log('[Splash Screen] ✓ Successfully read config via fallback XML parsing');
        return preferences;
      }
    } catch (fallbackErr) {
      console.error('[Splash Screen] Fallback config read also failed:', fallbackErr.message);
    }
    
    console.warn('[Splash Screen] ⚠️  Could not read config.xml, proceeding with defaults');
    return {};
  }
}
