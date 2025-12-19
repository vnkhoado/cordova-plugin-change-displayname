# Refactoring Plan - Eliminate Duplicate Code

## 🎯 Objectives

1. **Remove duplicate code** across multiple hooks
2. **Consolidate splash color logic** (5 files → 2 files)
3. **Centralize common utilities** (use existing hooks/utils.js)
4. **Improve maintainability** (DRY principle)
5. **Maintain backward compatibility** (no breaking changes)

---

## 🔍 Analysis of Current State

### Problem Areas

#### 1. Splash Color Hooks (HIGH PRIORITY)

**Files with duplicate logic**:
- `customizeSplashScreen.js` (8.4 KB) - Set splash color in config.xml
- `forceOverrideSplashColor.js` (5.3 KB) - Force override before_compile
- `forceOverrideNativeColors.js` (21.9 KB) - Replace colors in native files
- `forceMBASSplashColor.js` (11.1 KB) - Force MABS post_compile
- `scanAndReplaceColor.js` (6.7 KB) - Scan and replace colors

**Total size**: ~53 KB of mostly redundant code

**Duplicate patterns**:
- Reading config preferences (5x)
- Color format conversion (hex → RGB, hex → string) (3x)
- File scanning/replacement logic (3x)
- XML manipulation (config.xml, colors.xml, themes.xml) (4x)

#### 2. Config Reading Functions

**Duplicate `getPreferences()` in**:
- `changeAppInfo.js`
- `injectBuildInfo.js`
- Multiple splash color hooks

**Should use**: `getConfigParser()` from utils.js

#### 3. File Utilities

**Duplicate file operations**:
- Directory scanning (3x)
- Safe write with backup (2x)
- XML parsing/manipulation (5x)

**Already in utils.js**:
- `findFile()`, `findAllFiles()`
- `safeWriteFile()`
- `ensureDirectoryExists()`

---

## 🛠️ Refactoring Tasks

### Phase 1: Consolidate Splash Color Hooks

#### Task 1.1: Create Unified Splash Manager

**New file**: `hooks/lib/splashColorManager.js`

**Responsibilities**:
- Read splash color preferences (single source of truth)
- Update config.xml preferences
- Update native Android files (colors.xml, themes.xml)
- Scan and replace colors in www/ files
- Handle MABS-specific overrides

**Functions**:
```javascript
module.exports = {
  getSplashColorConfig,      // Read from config.xml
  updateConfigXml,            // Update config.xml preferences
  updateAndroidNativeFiles,   // Update colors.xml, themes.xml
  scanAndReplaceColors,       // Replace in CSS/HTML files
  forceMBASOverride           // Post-compile MABS fix
};
```

#### Task 1.2: Refactor Individual Hooks

**Replace 5 hooks with 2 simplified hooks**:

1. **`hooks/configureSplashColor.js`** (after_prepare)
   - Calls `splashColorManager.updateConfigXml()`
   - Calls `splashColorManager.updateAndroidNativeFiles()`
   - Replaces: `customizeSplashScreen.js`

2. **`hooks/enforceSplashColor.js`** (before_compile + post_compile)
   - Calls `splashColorManager.scanAndReplaceColors()` (before_compile)
   - Calls `splashColorManager.forceMBASOverride()` (post_compile)
   - Replaces: `forceOverrideSplashColor.js`, `forceOverrideNativeColors.js`, `forceMBASSplashColor.js`, `scanAndReplaceColor.js`

**Result**: 5 files (53 KB) → 2 files + 1 lib (~15 KB total)

---

### Phase 2: Consolidate Config Reading

#### Task 2.1: Add to utils.js

**New function**: `getStandardPreferences(context)`

```javascript
function getStandardPreferences(context) {
  const config = getConfigParser(context);
  return {
    appName: config.getPreference('APP_NAME') || config.name(),
    versionNumber: config.getPreference('VERSION_NUMBER') || config.version(),
    versionCode: config.getPreference('VERSION_CODE') || null,
    packageName: config.packageName(),
    cdnIcon: config.getPreference('CDN_ICON') || null,
    hostname: config.getPreference('hostname') || null,
    environment: process.env.ENVIRONMENT || 'DEVELOPMENT',
    splashColor: getBackgroundColorPreference(config)
  };
}
```

#### Task 2.2: Update Hooks to Use Utils

**Files to update**:
- `changeAppInfo.js` - Remove local `getPreferences()`, use utils
- `injectBuildInfo.js` - Remove local preference reading, use utils
- All splash color hooks - Use utils

---

### Phase 3: Remove Redundant File Operations

#### Task 3.1: Update Hooks to Use utils.js

**Replace**:
```javascript
// OLD (duplicate in many files)
function findFile(dir, filename) {
  // 20 lines of code
}
```

