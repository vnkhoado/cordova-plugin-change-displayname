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
const {
  getConfigParser,
  getBackgroundColorPreference,
  hexToSwiftUIColor,
  hexToObjCUIColor,
  findFile,
  logSection,
  logSectionComplete
} = require('./utils');

function findAppDelegateSwift(iosPath) {
  return findFile(iosPath, ['AppDelegate.swift'], 3);
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
    
    const colorCode = hexToObjCUIColor(backgroundColor);
    
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

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  if (!platforms.includes('ios')) {
    return;
  }
  
  const root = context.opts.projectRoot;
  const config = getConfigParser(context, path.join(root, 'config.xml'));
  
  const backgroundColor = getBackgroundColorPreference(config);
  
  if (!backgroundColor) {
    console.log('\n⏭️  No background color configured, skipping iOS background fix injection');
    return;
  }
  
  logSection('💉 INJECT iOS BACKGROUND COLOR FIX');
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
  const mainViewControllerPath = findFile(iosPath, ['MainViewController.m'], 3);
  
  if (mainViewControllerPath) {
    console.log(`   ✓ Found: ${path.relative(iosPath, mainViewControllerPath)}`);
    if (injectObjCBackgroundFix(mainViewControllerPath, backgroundColor)) {
      injected = true;
    }
  } else {
    console.log('   ⚠️  MainViewController.m not found');
  }
  
  if (injected) {
    logSectionComplete('✅ iOS background fix injection completed!');
  } else {
    logSectionComplete('⚠️  No files were modified');
  }
};