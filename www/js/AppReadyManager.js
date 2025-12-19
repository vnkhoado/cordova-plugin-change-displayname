/**
 * AppReadyManager.js
 * 
 * Manages splash screen lifecycle:
 * Flow:
 *   1. Native splash shows on app start
 *   2. WebView loads and renders
 *   3. deviceready event fires
 *   4. App initializes (async operations)
 *   5. App renders UI completely
 *   6. JS calls cordova.exec('AppReady')
 *   7. Native plugin removes splash
 * 
 * Installation:
 * Include in your index.html BEFORE cordova.js:
 *   <script src="js/AppReadyManager.js"></script>
 *   <script src="cordova.js"></script>
 * 
 * Usage in your app:
 * When app initialization and UI rendering is complete:
 *   window.appReady();
 * 
 * Optional: Add delay if needed:
 *   window.AppReadyManager.notifyAppReadyAfter(2000); // 2 second delay
 */

if (!window.AppReadyManager) {
  window.AppReadyManager = {
    
    isInitialized: false,
    
    /**
     * Initialize AppReadyManager
     * Auto-called when script loads
     */
    init: function() {
      if (this.isInitialized) {
        return;
      }
      
      console.log('[AppReadyManager] Initializing splash manager...');
      
      // Check if Cordova is available
      if (typeof cordova === 'undefined') {
        console.log('[AppReadyManager] Cordova not available (web mode)');
        this.isInitialized = true;
        return;
      }
      
      // Expose global function
      if (!window.appReady) {
        window.appReady = this.notifyAppReady.bind(this);
      }
      
      this.isInitialized = true;
      console.log('[AppReadyManager] Initialized - ready to receive appReady() calls');
    },
    
    /**
     * Notify native that app is ready
     * Removes splash screen via cordova.exec
     */
    notifyAppReady: function() {
      if (typeof cordova === 'undefined') {
        console.log('[AppReadyManager] Cordova not available');
        return;
      }
      
      console.log('[AppReadyManager] App ready! Calling native SplashScreenManager.removeSplash()...');
      
      // Call native plugin
      cordova.exec(
        function(message) {
          console.log('[AppReadyManager] Splash removed: ' + message);
        },
        function(error) {
          console.warn('[AppReadyManager] Failed to remove splash: ' + error);
        },
        'SplashScreenManager',  // Plugin name
        'removeSplash',         // Action name
        []                       // Parameters
      );
    },
    
    /**
     * Notify app ready with delay
     * Useful if app needs extra time
     * @param {number} delayMs - Delay in milliseconds
     */
    notifyAppReadyAfter: function(delayMs) {
      delayMs = delayMs || 0;
      
      if (delayMs <= 0) {
        this.notifyAppReady();
        return;
      }
      
      console.log('[AppReadyManager] Scheduling app ready notification in ' + delayMs + 'ms');
      
      var self = this;
      setTimeout(function() {
        self.notifyAppReady();
      }, delayMs);
    },
    
    getStatus: function() {
      return {
        initialized: this.isInitialized,
        cordovaAvailable: typeof cordova !== 'undefined',
        appReadyAvailable: typeof window.appReady === 'function'
      };
    }
  };
  
  // Auto-initialize
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        if (window.AppReadyManager && !window.AppReadyManager.isInitialized) {
          window.AppReadyManager.init();
        }
      });
    } else {
      if (window.AppReadyManager && !window.AppReadyManager.isInitialized) {
        window.AppReadyManager.init();
      }
    }
  }
}

if (!window.appReady && window.AppReadyManager) {
  window.appReady = function() {
    window.AppReadyManager.notifyAppReady();
  };
}