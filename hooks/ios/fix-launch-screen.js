#!/usr/bin/env node

/**
 * iOS LaunchScreen.storyboard Fixer
 * 
 * Problem: iOS may use LaunchScreen.storyboard instead of splash images
 * Solution: Remove or disable LaunchScreen.storyboard references
 * 
 * When both exist, iOS prioritizes storyboard over image assets
 * This hook ensures splash images from splash.imageset are used
 */

const fs = require('fs');
const path = require('path');

function fixLaunchScreen(ctx) {
  const projectRoot = ctx.opts.projectRoot;
  const platformsPath = path.join(projectRoot, 'platforms/ios');

  if (!fs.existsSync(platformsPath)) {
    console.log('[iOS LaunchScreen] iOS platform not found');
    return;
  }

  try {
    // Find app directory
    const dirs = fs.readdirSync(platformsPath);
    const appDir = dirs.find(d => !d.startsWith('.') && !d.includes('.xcodeproj'));

    if (!appDir) {
      console.log('[iOS LaunchScreen] App directory not found');
      return;
    }

    const appPath = path.join(platformsPath, appDir);
    const infoPlistPath = path.join(appPath, 'Info.plist');

    if (!fs.existsSync(infoPlistPath)) {
      console.log('[iOS LaunchScreen] Info.plist not found');
      return;
    }

    let plistContent = fs.readFileSync(infoPlistPath, 'utf8');
    const originalContent = plistContent;

    // Check if LaunchScreen.storyboard exists
    const launchScreenPath = path.join(appPath, 'Base.lproj/LaunchScreen.storyboard');
    const hasLaunchScreen = fs.existsSync(launchScreenPath);

    if (hasLaunchScreen) {
      console.log('[iOS LaunchScreen] Found LaunchScreen.storyboard');
      
      // Remove UILaunchStoryboardName to use splash images instead
      const launchStoryboardPattern = /<key>UILaunchStoryboardName<\/key>\s*<string>[^<]*<\/string>/g;
      
      if (launchStoryboardPattern.test(plistContent)) {
        plistContent = plistContent.replace(launchStoryboardPattern, '<!-- Removed UILaunchStoryboardName to use splash images -->');
        console.log('[iOS LaunchScreen] ✓ Removed UILaunchStoryboardName from Info.plist');
      }

      // Alternative: Add UILaunchImages (deprecated but sometimes needed)
      if (!plistContent.includes('UILaunchImages')) {
        // Info.plist may now use LaunchScreen or splash.imageset
        console.log('[iOS LaunchScreen] Splash images will be used from splash.imageset');
      }
    } else {
      console.log('[iOS LaunchScreen] LaunchScreen.storyboard not found (using splash images)');
    }

    // Write back if changed
    if (plistContent !== originalContent) {
      fs.writeFileSync(infoPlistPath, plistContent, 'utf8');
      console.log('[iOS LaunchScreen] ✓ Updated Info.plist');
    }

  } catch (error) {
    console.error('[iOS LaunchScreen] Error:', error.message);
  }
}

module.exports = fixLaunchScreen;
