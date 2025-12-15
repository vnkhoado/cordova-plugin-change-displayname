#!/usr/bin/env node

/**
 * Force Override Splash Color Hook
 * 
 * This hook runs at before_compile stage (AFTER OutSystems merges config)
 * to ensure splash color preferences are not overridden by OutSystems theme.
 * 
 * Problem: OutSystems injects theme colors after plugin config merge
 * Solution: Force override config.xml right before compilation
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

function forceOverrideConfigXml(context, platform, targetColor) {
  const root = context.opts.projectRoot;
  const configPath = path.join(root, `platforms/${platform}/res/xml/config.xml`);
  
  // Android uses res/xml/config.xml
  const androidConfigPath = path.join(root, `platforms/${platform}/app/src/main/res/xml/config.xml`);
  
  let finalConfigPath = configPath;
  if (platform === 'android' && fs.existsSync(androidConfigPath)) {
    finalConfigPath = androidConfigPath;
  }
  
  if (!fs.existsSync(finalConfigPath)) {
    console.log(`   ⚠ Config not found at: ${finalConfigPath}`);
    return false;
  }
  
  let configContent = fs.readFileSync(finalConfigPath, 'utf8');
  let updated = false;
  
  // Force override all splash-related color preferences
  const colorPreferences = [
    'BackgroundColor',
    'SplashScreenBackgroundColor',
    'AndroidWindowSplashScreenBackground'
  ];
  
  colorPreferences.forEach(prefName => {
    const regex = new RegExp(
      `<preference\\s+name="${prefName}"\\s+value="[^"]*"\\s*/>`,
      'g'
    );
    
    if (configContent.match(regex)) {
      configContent = configContent.replace(
        regex,
        `<preference name="${prefName}" value="${targetColor}" />`
      );
      console.log(`   ✓ Force overrode ${prefName}`);
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(finalConfigPath, configContent, 'utf8');
    console.log(`   ✅ Updated config: ${finalConfigPath}`);
  }
  
  return updated;
}

function forceOverrideAndroidColors(context, targetColor) {
  const root = context.opts.projectRoot;
  
  // Force override colors.xml
  const colorsPath = path.join(
    root,
    'platforms/android/app/src/main/res/values/colors.xml'
  );
  
  if (!fs.existsSync(colorsPath)) {
    console.log(`   ⚠ colors.xml not found`);
    return false;
  }
  
  let colors = fs.readFileSync(colorsPath, 'utf8');
  let updated = false;
  
  // Override ALL color resources that might affect splash
  const colorNames = [
    'colorPrimary',
    'colorPrimaryDark',
    'splash_background',
    'background'
  ];
  
  colorNames.forEach(colorName => {
    const regex = new RegExp(
      `<color name="${colorName}">[^<]*</color>`,
      'g'
    );
    
    if (colors.match(regex)) {
      colors = colors.replace(
        regex,
        `<color name="${colorName}">${targetColor}</color>`
      );
      console.log(`   ✓ Force overrode color: ${colorName}`);
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(colorsPath, colors, 'utf8');
    console.log(`   ✅ Updated colors.xml`);
  }
  
  return updated;
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  // Get target color from preferences
  let targetColor = config.getPreference("SplashScreenBackgroundColor") ||
                    config.getPreference("AndroidWindowSplashScreenBackground") ||
                    config.getPreference("BackgroundColor");
  
  if (!targetColor) {
    console.log('\n⏭  No splash color configured, skipping force override');
    return;
  }
  
  // Ensure # prefix
  if (!targetColor.startsWith('#')) {
    targetColor = '#' + targetColor;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  🔒 FORCE OVERRIDE SPLASH COLOR (before_compile)');
  console.log('══════════════════════════════════════════════');
  console.log(`Target Color: ${targetColor}`);
  console.log('Stage: RIGHT BEFORE COMPILATION');
  console.log('Purpose: Prevent OutSystems theme override\n');
  
  for (const platform of platforms) {
    if (platform !== 'android' && platform !== 'ios') continue;
    
    console.log(`📱 Processing ${platform}...`);
    
    try {
      // 1. Force override config.xml in platform folder
      forceOverrideConfigXml(context, platform, targetColor);
      
      // 2. Force override colors.xml (Android only)
      if (platform === 'android') {
        forceOverrideAndroidColors(context, targetColor);
      }
      
    } catch (error) {
      console.error(`\n❌ Error forcing override:`, error.message);
    }
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('✅ Force override completed!');
  console.log('   OutSystems cannot override after this point');
  console.log('══════════════════════════════════════════════\n');
};
