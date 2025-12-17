#!/usr/bin/env node

/**
 * Auto-Install Dependencies Script
 * 
 * This script automatically installs required dependencies if not already present:
 * - better-sqlite3 (required for build info database)
 * - sharp (recommended for fast icon generation)
 * - jimp (fallback icon processor)
 * 
 * Runs at: pre-build stage (before_prepare hook)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color codes for console output
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

function checkPackageInstalled(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch (e) {
    return false;
  }
}

function getInstalledVersion(packageName) {
  try {
    const packageJson = require(path.join(process.cwd(), 'node_modules', packageName, 'package.json'));
    return packageJson.version;
  } catch (e) {
    return null;
  }
}

function installPackage(packageName, version = '') {
  const versionStr = version ? `@${version}` : '';
  const installCmd = `npm install ${packageName}${versionStr} --save-dev`;
  
  try {
    log(colors.blue, `  ⏳ Installing ${packageName}...`);
    execSync(installCmd, { stdio: 'pipe' });
    return true;
  } catch (error) {
    log(colors.red, `  ❌ Failed to install ${packageName}`);
    return false;
  }
}

function main() {
  const projectRoot = process.cwd();
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    log(colors.yellow, '⚠️  No package.json found. Skipping auto-install.');
    return;
  }
  
  log(colors.bright + colors.blue, '\n╔════════════════════════════════════════════════════════════╗');
  log(colors.bright + colors.blue, '║   Auto-Install Dependencies (cordova-plugin-change-app-info) ║');
  log(colors.bright + colors.blue, '╚════════════════════════════════════════════════════════════╝\n');
  
  // Dependencies to check
  const dependencies = [
    {
      name: 'better-sqlite3',
      version: '^9.0.0',
      type: 'REQUIRED',
      description: 'Build-time database generation',
      required: true
    },
    {
      name: 'sharp',
      version: '^0.33.0',
      type: 'OPTIONAL',
      description: 'Fast icon generation (recommended)',
      required: false
    },
    {
      name: 'jimp',
      version: '^0.22.0',
      type: 'OPTIONAL',
      description: 'Fallback icon processor (if sharp fails)',
      required: false
    }
  ];
  
  let installed = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const dep of dependencies) {
    const isInstalled = checkPackageInstalled(dep.name);
    const installedVersion = getInstalledVersion(dep.name);
    
    log(colors.reset, `\n📦 ${dep.name}`);
    log(colors.reset, `   Type: ${dep.type} - ${dep.description}`);
    
    if (isInstalled) {
      log(colors.green, `   ✅ Already installed (v${installedVersion})`);
      skipped++;
    } else {
      if (dep.required) {
        log(colors.yellow, `   ⚠️  REQUIRED but not found. Installing...`);
      } else {
        log(colors.yellow, `   ⚠️  Optional but recommended. Installing...`);
      }
      
      const success = installPackage(dep.name, dep.version);
      if (success) {
        const version = getInstalledVersion(dep.name);
        log(colors.green, `   ✅ Successfully installed (v${version})`);
        installed++;
      } else {
        log(colors.red, `   ❌ Installation failed`);
        if (dep.required) {
          log(colors.red, `   ⚠️  WARNING: This is REQUIRED for the build to succeed!`);
          failed++;
        } else {
          log(colors.yellow, `   💡 Continuing without this package...`);
        }
      }
    }
  }
  
  // Summary
  log(colors.reset, '\n' + '═'.repeat(60));
  log(colors.bright + colors.blue, 'Summary:');
  log(colors.green, `  ✅ Already installed: ${skipped}`);
  log(colors.green, `  ✨ Newly installed: ${installed}`);
  if (failed > 0) {
    log(colors.red, `  ❌ Failed: ${failed}`);
  }
  log(colors.reset, '═'.repeat(60));
  
  if (failed > 0) {
    log(colors.red, `\n⚠️  Some REQUIRED dependencies failed to install!`);
    log(colors.red, `   Please run manually: npm install better-sqlite3`);
    log(colors.red, `   Then retry: cordova build android\n`);
    process.exit(1);
  } else {
    log(colors.green, `\n✅ All dependencies ready!\n`);
  }
}

// Run
main();