**With**:
```javascript
// NEW (use utils)
const { findFile } = require('./utils');
```

**Files to update**:
- `generateIcons.js` - Use `findAllFiles()`
- `native-gradient-splash.js` - Use `ensureDirectoryExists()`
- All hooks scanning directories

---

### Phase 4: Cleanup Unused/Deprecated Files

#### Task 4.1: Identify Candidates for Removal

**Potentially deprecated** (need verification):
- `updateSplashScreen.js` - May be obsolete with new splash flow
- Backup hooks that are no longer used

**To verify**: Check plugin.xml registration and actual usage

---

## 📊 Impact Analysis

### Benefits

✅ **Code reduction**: ~40 KB less code  
✅ **Maintainability**: Changes in 1 place instead of 5  
✅ **Performance**: Fewer hook executions  
✅ **Clarity**: Clear separation of concerns  
✅ **Testing**: Easier to test centralized logic  

### Risks

⚠️ **Breaking changes**: Must maintain same hook behavior  
⚠️ **Edge cases**: Some MABS-specific logic may be lost  
⚠️ **Testing burden**: Must test all platforms/scenarios  

### Mitigation

1. **Keep old hooks temporarily** - Deprecated but functional
2. **Comprehensive testing** - Test all splash scenarios
3. **Gradual migration** - Phase-by-phase approach
4. **Rollback plan** - Easy revert if issues found

---

## 📅 Implementation Plan

### Week 1: Phase 1 (Splash Color Consolidation)

**Day 1-2**: Create `splashColorManager.js`  
**Day 3-4**: Create new simplified hooks  
**Day 5**: Test with MABS + standard Cordova  

### Week 2: Phase 2 (Config Reading)

**Day 1**: Add `getStandardPreferences()` to utils.js  
**Day 2-3**: Update all hooks to use it  
**Day 4**: Test preference reading  

### Week 3: Phase 3 (File Operations)

**Day 1-2**: Update hooks to use utils file functions  
**Day 3**: Remove duplicate functions  
**Day 4**: Test file operations  

### Week 4: Phase 4 (Cleanup)

**Day 1**: Identify deprecated files  
**Day 2**: Remove unused hooks  
**Day 3-4**: Update documentation  
**Day 5**: Final testing  

---

## 🧪 Testing Strategy

### Test Scenarios

1. **Standard Cordova Build**
   - Android: splash color, app name, icons
   - iOS: splash color, app name, icons

2. **OutSystems MABS Build**
   - Splash color override
   - App name in cdv_strings.xml
   - No duplicate resources

3. **Edge Cases**
   - Missing config preferences
   - Invalid color formats
   - Platform-specific failures

### Test Commands

```bash
# Clean test
rm -rf platforms plugins
cordova platform add android ios
cordova plugin add https://github.com/vnkhoado/cordova-plugin-change-app-info.git#refactor/cleanup-duplicate-code
cordova build android
cordova build ios

# Verify results
grep -r "#001833" platforms/android/app/src/main/res/
cat platforms/android/app/src/main/res/values/cdv_strings.xml
cat platforms/ios/*/Info.plist
```

---

## 📝 File Structure (After Refactoring)

```
hooks/
├── lib/
│   ├── splashColorManager.js      [NEW] Unified splash logic
│   └── ...
├── configureSplashColor.js      [NEW] Replaces customizeSplashScreen.js
├── enforceSplashColor.js        [NEW] Replaces 4 force/scan hooks
├── changeAppInfo.js             [UPDATED] Use utils
├── injectBuildInfo.js           [UPDATED] Use utils
├── generateIcons.js             [UPDATED] Use utils
├── utils.js                     [UPDATED] Add getStandardPreferences()
└── ...

[REMOVED]
- customizeSplashScreen.js
- forceOverrideSplashColor.js
- forceOverrideNativeColors.js
- forceMBASSplashColor.js
- scanAndReplaceColor.js
```

---

## ✅ Success Criteria

1. ✅ All existing functionality preserved
2. ✅ Code size reduced by >30%
3. ✅ No duplicate logic across hooks
4. ✅ All tests pass (Android + iOS + MABS)
5. ✅ Documentation updated
6. ✅ Backward compatible (old hooks deprecated but work)

---

## 🔗 Related Issues

- #1: Duplicate splash color code
- #2: Config reading scattered across files
- #3: File utilities not using centralized utils.js

---

## 📚 References

- [Cordova Hook Best Practices](https://cordova.apache.org/docs/en/dev/guide/appdev/hooks/)
- [DRY Principle](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [utils.js Documentation](hooks/utils.js)

---

**Status**: 🟡 Planning Phase  
**Branch**: `refactor/cleanup-duplicate-code`  
**Assignee**: @vnkhoado  
**Start Date**: 2025-12-19  
**Target Completion**: 2026-01-15  