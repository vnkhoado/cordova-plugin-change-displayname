#!/usr/bin/env node

/**
 * Inject iOS Background Color Fix
 * 
 * Automatically injects Swift code into AppDelegate to fix
 * the "old color flashing" issue by setting window background
 * color as early as possible in the app lifecycle.
 */

const fs = require('fs');
const path = require('path');
const { getConfigParser } = require('./utils');

function hexToSwiftUIColor(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255.0;
  const g = parseInt(hex.substring(2, 4), 16) / 255.0;
  const b = parseInt(hex.substring(4, 6), 16) / 255.0;
  return `UIColor(red: ${r.toFixed(3)}, green: ${g.toFixed(3)}, blue: ${b.toFixed(3)}, alpha: 1.0)`;
}

function findAppDelegateSwift(iosPath) {
  function searchDir(dir, depth = 0) {
    if (depth > 3) return null;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        if (item === 'AppDelegate.swift') {
          return path.join(dir, item);
        }
        
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory() && 
            !['node_modules', 'build', 'Pods', '.git'].includes(item)) {
          const found = searchDir(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Skip permission errors
    }
    
    return null;
  }
  
  return searchDir(iosPath);
}

function injectSwiftBackgroundFix(appDelegatePath, backgroundColor) {
  console.log(`   📝 Injecting background fix into: ${path.basename(appDelegatePath)}`);
  
  try {
    let content = fs.readFileSync(appDelegatePath, 'utf8');
    const original = content;
    
    const colorCode = hexToSwiftUIColor(backgroundColor);
    
    // Check if already injected
    if (content.includes('// PLUGIN: Background color fix')) {
      console.log('   ℹ️  Background fix already injected, updating color...');
      
      // Update existing color
      const regex = /\/\/ PLUGIN: Background color fix[\s\S]*?window\?\.backgroundColor = UIColor\([^)]+\)/g;
      content = content.replace(regex, `// PLUGIN: Background color fix\n        window?.backgroundColor = ${colorCode}`);
      
    } else {
      console.log('   ✨ First time injection...');
      
      // Inject into willFinishLaunchingWithOptions
      const willFinishRegex = /(func application\(_ application: UIApplication,\s*willFinishLaunchingWithOptions[^{]*\{)/;
      
      if (willFinishRegex.test(content)) {
        const injection = `$1\n        // PLUGIN: Background color fix\n        window?.backgroundColor = ${colorCode}`;
        
        content = content.replace(willFinishRegex, injection);
        console.log('   ✅ Injected into willFinishLaunchingWithOptions');
      } else {
        // If willFinishLaunchingWithOptions doesn't exist, create it
        const classRegex = /(class AppDelegate[^{]*\{)/;
        
        if (classRegex.test(content)) {
          const newMethod = `$1\n    \n    func application(_ application: UIApplication, willFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {\n        // PLUGIN: Background color fix\n        window?.backgroundColor = ${colorCode}\n        return true\n    }`;
          
          content = content.replace(classRegex, newMethod);
          console.log('   ✅ Created willFinishLaunchingWithOptions method');
        }
      }
      
      // Also inject into didFinishLaunchingWithOptions
      const didFinishRegex = /(func application\(_ application: UIApplication,\s*didFinishLaunchingWithOptions[^{]*\{)/;
      
      if (didFinishRegex.test(content)) {
        const injection = `$1\n        // PLUGIN: Force background color\n        window?.backgroundColor = ${colorCode}\n        if let rootVC = window?.rootViewController {\n            setBackgroundRecursively(for: rootVC.view, color: ${colorCode})\n        }`;
        
        content = content.replace(didFinishRegex, injection);
        console.log('   ✅ Injected into didFinishLaunchingWithOptions');
        
        // Add helper method if not exists
        if (!content.includes('func setBackgroundRecursively')) {
          const classEndRegex = /(\n}\s*$)/;
          const helperMethod = `\n    // PLUGIN: Helper method to set background recursively\n    private func setBackgroundRecursively(for view: UIView, color: UIColor) {\n        view.backgroundColor = color\n        for subview in view.subviews {\n            setBackgroundRecursively(for: subview, color: color)\n        }\n    }\n$1`;
          
          content = content.replace(classEndRegex, helperMethod);
          console.log('   ✅ Added setBackgroundRecursively helper method');
        }
      }
    }
    
    // Write back if changed
    if (content !== original) {
      fs.writeFileSync(appDelegatePath, content, 'utf8');
      console.log(`   ✅ Successfully injected background fix with color: ${backgroundColor}`);
      return true;
    } else {
      console.log('   ⚠️  No changes needed');
      return false;
    }
    
  } catch (error) {
    console.error(`   ❌ Error injecting fix: ${error.message}`);
    return false;
  }
}

function injectObjCBackgroundFix(mainViewControllerPath, backgroundColor) {
  console.log(`   📝 Injecting background fix into: ${path.basename(mainViewControllerPath)}`);
  
  try {
    let content = fs.readFileSync(mainViewControllerPath, 'utf8');
    const original = content;
    
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255.0;
    const g = parseInt(hex.substring(2, 4), 16) / 255.0;
    const b = parseInt(hex.substring(4, 6), 16) / 255.0;
    
    const colorCode = `[UIColor colorWithRed:${r.toFixed(3)} green:${g.toFixed(3)} blue:${b.toFixed(3)} alpha:1.0]`;
    
    // Check if already has the fix
    if (content.includes('// PLUGIN: Background color fix')) {
      console.log('   ℹ️  Background fix already exists, updating...');
      
      // Update existing
      const regex = /\/\/ PLUGIN: Background color fix[\s\S]*?self\.view\.backgroundColor = \[UIColor[^;]+;/g;
      content = content.replace(regex, `// PLUGIN: Background color fix\n    self.view.backgroundColor = ${colorCode};`);
      
    } else {
      console.log('   ✨ Adding background fix...');
      
      // Inject into viewDidLoad
      const viewDidLoadRegex = /(-\s*\(void\)\s*viewDidLoad\s*\{)/;
      
      if (viewDidLoadRegex.test(content)) {
        const injection = `$1\n    // PLUGIN: Background color fix\n    self.view.backgroundColor = ${colorCode};`;
        
        content = content.replace(viewDidLoadRegex, injection);
        console.log('   ✅ Injected into viewDidLoad');
      }
      
      // Also add to viewWillAppear if exists
      const viewWillAppearRegex = /(-\s*\(void\)\s*viewWillAppear:\s*\(BOOL\)\s*animated\s*\{)/;
      
      if (viewWillAppearRegex.test(content)) {
        const injection = `$1\n    [super viewWillAppear:animated];\n    // PLUGIN: Force background color\n    self.view.backgroundColor = ${colorCode};`;
        
        content = content.replace(viewWillAppearRegex, injection);
        console.log('   ✅ Injected into viewWillAppear');
      } else {
        // Create viewWillAppear if not exists
        const implementationRegex = /(@implementation\s+MainViewController[\s\S]*?)(- \(void\)viewDidLoad)/;
        
        if (implementationRegex.test(content)) {
          const newMethod = `$1\n- (void)viewWillAppear:(BOOL)animated {\n    [super viewWillAppear:animated];\n    // PLUGIN: Force background color\n    self.view.backgroundColor = ${colorCode};\n}\n\n$2`;
          
          content = content.replace(implementationRegex, newMethod);
          console.log('   ✅ Created viewWillAppear method');
        }
      }
    }
    
    if (content !== original) {
      fs.writeFileSync(mainViewControllerPath, content, 'utf8');
      console.log(`   ✅ Successfully injected background fix with color: ${backgroundColor}`);
      return true;
    } else {
      console.log('   ⚠️  No changes needed');
      return false;
    }
    
  } catch (error) {
    console.error(`   ❌ Error injecting fix: ${error.message}`);
    return false;
  }
}

function findFile(baseDir, patterns) {
  function searchDir(dir, depth = 0) {
    if (depth > 3) return null;
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isFile()) {
          for (const pattern of patterns) {
            if (item === pattern || item.endsWith(pattern)) {
              return fullPath;
            }
          }
        } else if (stat.isDirectory()) {
          if (['node_modules', 'build', 'Pods', '.git'].includes(item)) {
            continue;
          }
          const found = searchDir(fullPath, depth + 1);
          if (found) return found;
        }
      }
    } catch (error) {
      // Skip
    }
    
    return null;
  }
  
  return searchDir(baseDir);
}

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  if (!platforms.includes('ios')) {
    return;
  }
  
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  const backgroundColor = config.getPreference("SplashScreenBackgroundColor") ||
                         config.getPreference("BackgroundColor") ||
                         config.getPreference("WEBVIEW_BACKGROUND_COLOR");
  
  if (!backgroundColor) {
    console.log('\n⏭️  No background color configured, skipping iOS background fix injection');
    return;
  }
  
  console.log('\n══════════════════════════════════════════════');
  console.log('  💉 INJECT iOS BACKGROUND COLOR FIX');
  console.log('══════════════════════════════════════════════');
  console.log(`Background Color: ${backgroundColor}`);
  
  const iosPath = path.join(root, 'platforms/ios');
  
  if (!fs.existsSync(iosPath)) {
    console.log('   ⚠️  iOS platform not found');
    return;
  }
  
  let injected = false;
  
  // Try Swift first (AppDelegate.swift)
  console.log('\n   🔍 Looking for AppDelegate.swift...');
  const appDelegatePath = findAppDelegateSwift(iosPath);
  
  if (appDelegatePath) {
    console.log(`   ✓ Found: ${path.relative(iosPath, appDelegatePath)}`);
    if (injectSwiftBackgroundFix(appDelegatePath, backgroundColor)) {
      injected = true;
    }
  } else {
    console.log('   ⚠️  AppDelegate.swift not found (using Objective-C)');
  }
  
  // Also inject into MainViewController.m
  console.log('\n   🔍 Looking for MainViewController.m...');
  const mainViewControllerPath = findFile(iosPath, ['MainViewController.m']);
  
  if (mainViewControllerPath) {
    console.log(`   ✓ Found: ${path.relative(iosPath, mainViewControllerPath)}`);
    if (injectObjCBackgroundFix(mainViewControllerPath, backgroundColor)) {
      injected = true;
    }
  } else {
    console.log('   ⚠️  MainViewController.m not found');
  }
  
  if (injected) {
    console.log('\n══════════════════════════════════════════════');
    console.log('✅ iOS background fix injection completed!');
    console.log('══════════════════════════════════════════════\n');
  } else {
    console.log('\n══════════════════════════════════════════════');
    console.log('⚠️  No files were modified');
    console.log('══════════════════════════════════════════════\n');
  }
};