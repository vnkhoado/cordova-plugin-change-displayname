/**
 * Config Loader
 * Reads build configuration from .cordova-app-data JSON files
 * 
 * Usage in index.html:
 *   <script src="js/config-loader.js"></script>
 *   <script>
 *     configLoader.load().then(config => {
 *       console.log('App Name:', config.appName);
 *       console.log('App ID:', config.appId);
 *     });
 *   </script>
 */

const configLoader = (() => {
  // File paths relative to app document root
  const CONFIG_FILE = '/.cordova-app-data/build-config.json';
  const HISTORY_FILE = '/.cordova-app-data/build-history.json';

  /**
   * Load build configuration
   * @returns {Promise<Object>} Build configuration object
   */
  async function load() {
    try {
      const config = await fetchJSON(CONFIG_FILE);
      if (config && config.config) {
        console.log('[Config Loader] ✓ Config loaded:', config);
        return config.config;
      }
      return null;
    } catch (error) {
      console.warn('[Config Loader] Config not found or error reading:', error.message);
      return null;
    }
  }

  /**
   * Load build history
   * @param {number} limit - Number of recent builds to retrieve
   * @returns {Promise<Array>} Array of build history entries
   */
  async function loadHistory(limit = 10) {
    try {
      const history = await fetchJSON(HISTORY_FILE);
      if (history && history.history) {
        console.log('[Config Loader] ✓ History loaded:', history.history.length, 'entries');
        return history.history.slice(-limit).reverse();
      }
      return [];
    } catch (error) {
      console.warn('[Config Loader] History not found:', error.message);
      return [];
    }
  }

  /**
   * Get specific config value
   * @param {string} key - Config key (e.g., 'appName', 'appId')
   * @param {*} defaultValue - Default value if key not found
   * @returns {Promise<*>} Config value
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
   * @returns {Promise<Object>} App metadata object
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
      buildDate: config.buildDate || new Date().toISOString()
    };
  }

  /**
   * Get last build info
   * @returns {Promise<Object>} Last build entry
   */
  async function getLastBuild() {
    const history = await loadHistory(1);
    return history.length > 0 ? history[0] : null;
  }

  /**
   * Fetch and parse JSON file
   * @private
   */
  async function fetchJSON(filePath) {
    try {
      const response = await fetch(filePath);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const json = await response.json();
      return json;
    } catch (error) {
      throw new Error(`Failed to fetch ${filePath}: ${error.message}`);
    }
  }

  /**
   * Format config for display
   * @param {Object} config - Config object
   * @returns {string} Formatted config string
   */
  function format(config) {
    if (!config) return 'No config';
    
    const lines = [
      '=== App Configuration ===',
      `App Name: ${config.appName || 'N/A'}`,
      `App ID: ${config.appId || 'N/A'}`,
      `Version: ${config.appVersion || 'N/A'}`,
      `Author: ${config.author || 'N/A'}`,
      `Build Date: ${config.buildDate || 'N/A'}`,
      `Description: ${config.appDescription || 'N/A'}`
    ];
    
    return lines.join('\n');
  }

  /**
   * Log config to console
   */
  async function logConfig() {
    const config = await load();
    if (config) {
      console.log(format(config));
    } else {
      console.log('No configuration found');
    }
  }

  /**
   * Display config in DOM element
   * @param {string} elementId - ID of DOM element to display config in
   */
  async function displayInElement(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`[Config Loader] Element #${elementId} not found`);
      return;
    }

    const config = await load();
    if (config) {
      element.innerHTML = `<pre>${escapeHtml(format(config))}</pre>`;
    } else {
      element.innerHTML = '<p>No configuration available</p>';
    }
  }

  /**
   * Escape HTML special characters
   * @private
   */
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // Public API
  return {
    load,
    loadHistory,
    get,
    getMetadata,
    getLastBuild,
    format,
    logConfig,
    displayInElement
  };
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = configLoader;
}
