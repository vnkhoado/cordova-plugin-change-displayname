#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

module.exports = function(context) {
  const platforms = context.opts.platforms;
  
  if (platforms.includes('android')) {
    injectAndroidCode(context);
  }
  
  if (platforms.includes('ios')) {
    injectIOSCode(context);
  }
};

/**
 * Inject CSS loading code into Android MainActivity.java
 */
function injectAndroidCode(context) {
  const projectRoot = context.opts.projectRoot;
  const platformRoot = path.join(projectRoot, 'platforms', 'android');
  
  // Find MainActivity.java
  const mainActivityPath = findMainActivityPath(platformRoot);
  
  if (!mainActivityPath) {
    console.log('⚠️  MainActivity.java not found, skipping Android CSS injection');
    return;
  }
  
  console.log('\n🔧 [CSS-INJECT] Injecting CSS loader into MainActivity.java...\n');
  
  let content = fs.readFileSync(mainActivityPath, 'utf8');
  
  // Check if already injected
  if (content.includes('// CSS Injector Code')) {
    console.log('ℹ️  CSS loader already injected in MainActivity.java');
    return;
  }
  
  // Add import statements
  if (!content.includes('import android.webkit.WebViewClient;')) {
    content = content.replace(
      /(package\s+[^;]+;)/,
      '$1\n\nimport android.webkit.WebView;\nimport android.webkit.WebViewClient;'
    );
  }
  
  // Find onCreate method and inject WebViewClient setup
  const onCreateRegex = /(public\s+void\s+onCreate\s*\([^)]*\)\s*{[^}]*super\.onCreate\([^)]*\);)/;
  
  const injectionCode = `
        
        // CSS Injector Code - Auto-injected by cordova-plugin-change-app-info
        setupCSSInjector();
    `;
  
  if (onCreateRegex.test(content)) {
    content = content.replace(onCreateRegex, '$1' + injectionCode);
  }
  
  // Add setupCSSInjector method before last closing brace
  const setupMethod = `
    /**
     * Setup CSS Injector
     * Auto-injected by cordova-plugin-change-app-info
     */
    private void setupCSSInjector() {
        // CSS injection is handled by CSSInjector plugin
        // This placeholder ensures compatibility
        android.util.Log.d("MainActivity", "CSS Injector ready");
    }
`;
  
  // Insert before last closing brace
  const lastBraceIndex = content.lastIndexOf('}');
  content = content.substring(0, lastBraceIndex) + setupMethod + content.substring(lastBraceIndex);
  
  fs.writeFileSync(mainActivityPath, content, 'utf8');
  console.log('✅ CSS loader injected into MainActivity.java\n');
}

/**
 * Inject CSS loading code into iOS AppDelegate
 */
