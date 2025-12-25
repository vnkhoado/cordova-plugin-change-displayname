# OutSystems Integration Guide

## Native Config Integration with OutSystems

This guide shows how to use the native config injection in OutSystems applications.

## Quick Start

### 1. Create a Client Action for Config Access

Create a new **Client Action** named `GetAppConfig` in your OutSystems module:

```javascript
// Client Action: GetAppConfig
// Output Parameters: 
//   - AppName (Text)
//   - ApiHostname (Text)
//   - AppVersion (Text)
//   - Environment (Text)
//   - Platform (Text)

$parameters.AppName = window.CORDOVA_BUILD_CONFIG?.appName || '';
$parameters.ApiHostname = window.CORDOVA_BUILD_CONFIG?.apiHostname || '';
$parameters.AppVersion = window.CORDOVA_BUILD_CONFIG?.appVersion || '';
$parameters.Environment = window.CORDOVA_BUILD_CONFIG?.environment || 'production';
$parameters.Platform = window.CORDOVA_BUILD_CONFIG?.platform || '';
```

### 2. Initialize Config on Application Ready

In your **OnApplicationReady** event handler:

```javascript
// In OnApplicationReady event
define("YourModule.controller.OnApplicationReady", ["require", "exports"], function(require, exports) {
    return {
        onReady: function($parameters, $actions) {
            // Wait for Cordova deviceready
            if (typeof cordova !== 'undefined') {
                document.addEventListener('deviceready', function() {
                    // Config is now available in window.CORDOVA_BUILD_CONFIG
                    var config = window.CORDOVA_BUILD_CONFIG || {};
                    
                    console.log('[OutSystems] App Config Loaded:');
                    console.log('  - App Name:', config.appName);
                    console.log('  - API Hostname:', config.apiHostname);
                    console.log('  - Environment:', config.environment);
                    console.log('  - Platform:', config.platform);
                    console.log('  - Version:', config.appVersion);
                    
                    // Store in OutSystems Client Variable if needed
                    if (config.apiHostname) {
                        $parameters.ClientVar_ApiHostname = config.apiHostname;
                    }
                });
            }
        }
    };
});
```

### 3. Alternative: Use cordova-config-ready Event

```javascript
// In OnApplicationReady
window.addEventListener('cordova-config-ready', function(event) {
    var config = event.detail;
    console.log('[OutSystems] Config ready:', config);
    
    // Use config in your OutSystems app
    $parameters.ClientVar_ApiHostname = config.apiHostname;
    $parameters.ClientVar_Environment = config.environment;
});
```

## Complete Example: Config Service Module

Create a **Service Module** to centralize config access:

### Service Module: `AppConfigService`

#### Client Action: `InitializeConfig`

```javascript
// Initialize config on app start
// No parameters needed

if (typeof cordova !== 'undefined') {
    document.addEventListener('deviceready', function() {
        var config = window.CORDOVA_BUILD_CONFIG || window.AppConfig || {};
        
        // Store in Site Properties or Client Variables
        window.OSAppConfig = {
            appName: config.appName || 'Unknown',
            apiHostname: config.apiHostname || '',
            environment: config.environment || 'production',
            appVersion: config.appVersion || '1.0.0',
            platform: config.platform || 'unknown',
            buildDate: config.buildDate || '',
            cdnIcon: config.cdnIcon || ''
        };
        
        console.log('[AppConfigService] Config initialized:', window.OSAppConfig);
    });
} else {
    console.warn('[AppConfigService] Not running in Cordova environment');
}
```

#### Client Action: `GetApiHostname`

```javascript
// Output: Hostname (Text)

if (window.OSAppConfig && window.OSAppConfig.apiHostname) {
    $parameters.Hostname = window.OSAppConfig.apiHostname;
} else if (window.CORDOVA_BUILD_CONFIG && window.CORDOVA_BUILD_CONFIG.apiHostname) {
    $parameters.Hostname = window.CORDOVA_BUILD_CONFIG.apiHostname;
} else {
    // Fallback to Site Property
    $parameters.Hostname = $parameters.DefaultHostname;
}
```

#### Client Action: `GetEnvironment`

```javascript
// Output: Environment (Text)

if (window.OSAppConfig) {
    $parameters.Environment = window.OSAppConfig.environment || 'production';
} else if (window.CORDOVA_BUILD_CONFIG) {
    $parameters.Environment = window.CORDOVA_BUILD_CONFIG.environment || 'production';
} else {
    $parameters.Environment = 'production';
}
```

#### Client Action: `GetAppVersion`

```javascript
// Output: Version (Text)

if (window.OSAppConfig) {
    $parameters.Version = window.OSAppConfig.appVersion || '1.0.0';
} else if (window.CORDOVA_BUILD_CONFIG) {
    $parameters.Version = window.CORDOVA_BUILD_CONFIG.appVersion || '1.0.0';
} else {
    $parameters.Version = '1.0.0';
}
```

## Usage in Screens

### Screen: Splash/Loading

