#!/usr/bin/env node

/**
 * Native iOS Gradient Splash Screen Hook
 * 
 * Creates actual gradient image for native iOS splash screen
 * (not just CSS - real native gradient that shows at app launch)
 * 
 * How it works:
 * 1. Read SPLASH_GRADIENT from config
 * 2. Generate gradient image using sharp
 * 3. Save as LaunchImage.png in Assets
 * 4. Update storyboard to use image instead of solid color
 * 5. Result: Real gradient splash from app start!
 * 
 * Runs at: before_compile stage
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getConfigParser } = require('../utils');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Parse CSS gradient to SVG or canvas gradient
 * Supports: linear-gradient, radial-gradient
 */
function parseGradientToImage(gradientStr, width, height) {
  // Example: "linear-gradient(64.28deg, #001833 0%, #004390 100%)"
  // Or: "radial-gradient(circle, #001833 0%, #004390 100%)"
  
  const linearMatch = gradientStr.match(/linear-gradient\s*\(([^,]+),\s*([^\)]+)\)/);
  const radialMatch = gradientStr.match(/radial-gradient\s*\(([^,]+),\s*([^\)]+)\)/);
  
  if (linearMatch) {
    const angleStr = linearMatch[1].trim();
    const colorsStr = linearMatch[2];
    const angle = parseFloat(angleStr);
    
    // Parse color stops: "#001833 0%, #004390 100%"
    const stops = [];
    const colorMatches = colorsStr.match(/(#[0-9a-f]{6})\s+(\d+)%/gi);
    if (colorMatches) {
      colorMatches.forEach(match => {
        const [, color, percent] = match.match(/(#[0-9a-f]{6})\s+(\d+)%/i);
        stops.push({ color, percent: parseInt(percent) });
      });
    }
    
    return createLinearGradientSVG(width, height, angle, stops);
  } else if (radialMatch) {
    const colorsStr = radialMatch[2];
    const stops = [];
    const colorMatches = colorsStr.match(/(#[0-9a-f]{6})\s+(\d+)%/gi);
    if (colorMatches) {
      colorMatches.forEach(match => {
        const [, color, percent] = match.match(/(#[0-9a-f]{6})\s+(\d+)%/i);
        stops.push({ color, percent: parseInt(percent) });
      });
    }
    
    return createRadialGradientSVG(width, height, stops);
  }
  
  return null;
}

function createLinearGradientSVG(width, height, angle, stops) {
  // Convert angle to radians
  const rad = (angle * Math.PI) / 180;
  
  // Calculate gradient line endpoints
  const cx = width / 2;
  const cy = height / 2;
  const dist = Math.sqrt(width * width + height * height) / 2;
  
  const x1 = cx - dist * Math.cos(rad);
  const y1 = cy - dist * Math.sin(rad);
  const x2 = cx + dist * Math.cos(rad);
  const y2 = cy + dist * Math.sin(rad);
  
  // Build SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs><linearGradient id="grad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">`;
  
  stops.forEach(stop => {
    svg += `<stop offset="${stop.percent}%" stop-color="${stop.color}" />`;
  });
  
  svg += `</linearGradient></defs>`;
  svg += `<rect width="${width}" height="${height}" fill="url(#grad)" />`;
  svg += `</svg>`;
  
  return svg;
}

function createRadialGradientSVG(width, height, stops) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(width * width + height * height) / 2;
  
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs><radialGradient id="grad" cx="${cx}" cy="${cy}" r="${radius}" gradientUnits="userSpaceOnUse">`;
  
  stops.forEach(stop => {
    svg += `<stop offset="${stop.percent}%" stop-color="${stop.color}" />`;
  });
  
  svg += `</radialGradient></defs>`;
  svg += `<rect width="${width}" height="${height}" fill="url(#grad)" />`;
  svg += `</svg>`;
  
  return svg;
}

async function createNativeGradientSplash(context) {
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  const gradientValue = config.getPreference('SPLASH_GRADIENT');
  
  if (!gradientValue) {
    log(colors.yellow, '⚠️  SPLASH_GRADIENT not set, skipping native gradient');
    return;
  }
  
  log(colors.bright + colors.blue, '\n╔═══════════════════════════════════════════════════════════╗');
  log(colors.bright + colors.blue, '║      Creating Native Gradient Splash Screen                ║');
  log(colors.bright + colors.blue, '╚═══════════════════════════════════════════════════════════╝\n');
  
  log(colors.reset, '🎨 Gradient Configuration:');
  log(colors.green, `   ✅ Gradient: ${gradientValue}`);
  
  const iosPlatformPath = path.join(root, 'platforms/ios');
  if (!fs.existsSync(iosPlatformPath)) {
    log(colors.yellow, '\n⚠️  iOS platform not found');
    return;
  }
  
  // Find project name
  const iosFiles = fs.readdirSync(iosPlatformPath);
  const projectDir = iosFiles.find(f => {
    const fullPath = path.join(iosPlatformPath, f);
    return fs.statSync(fullPath).isDirectory() && f !== 'build' && !f.startsWith('.');
  });
  
  if (!projectDir) {
    log(colors.yellow, '⚠️  iOS project directory not found');
    return;
  }
  
  log(colors.reset, `\n🔧 Processing: ${projectDir}`);
  
  try {
    // 1. Generate gradient SVG
    log(colors.reset, '\n🎨 Generating gradient image:');
    const svgGradient = parseGradientToImage(gradientValue, 1024, 1024);
    
    if (!svgGradient) {
      throw new Error('Could not parse gradient');
    }
    
    log(colors.green, '   ✅ Generated SVG gradient');
    
    // 2. Convert SVG to PNG using sharp
    log(colors.reset, '📸 Converting to PNG:');
    
    const buffer = await sharp(Buffer.from(svgGradient))
      .png()
      .toBuffer();
    
    log(colors.green, `   ✅ PNG created (${Math.round(buffer.length / 1024)}KB)`);
    
    // 3. Save as LaunchImage
    const assetsPath = path.join(iosPlatformPath, projectDir, 'Assets.xcassets');
    const launchImagePath = path.join(assetsPath, 'LaunchImage.imageset');
    
    log(colors.reset, '💾 Saving to Assets:');
    
    if (!fs.existsSync(launchImagePath)) {
      fs.mkdirSync(launchImagePath, { recursive: true });
      log(colors.green, '   ✅ Created LaunchImage.imageset folder');
    }
    
    // Save PNG
    fs.writeFileSync(path.join(launchImagePath, 'LaunchImage.png'), buffer);
    log(colors.green, '   ✅ Saved LaunchImage.png');
    
    // Create Contents.json for asset
    const contentsJson = {
      "images" : [
        {
          "idiom" : "universal",
          "filename" : "LaunchImage.png",
          "scale" : "1x"
        }
      ],
      "info" : {
        "version" : 1,
        "author" : "cordova-plugin-change-app-info"
      }
    };
    
    fs.writeFileSync(
      path.join(launchImagePath, 'Contents.json'),
      JSON.stringify(contentsJson, null, 2)
    );
    log(colors.green, '   ✅ Created Contents.json');
    
    // 4. Update storyboard to use image
    log(colors.reset, '\n📄 Updating storyboard:');
    const storyboardPath = path.join(iosPlatformPath, projectDir, 'CDVLaunchScreen.storyboard');
    
    if (fs.existsSync(storyboardPath)) {
      let storyboardContent = fs.readFileSync(storyboardPath, 'utf8');
      
      // Add LaunchImage image set reference
      if (!storyboardContent.includes('LaunchImage')) {
        // Find imageView and set image
        storyboardContent = storyboardContent.replace(
          /<imageView[^>]*>/,
          match => match.replace(/image="[^"]*"/, 'image="LaunchImage"')
        );
        
        if (!storyboardContent.includes('image="LaunchImage"')) {
          // If no imageView, add one
          storyboardContent = storyboardContent.replace(
            /<view[^>]*key="view"[^>]*>/,
            match => match + `<imageView userInteractionEnabled="NO" contentMode="scaleAspectFill" image="LaunchImage" translatesAutoresizingMaskIntoConstraints="NO" id="XXX"><rect key="frame" x="0.0" y="0.0" width="320" height="667"/></imageView>`
          );
        }
        
        fs.writeFileSync(storyboardPath, storyboardContent);
        log(colors.green, '   ✅ Updated CDVLaunchScreen.storyboard');
      } else {
        log(colors.green, '   ✅ Storyboard already configured');
      }
    }
    
    log(colors.reset, '\n' + '═'.repeat(60));
    log(colors.bright + colors.green, '✅ Native Gradient Splash Created!\n');
    log(colors.yellow, '📌 Result:');
    log(colors.yellow, '   • Gradient image generated from CSS');
    log(colors.yellow, '   • Saved to LaunchImage.imageset');
    log(colors.yellow, '   • Will display immediately at app launch');
    log(colors.yellow, '   • Real native gradient (not HTML)\n');
    
  } catch (error) {
    log(colors.red, `\n❌ Error creating gradient: ${error.message}`);
    log(colors.yellow, '   Falling back to solid color splash');
  }
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  if (!platforms || !platforms.includes('ios')) {
    return;
  }
  
  // Run async function
  return createNativeGradientSplash(context);
};
