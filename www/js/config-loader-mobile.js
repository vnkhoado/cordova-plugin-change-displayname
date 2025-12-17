/**
 * Mobile Config Loader for Cordova Apps
 * Optimized for iOS and Android file system access
 * 
 * Features:
 * - Works with Cordova File plugin
 * - Falls back to fetch() if plugin not available
 * - Handles iOS and Android paths correctly
 * - Proper error handling for file access
 * 
 * Usage in index.html:
 *   <script src="js/config-loader-mobile.js"></script>
 *   <script>
 *     document.addEventListener('deviceready', async () => {
 *       const config = await mobileConfigLoader.load();
 *       console.log('App:', config.appName);
 *     });
 *   </script>
 */

const mobileConfigLoader = (() => {
  const CONFIG_RELATIVE_PATH = '.cordova-app-data/build-config.json';
  const HISTORY_RELATIVE_PATH = '.cordova-app-data/build-history.json';

  /**
   * Detect platform (iOS or Android)
   */
  function getPlatform() {
    if (typeof cordova === 'undefined') return 'web';
    if (cordova.platformId === 'ios') return 'ios';
    if (cordova.platformId === 'android') return 'android';
    return 'unknown';
  }

  /**
   * Get app root directory based on platform
   * @private
   */
  async function getAppRoot() {
    if (typeof cordova === 'undefined' || typeof resolveLocalFileSystemURL === 'undefined') {
      console.log('[Mobile Config] Using fetch (no Cordova File plugin)');
      return null;
    }

    return new Promise((resolve) => {
      const platform = getPlatform();
      
      if (platform === 'ios') {
        // iOS: Use cordova.file.applicationStorageDirectory
        if (cordova.file && cordova.file.applicationStorageDirectory) {
          resolve(cordova.file.applicationStorageDirectory);
        } else if (cordova.file && cordova.file.documentsDirectory) {
          resolve(cordova.file.documentsDirectory);
        } else {
          resolve(null);
        }
      } else if (platform === 'android') {
        // Android: Use cordova.file.externalDataDirectory or applicationDirectory
        if (cordova.file && cordova.file.externalDataDirectory) {
          resolve(cordova.file.externalDataDirectory);
        } else if (cordova.file && cordova.file.applicationDirectory) {
          resolve(cordova.file.applicationDirectory);
        } else {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  }

  /**
   * Read file using Cordova File plugin (Method 1: Plugin)
   * @private
   */
  async function readFileWithPlugin(filePath) {
    return new Promise(async (resolve, reject) => {
      try {
        const root = await getAppRoot();
        
        if (!root) {
          reject(new Error('Could not get app root directory'));
          return;
        }

        // Resolve file from root
        resolveLocalFileSystemURL(root, (dirEntry) => {
          dirEntry.getFile(filePath, { create: false }, (fileEntry) => {
            fileEntry.file((file) => {
              const reader = new FileReader();
              reader.onloadend = (e) => {
                try {
                  const content = e.target.result;
                  const json = JSON.parse(content);
                  resolve(json);
                } catch (error) {
                  reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
              };
              reader.onerror = (error) => {
                reject(new Error(`Failed to read file: ${error.message}`));
              };
              reader.readAsText(file);
            });
          }, (error) => {
            reject(new Error(`File not found: ${error.message}`));
          });
        }, (error) => {
          reject(new Error(`Directory not found: ${error.message}`));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Read file using fetch (Method 2: Fallback)
   * @private
   */
  async function readFileWithFetch(filePath) {
    try {
      // Try multiple paths for compatibility
      const paths = [
        `file:///data/data/${getPackageName()}/${filePath}`,
        `file://${filePath}`,
        `/${filePath}`,
        filePath
      ];

      for (const path of paths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            const text = await response.text();
            return JSON.parse(text);
          }
        } catch (e) {
          // Try next path
          continue;
        }
      }

      throw new Error('File not found at any expected path');
    } catch (error) {
      throw new Error(`Fetch failed: ${error.message}`);
    }
  }

  /**
   * Get package name (Android)
   * @private
   */
  function getPackageName() {
    if (typeof cordova === 'undefined') return 'com.app';
    if (typeof cordova.exec === 'function') {
      // Package name is usually available in cordova.exec
      return 'com.app';
    }
    return 'com.app';
  }

  /**
   * Load configuration file
   */
  async function load() {
    console.log('[Mobile Config] Loading config...');
    
    try {
      // Wait for deviceready if in Cordova
      await ensureDeviceReady();
      
      // Try Method 1: Cordova File Plugin
      if (typeof resolveLocalFileSystemURL !== 'undefined') {
        console.log('[Mobile Config] Using Cordova File plugin');
        try {
          const config = await readFileWithPlugin(CONFIG_RELATIVE_PATH);
          console.log('[Mobile Config] ✓ Config loaded via plugin');
          return config.config || config;
        } catch (pluginError) {
          console.warn('[Mobile Config] Plugin method failed:', pluginError.message);
          // Fall through to Method 2
        }
      }
      
      // Method 2: Fallback to fetch()
      console.log('[Mobile Config] Falling back to fetch()');
      const config = await readFileWithFetch(CONFIG_RELATIVE_PATH);
      console.log('[Mobile Config] ✓ Config loaded via fetch');
      return config.config || config;
      
    } catch (error) {
      console.error('[Mobile Config] ✗ Failed to load config:', error.message);
      return null;
    }
  }

  /**
   * Load build history
   */
  async function loadHistory(limit = 10) {
    console.log('[Mobile Config] Loading history...');
    
    try {
      await ensureDeviceReady();
      
      // Try Method 1: Cordova File Plugin
      if (typeof resolveLocalFileSystemURL !== 'undefined') {
        try {
          const history = await readFileWithPlugin(HISTORY_RELATIVE_PATH);
          const entries = history.history || [];
          console.log(`[Mobile Config] ✓ History loaded (${entries.length} entries)`);
          return entries.slice(-limit).reverse();
        } catch (pluginError) {
          console.warn('[Mobile Config] Plugin method failed:', pluginError.message);
        }
      }
      
      // Method 2: Fallback to fetch()
      const history = await readFileWithFetch(HISTORY_RELATIVE_PATH);
      const entries = history.history || [];
      console.log(`[Mobile Config] ✓ History loaded (${entries.length} entries)`);
      return entries.slice(-limit).reverse();
      
    } catch (error) {
      console.warn('[Mobile Config] Failed to load history:', error.message);
      return [];
    }
  }

  /**
   * Ensure Cordova is ready
   * @private
   */
  async function ensureDeviceReady() {
    return new Promise((resolve) => {
      if (typeof cordova === 'undefined' || typeof document === 'undefined') {
        resolve();
        return;
      }
      
      if (typeof deviceready !== 'undefined') {
        resolve();
        return;
      }
      
      // Wait for deviceready event
      const handler = () => {
        document.removeEventListener('deviceready', handler);
        resolve();
      };
      
      document.addEventListener('deviceready', handler);
      
      // Timeout after 5 seconds
      setTimeout(resolve, 5000);
    });
  }

  /**
   * Get specific config value
   */
  async function get(key, defaultValue = null) {
    const config = await load();
    if (config && config[key] !== undefined) {
      return config[key];
    }
    return defaultValue;
  }

  /**
   * Get app metadata
   */
  async function getMetadata() {
    const config = await load();
    if (!config) return {};

    return {
      appName: config.appName || 'Unknown',
      appId: config.appId || 'com.unknown.app',
      appVersion: config.appVersion || '1.0.0',
      appDescription: config.appDescription || '',
      author: config.author || 'Unknown',
      buildDate: config.buildDate || new Date().toISOString(),
      platform: getPlatform()
    };
  }

  /**
   * Log config to console
   */
  async function logConfig() {
    const config = await load();
    if (config) {
      console.log('=== App Configuration ===');
      console.log('App Name:', config.appName || 'N/A');
      console.log('App ID:', config.appId || 'N/A');
      console.log('Version:', config.appVersion || 'N/A');
      console.log('Author:', config.author || 'N/A');
      console.log('Built:', config.buildDate || 'N/A');
      console.log('Platform:', getPlatform());
    } else {
      console.log('No configuration available');
    }
  }

  /**
   * Display config in console table
   */
  async function displayTable() {
    const config = await load();
    if (config) {
      console.table(config);
    } else {
      console.log('No configuration available');
    }
  }

  // Public API
  return {
    load,
    loadHistory,
    get,
    getMetadata,
    logConfig,
    displayTable,
    getPlatform
  };
})();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = mobileConfigLoader;
}