```javascript
// OnReady action
define("YourModule.controller.Splash.OnReady", [], function() {
    return {
        onReady: function($actions) {
            // Wait for config to be ready
            document.addEventListener('deviceready', function() {
                // Get config
                var config = window.CORDOVA_BUILD_CONFIG || {};
                
                if (config.apiHostname) {
                    // Config loaded successfully
                    console.log('[Splash] API Hostname:', config.apiHostname);
                    
                    // Navigate to main screen
                    $actions.NavigateToHome();
                } else {
                    console.error('[Splash] Config not available');
                    // Show error or use fallback
                }
            });
        }
    };
});
```

### Screen: Settings/About

```javascript
// Display app information
define("YourModule.controller.Settings.OnReady", [], function() {
    return {
        onReady: function($parameters) {
            var config = window.CORDOVA_BUILD_CONFIG || {};
            
            $parameters.AppName = config.appName || 'My App';
            $parameters.AppVersion = config.appVersion || '1.0.0';
            $parameters.BuildDate = config.buildDate || 'Unknown';
            $parameters.Environment = config.environment || 'production';
        }
    };
});
```

## Configuration in MABS

Set preferences in your OutSystems **Extensibility Configurations**:

```xml
{
    "preferences": {
        "global": [
            {"name": "hostname", "value": "https://api.yourapp.com"},
            {"name": "ENVIRONMENT", "value": "production"},
            {"name": "APP_NAME", "value": "My App"},
            {"name": "CDN_ICON", "value": "https://cdn.yourapp.com/icon.png"}
        ]
    }
}
```

## REST API Integration

Use config to set REST API base URL dynamically:

```javascript
// Before calling REST API
define("YourModule.controller.API.BeforeRequest", [], function() {
    return {
        beforeRequest: function($parameters) {
            var config = window.CORDOVA_BUILD_CONFIG || {};
            
            if (config.apiHostname) {
                // Override base URL with config value
                $parameters.BaseURL = config.apiHostname;
            }
        }
    };
});
```

## Environment-Specific Behavior

```javascript
// Check environment and adjust behavior
var config = window.CORDOVA_BUILD_CONFIG || {};
var isDevelopment = config.environment === 'development';
var isProduction = config.environment === 'production';

if (isDevelopment) {
    // Enable debug logging
    console.log('[Dev Mode] API calls will be logged');
} else if (isProduction) {
    // Disable debug features
    console.log('[Production Mode] Debug features disabled');
}
```

## Troubleshooting

### Config is undefined

```javascript
// Add defensive checks
if (typeof window.CORDOVA_BUILD_CONFIG === 'undefined') {
    console.warn('[OutSystems] Config not available yet. Using fallback.');
    
    // Try getting config via plugin
    if (typeof cordova !== 'undefined' && cordova.exec) {
        cordova.exec(
            function(config) {
                window.CORDOVA_BUILD_CONFIG = config;
                console.log('[OutSystems] Config loaded via plugin:', config);
            },
            function(error) {
                console.error('[OutSystems] Failed to get config:', error);
            },
            'CSSInjector',
            'getConfig',
            []
        );
    }
}
```

### Check Config in Chrome DevTools

When debugging in browser or device:

```javascript
// In browser console
console.log('Config:', window.CORDOVA_BUILD_CONFIG);

// Or in OutSystems debugger
JSON.stringify(window.CORDOVA_BUILD_CONFIG);
```

## Migration from Old Approach

### Before (File-based with config-loader)

```javascript
// Old way - required external script
require(['scripts/StaffPortalMobile.configloader'], function(configLoader) {
    configLoader.load().then(function(config) {
        $parameters.ApiHostname = config.apiHostname;
    });
});
```

### After (Native injection)

```javascript
// New way - config already available
document.addEventListener('deviceready', function() {
    var config = window.CORDOVA_BUILD_CONFIG;
    $parameters.ApiHostname = config.apiHostname;
});
```

## Best Practices

1. **Always check for deviceready** - Config is injected after Cordova initializes
2. **Use fallbacks** - Provide default values if config is not available
3. **Cache config** - Store in OutSystems Client Variables if needed
4. **Type safety** - Use optional chaining (`?.`) to avoid errors
5. **Log config** - Add console logs during development to verify config values

## Example: Complete Flow

```javascript
// 1. In OnApplicationReady
define("MyApp.OnApplicationReady", [], function() {
    return {
        onReady: function($parameters, $actions) {
            console.log('[MyApp] Application starting...');
            
            // Wait for deviceready
            document.addEventListener('deviceready', function() {
                console.log('[MyApp] Device ready');
                
                // Get config
                var config = window.CORDOVA_BUILD_CONFIG || {};
                console.log('[MyApp] Config:', config);
                
                // Initialize app with config
                if (config.apiHostname) {
                    $parameters.ClientVar_ApiHostname = config.apiHostname;
                    $parameters.ClientVar_Environment = config.environment;
                    
                    console.log('[MyApp] Config initialized successfully');
                    
                    // Trigger app initialization
                    $actions.InitializeApp();
                } else {
                    console.warn('[MyApp] Config not available, using defaults');
                    $actions.InitializeAppWithDefaults();
                }
            });
        }
    };
});
```

## Notes

- Config is available **after** `deviceready` event fires
- Config is **read-only** (immutable)
- Use `window.CORDOVA_BUILD_CONFIG` or `window.AppConfig` (both point to same object)
- Config persists for the entire app session
- No need to load external JavaScript files
