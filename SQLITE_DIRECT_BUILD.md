# Direct SQLite Database Creation

## Overview

Starting from version **2.6.0**, this plugin creates a **pre-built SQLite database** during the build process instead of injecting JavaScript code to create the database at runtime.

## Key Changes

### Before (v2.5.0 and earlier)
- Plugin injected `build-info.js` into `index.html`
- Database was created at **runtime** when app started
- Required waiting for `deviceready` event
- JavaScript code ran on every app launch

### After (v2.6.0+)
- Plugin creates SQLite database file **during build**
- Database is bundled with the app
- App reads from pre-existing database immediately
- No JavaScript injection needed
- Faster app startup

## How It Works

### Build Time

1. **Database Creation** (`hooks/injectBuildInfo.js`)
   - Creates `app_build_info.db` using `better-sqlite3`
   - Populates tables with build information from `config.xml`
   - Inserts initial data:
     - Build info (version, environment, API config)
     - Initial install history record
     - Empty user_data and app_settings tables

2. **Database Deployment**
   - **Android**: Copies to `platforms/android/app/src/main/assets/`
   - **iOS**: Copies to `platforms/ios/{ProjectName}/Resources/` and updates Xcode project

3. **Helper JavaScript**
   - Creates lightweight `build-info-helper.js`
   - Only contains code to read database (no creation logic)
   - Injects helper script into `index.html`

### Runtime

1. App launches and loads `build-info-helper.js`
2. On `deviceready`, helper opens existing database:
   ```javascript
   db = window.sqlitePlugin.openDatabase({
     name: 'app_build_info.db',
     location: 'default',
     createFromLocation: 1, // Read from bundled assets
     androidDatabaseProvider: 'system'
   });
   ```
3. Reads build info and exposes to `window.APP_BUILD_INFO`
4. Records install/update events in `install_history` table
5. Triggers `buildInfoReady` event

## Database Schema

### Table: `build_info`
Stores current build information (single row with id=1):

```sql
CREATE TABLE build_info (
  id INTEGER PRIMARY KEY,
  app_name TEXT,
  version_number TEXT,
  version_code TEXT,
  package_name TEXT,
  platform TEXT,
  build_time TEXT,
  build_timestamp INTEGER,
  api_hostname TEXT,
  api_base_url TEXT,
  environment TEXT,
  cdn_icon TEXT,
  updated_at TEXT
)
```

### Table: `install_history`
Tracks app installation and update events:

```sql
CREATE TABLE install_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_number TEXT,
  version_code TEXT,
  install_time TEXT,
  install_type TEXT,        -- 'build', 'first_install', 'update'
  previous_version TEXT
)
```

### Table: `user_data`
Stores user-specific data:

```sql
CREATE TABLE user_data (
  key TEXT PRIMARY KEY,
  value TEXT,               -- JSON string
  updated_at TEXT
)
```

### Table: `app_settings`
Stores app settings:

```sql
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,               -- JSON string
  updated_at TEXT
)
```

## API Usage

The JavaScript API remains the same:

```javascript
// Wait for build info to be ready
document.addEventListener('buildInfoReady', function(event) {
  console.log('Build info:', window.APP_BUILD_INFO);
  // {
  //   appName: "My App",
  //   versionNumber: "1.0.0",
  //   versionCode: "1",
  //   apiHostname: "api.example.com",
  //   environment: "production",
  //   storageType: "sqlite-prebuild"
  // }
});

// Update user data
window.updateAppUserData('userId', '12345', function(err) {
  if (!err) console.log('User data saved');
});

// Get user data
window.getAppUserData('userId', function(err, value) {
  console.log('User ID:', value);
});

// Update settings
window.updateAppSettings({
  theme: 'dark',
  notifications: true
}, function(err) {
  if (!err) console.log('Settings saved');
});

// Get single setting
window.getAppSetting('theme', function(err, value) {
  console.log('Theme:', value);
});

// Get install history
window.getInstallHistory(function(err, history) {
  console.log('Install history:', history);
  // Array of install records
});
```

## Benefits

### Performance
- **Faster startup**: Database is ready immediately, no creation overhead
- **No blocking**: No database creation on UI thread
- **Reduced JavaScript**: Less code to parse and execute at runtime

### Reliability
- **Guaranteed data**: Build info always available from first launch
- **No race conditions**: No waiting for async database creation
- **Consistent state**: Database structure validated at build time

### Maintenance
- **Cleaner code**: Separation of build-time and runtime logic
- **Easier testing**: Database can be inspected before deployment
- **Better debugging**: Can verify database contents without running app

## Migration from v2.5.0

If upgrading from v2.5.0 or earlier:

1. **Update plugin**:
   ```bash
   cordova plugin remove cordova-plugin-change-app-info
   cordova plugin add cordova-plugin-change-app-info@2.6.0
   ```

2. **No code changes needed**: The JavaScript API is unchanged

3. **Clean build recommended**:
   ```bash
   cordova clean
   cordova build
   ```

4. **Data migration**: The helper script will detect existing runtime-created databases and preserve user data during first launch with new version

## Requirements

- **Build machine**: Must have `better-sqlite3` installed (automatically installed via `npm install`)
- **Runtime**: Still requires `cordova-sqlite-storage` plugin (auto-installed as dependency)
- **Node.js**: Version 14 or higher recommended for `better-sqlite3`

## Troubleshooting

### Build fails with "better-sqlite3 not installed"

```bash
cd plugins/cordova-plugin-change-app-info
npm install
```

### Database not found at runtime

**Android**: Check `platforms/android/app/src/main/assets/app_build_info.db` exists

**iOS**: 
1. Open Xcode project
2. Verify `app_build_info.db` is in project navigator
3. Check "Target Membership" includes your app target
4. Rebuild from Xcode

### Old JavaScript file still present

Clean build directory:
```bash
cordova clean
rm -rf platforms/*/www/build-info.js
cordova build
```

## Platform-Specific Notes

### Android

- Database file: `app/src/main/assets/app_build_info.db`
- SQLite plugin uses `createFromLocation: 1` to copy from assets to app storage on first run
- Database remains in app storage after first launch

### iOS

- Database file: `{ProjectName}/Resources/app_build_info.db`
- Must be added to Xcode project (hook does this automatically)
- Database is copied to app's Documents directory on first run
- Xcode may cache old database - clean build if issues occur

## Technical Details

### Why better-sqlite3?

- **Synchronous API**: Perfect for build scripts (no async/await needed)
- **Performance**: Native C++ binding, very fast
- **Compatibility**: Creates standard SQLite3 databases readable by all SQLite libraries
- **Reliability**: Mature, well-tested library

### Database Location

**Build time**: Temporary file in project root, deleted after copying

**Runtime**:
- Android: `{AppDataDir}/databases/app_build_info.db`
- iOS: `{AppDocuments}/app_build_info.db`

The `cordova-sqlite-storage` plugin handles platform-specific paths automatically.

## Future Enhancements

- [ ] Database encryption support
- [ ] Schema versioning and migrations
- [ ] Compression for large datasets
- [ ] Optional cloud backup sync

## Credits

Developed by [vnkhoado](https://github.com/vnkhoado)

License: MIT