#!/usr/bin/env node

/**
 * Auto-install gradient splash screen dependencies
 * 
 * This script automatically installs optional dependencies needed for
 * gradient splash screen support:
 * - sharp: Fast image processing (recommended)
 * - jimp: Fallback image processor (pure JavaScript)
 * 
 * Run manually:
 *   node scripts/install-gradient-deps.js
 * 
 * Or via npm:
 *   npm run setup:gradient
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = process.cwd();
const packageJsonPath = path.join(projectRoot, 'package.json');

console.log('\n========================================');
console.log('Gradient Splash Screen - Dependency Installer');
console.log('========================================\n');

try {
  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    console.error('ERROR: package.json not found at', packageJsonPath);
    process.exit(1);
  }

  console.log('[1/3] Checking Node.js version...');
  const nodeVersion = process.versions.node;
  console.log('      Node.js version:', nodeVersion);
  if (parseInt(nodeVersion.split('.')[0]) < 14) {
    console.error('ERROR: Node.js 14+ required');
    process.exit(1);
  }
  console.log('      ✓ Node.js version OK\n');

  console.log('[2/3] Installing sharp (image processing)...');
  try {
    execSync('npm install sharp --save-optional', { stdio: 'inherit' });
    console.log('      ✓ sharp installed successfully\n');
  } catch (err) {
    console.warn('      ⚠ sharp installation failed (will use jimp fallback)\n');
  }

  console.log('[3/3] Installing jimp (fallback processor)...');
  try {
    execSync('npm install jimp --save-optional', { stdio: 'inherit' });
    console.log('      ✓ jimp installed successfully\n');
  } catch (err) {
    console.error('ERROR: Failed to install jimp');
    process.exit(1);
  }

  console.log('========================================');
  console.log('✓ Gradient splash screen dependencies installed!');
  console.log('========================================\n');
  console.log('Next steps:');
  console.log('1. Add to config.xml:');
  console.log('   <preference name="SPLASH_GRADIENT"');
  console.log('     value="linear-gradient(64.28deg, #001833 0%, #004390 100%)" />');
  console.log('');
  console.log('2. Build your app:');
  console.log('   cordova build android ios');
  console.log('');
  console.log('The gradient splash screen will be generated automatically!\n');

} catch (error) {
  console.error('ERROR:', error.message);
  process.exit(1);
}