function injectIOSCode(context) {
  const projectRoot = context.opts.projectRoot;
  const platformRoot = path.join(projectRoot, 'platforms', 'ios');
  
  // Find AppDelegate.m or AppDelegate.swift
  const appDelegatePath = findAppDelegatePath(platformRoot);
  
  if (!appDelegatePath) {
    console.log('⚠️  AppDelegate not found, skipping iOS CSS injection');
    return;
  }
  
  console.log('\n🔧 [CSS-INJECT] Injecting CSS loader into AppDelegate...\n');
  
  let content = fs.readFileSync(appDelegatePath, 'utf8');
  
  // Check if already injected
  if (content.includes('// CSS Injector Code')) {
    console.log('ℹ️  CSS loader already injected in AppDelegate');
    return;
  }
  
  const isSwift = appDelegatePath.endsWith('.swift');
  
  if (isSwift) {
    // Swift injection
    const didFinishLaunchingRegex = /(func\s+application\([^)]+didFinishLaunchingWithOptions[^)]+\)\s*->\s*Bool\s*{)/;
    
    const injectionCode = `
        
        // CSS Injector Code - Auto-injected by cordova-plugin-change-app-info
        setupCSSInjector()
    `;
    
    if (didFinishLaunchingRegex.test(content)) {
      content = content.replace(didFinishLaunchingRegex, '$1' + injectionCode);
    }
    
    // Add setup method
    const setupMethod = `
    /**
     * Setup CSS Injector
     * Auto-injected by cordova-plugin-change-app-info
     */
    private func setupCSSInjector() {
        // CSS injection is handled by CSSInjector plugin
        print("CSS Injector ready")
    }
`;
    
    const lastBraceIndex = content.lastIndexOf('}');
    content = content.substring(0, lastBraceIndex) + setupMethod + content.substring(lastBraceIndex);
    
  } else {
    // Objective-C injection
    const didFinishLaunchingRegex = /(-\s*\(BOOL\)application:\(UIApplication\s*\*\)application\s+didFinishLaunchingWithOptions:\(NSDictionary\s*\*\)launchOptions\s*{)/;
    
    const injectionCode = `
    
    // CSS Injector Code - Auto-injected by cordova-plugin-change-app-info
    [self setupCSSInjector];
    `;
    
    if (didFinishLaunchingRegex.test(content)) {
      content = content.replace(didFinishLaunchingRegex, '$1' + injectionCode);
    }
    
    // Add setup method
    const setupMethod = `
/**
 * Setup CSS Injector
 * Auto-injected by cordova-plugin-change-app-info
 */
- (void)setupCSSInjector {
    // CSS injection is handled by CSSInjector plugin
    NSLog(@"CSS Injector ready");
}
`;
    
    const endIndex = content.lastIndexOf('@end');
    if (endIndex > 0) {
      content = content.substring(0, endIndex) + setupMethod + content.substring(endIndex);
    }
  }
  
  fs.writeFileSync(appDelegatePath, content, 'utf8');
  console.log('✅ CSS loader injected into AppDelegate\n');
}

/**
 * Find MainActivity.java path
 */
function findMainActivityPath(platformRoot) {
  const searchPaths = [
    path.join(platformRoot, 'app/src/main/java/**/MainActivity.java'),
    path.join(platformRoot, 'src/**/MainActivity.java')
  ];
  
  for (const pattern of searchPaths) {
    const files = glob(pattern, platformRoot);
    if (files.length > 0) {
      return files[0];
    }
  }
  
  return null;
}

/**
 * Find AppDelegate path
 */
function findAppDelegatePath(platformRoot) {
  const projectName = getIOSProjectName(platformRoot);
  
  if (!projectName) return null;
  
  const searchPaths = [
    path.join(platformRoot, projectName, 'Classes/AppDelegate.m'),
    path.join(platformRoot, projectName, 'Classes/AppDelegate.swift'),
    path.join(platformRoot, projectName, 'AppDelegate.m'),
    path.join(platformRoot, projectName, 'AppDelegate.swift')
  ];
  
  for (const filePath of searchPaths) {
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  return null;
}

/**
 * Get iOS project name
 */
function getIOSProjectName(platformRoot) {
  try {
    const items = fs.readdirSync(platformRoot);
    for (const item of items) {
      if (item.endsWith('.xcodeproj')) {
        return item.replace('.xcodeproj', '');
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

/**
 * Simple glob function
 */
function glob(pattern, rootPath) {
  const results = [];
  
  function search(dir, patternParts, depth = 0) {
    if (depth > 10) return; // Prevent infinite recursion
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && patternParts.length > 1) {
          search(fullPath, patternParts.slice(1), depth + 1);
        } else if (stat.isFile() && item === patternParts[patternParts.length - 1]) {
          results.push(fullPath);
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }
  
  const parts = pattern.split('/');
  const startPath = parts[0] === '**' ? rootPath : path.join(rootPath, parts[0]);
  
  if (fs.existsSync(startPath)) {
    search(startPath, parts.slice(1));
  }
  
  return results;
}
