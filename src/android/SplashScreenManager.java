package io.outsystems.android;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import android.util.Log;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.app.Activity;
import android.app.Dialog;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.FrameLayout;
import java.lang.reflect.Method;
import java.lang.reflect.Field;
import android.os.Handler;

/**
 * SplashScreenManager Plugin
 * 
 * Manages splash screen removal on app ready
 * 
 * Supports multiple removal strategies:
 * 1. cordova-plugin-splashscreen SplashScreen.hide() via reflection
 * 2. Find and remove splash views from ViewGroup hierarchy
 * 3. Set visibility to GONE after fade animation
 * 4. OutSystems-specific splash detection
 * 5. Dialog dismissal if available
 * 6. Dismiss all active dialogs
 * 7. Search and hide all window views
 * 8. OutSystems splash class reflection
 * 
 * Called from JS via:
 *   cordova.exec(
 *     successCallback,
 *     errorCallback,
 *     'SplashScreenManager',
 *     'removeSplash',
 *     []
 *   );
 */
public class SplashScreenManager extends CordovaPlugin {
    
    private static final String TAG = "SplashScreenManager";
    private boolean splashRemoved = false;
    
    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) 
            throws JSONException {
        
        if ("removeSplash".equals(action)) {
            this.removeSplash(callbackContext);
            return true;
        }
        
        callbackContext.error("Unknown action: " + action);
        return false;
    }
    
    /**
     * Remove splash screen with multiple strategies
     * Called when app is ready
     */
    private void removeSplash(final CallbackContext callbackContext) {
        
        // Prevent multiple calls
        if (splashRemoved) {
            Log.d(TAG, "Splash already removed - ignoring duplicate call");
            PluginResult result = new PluginResult(PluginResult.Status.OK, "Splash already removed");
            callbackContext.sendPluginResult(result);
            return;
        }
        
        cordova.getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "=== Starting splash removal ===");
                    
                    Activity activity = cordova.getActivity();
                    if (activity == null) {
                        Log.e(TAG, "Activity is null");
                        throw new Exception("Activity not available");
                    }
                    
                    int strategiesSucceeded = 0;
                    
                    // Strategy 1: Use cordova-plugin-splashscreen if available (via reflection)
                    if (tryHideSplashScreenViaReflection()) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 2: Find and remove splash views from hierarchy
                    if (tryRemoveSplashFromViewHierarchy(activity)) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 3: OutSystems-specific splash detection
                    if (tryRemoveOutSystemsSplash(activity)) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 4: Fade out with visibility control
                    if (tryFadeOutAndHide(activity)) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 5: Try to dismiss splash dialog
                    if (tryDismissDialog(activity)) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 6: NEW - Dismiss all dialogs
                    if (tryDismissAllDialogs(activity)) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 7: NEW - Search all window views
                    if (tryHideAllWindowViews(activity)) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 8: NEW - OutSystems splash class reflection
                    if (tryOutSystemsSplashReflection()) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 9: AGGRESSIVE - Hide DecorView completely
                    if (tryAggressiveDecorViewHide(activity)) {
                        strategiesSucceeded++;
                    }
                    
                    // Strategy 10: LAST RESORT - Delayed forced removal
                    scheduleDelayedRemoval(activity);
                    
                    splashRemoved = true;
                    
                    Log.d(TAG, "Splash removal completed: " + strategiesSucceeded + " strategies succeeded");
                    
                    PluginResult result = new PluginResult(
                        PluginResult.Status.OK, 
                        "Splash removed (" + strategiesSucceeded + " strategies succeeded)"
                    );
                    callbackContext.sendPluginResult(result);
                    Log.d(TAG, "=== Splash removal completed ===");
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error removing splash: " + e.getMessage());
                    e.printStackTrace();
                    
                    splashRemoved = true; // Mark as removed to prevent retries
                    
                    PluginResult result = new PluginResult(
                        PluginResult.Status.ERROR,
                        "Failed to remove splash: " + e.getMessage()
                    );
                    callbackContext.sendPluginResult(result);
                }
            }
        });
    }
    
    /**
     * Strategy 1: Try using cordova-plugin-splashscreen via reflection
     * This avoids compile-time dependency on the plugin
     */
    private boolean tryHideSplashScreenViaReflection() {
        try {
            Log.d(TAG, "Strategy 1: Trying SplashScreen.hide() via reflection...");
            
            // Use reflection to avoid compile-time dependency
            Class<?> splashScreenClass = Class.forName("org.apache.cordova.splashscreen.SplashScreen");
            Method hideMethod = splashScreenClass.getMethod("hide");
            hideMethod.invoke(null);
            
            Log.d(TAG, "✓ Strategy 1: SplashScreen.hide() succeeded");
            return true;
            
        } catch (ClassNotFoundException e) {
            Log.d(TAG, "✗ Strategy 1: cordova-plugin-splashscreen not available");
            return false;
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 1: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 2: Find and remove splash views from ViewGroup hierarchy
     * This physically removes the splash screen view
     */
    private boolean tryRemoveSplashFromViewHierarchy(Activity activity) {
        try {
            Log.d(TAG, "Strategy 2: Searching for splash views in hierarchy...");
            
            View rootView = activity.getWindow().getDecorView().getRootView();
            boolean removed = recursivelyRemoveSplashViews(rootView);
            
            if (removed) {
                Log.d(TAG, "✓ Strategy 2: Splash views removed from hierarchy");
                return true;
            } else {
                Log.d(TAG, "✗ Strategy 2: No splash views found");
                return false;
            }
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 2: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Recursively search and remove splash-related views
     */
    private boolean recursivelyRemoveSplashViews(View view) {
        boolean removed = false;
        
        if (view == null) return false;
        
        // Check if this view looks like a splash screen
        String viewId = getViewIdName(view);
        String viewTag = view.getTag() != null ? view.getTag().toString() : "";
        
        Log.d(TAG, "  Checking view: " + view.getClass().getSimpleName() + 
                   " id=" + viewId + " tag=" + viewTag);
        
        // Common splash screen identifiers
        boolean isSplashView = 
            viewId.contains("splash") || 
            viewTag.contains("splash") ||
            viewId.contains("loading") ||
            (view instanceof ImageView && viewId.contains("logo"));
        
        if (isSplashView) {
            Log.d(TAG, "  Found potential splash view: " + viewId);
            
            // Try to remove from parent
            if (view.getParent() instanceof ViewGroup) {
                ViewGroup parent = (ViewGroup) view.getParent();
                parent.removeView(view);
                Log.d(TAG, "  ✓ Removed splash view from parent");
                removed = true;
            }
            
            // Also set visibility to GONE
            view.setVisibility(View.GONE);
        }
        
        // Recursively check children
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                if (recursivelyRemoveSplashViews(group.getChildAt(i))) {
                    removed = true;
                }
            }
        }
        
        return removed;
    }
    
    /**
     * Get readable view ID name
     */
    private String getViewIdName(View view) {
        try {
            if (view.getId() == View.NO_ID) {
                return "no_id";
            }
            return view.getResources().getResourceEntryName(view.getId());
        } catch (Exception e) {
            return "unknown";
        }
    }
    
    /**
     * Strategy 3: OutSystems-specific splash detection
     * OutSystems MABS may use specific naming conventions
     */
    private boolean tryRemoveOutSystemsSplash(Activity activity) {
        try {
            Log.d(TAG, "Strategy 3: Looking for OutSystems-specific splash...");
            
            View rootView = activity.getWindow().getDecorView().getRootView();
            boolean removed = false;
            
            // Try common OutSystems splash IDs
            String[] possibleIds = {
                "outsystems_splash",
                "os_splash",
                "splash_screen",
                "splashscreen",
                "loading_screen"
            };
            
            for (String idName : possibleIds) {
                int id = getResourceId(activity, idName, "id");
                if (id != 0) {
                    View splashView = rootView.findViewById(id);
                    if (splashView != null) {
                        Log.d(TAG, "  Found OutSystems splash: " + idName);
                        
                        if (splashView.getParent() instanceof ViewGroup) {
                            ViewGroup parent = (ViewGroup) splashView.getParent();
                            parent.removeView(splashView);
                            Log.d(TAG, "  ✓ Removed OutSystems splash");
                            removed = true;
                        }
                        
                        splashView.setVisibility(View.GONE);
                    }
                }
            }
            
            if (removed) {
                Log.d(TAG, "✓ Strategy 3: OutSystems splash removed");
                return true;
            } else {
                Log.d(TAG, "✗ Strategy 3: No OutSystems splash found");
                return false;
            }
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 3: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Get resource ID by name
     */
    private int getResourceId(Activity activity, String name, String type) {
        try {
            return activity.getResources().getIdentifier(
                name, 
                type, 
                activity.getPackageName()
            );
        } catch (Exception e) {
            return 0;
        }
    }
    
    /**
     * Strategy 4: Fade out animation with visibility control
     * Not just fade - actually hide the view after animation
     */
    private boolean tryFadeOutAndHide(Activity activity) {
        try {
            Log.d(TAG, "Strategy 4: Applying fade out with visibility control...");
            
            View decorView = activity.getWindow().getDecorView();
            if (decorView == null) {
                Log.d(TAG, "✗ Strategy 4: DecorView is null");
                return false;
            }
            
            // Create fade out animation
            AlphaAnimation fadeOut = new AlphaAnimation(1.0f, 0.0f);
            fadeOut.setDuration(300); // 300ms fade
            fadeOut.setFillAfter(true);
            fadeOut.setAnimationListener(new Animation.AnimationListener() {
                @Override
                public void onAnimationStart(Animation animation) {
                    Log.d(TAG, "  Fade animation started");
                }
                
                @Override
                public void onAnimationEnd(Animation animation) {
                    Log.d(TAG, "  Fade animation completed - hiding views");
                    
                    // Don't hide DecorView itself - hide children instead
                    if (decorView instanceof ViewGroup) {
                        ViewGroup group = (ViewGroup) decorView;
                        for (int i = group.getChildCount() - 1; i >= 0; i--) {
                            View child = group.getChildAt(i);
                            String childId = getViewIdName(child);
                            
                            // Hide anything that looks like splash
                            if (childId.contains("splash") || 
                                childId.contains("loading") ||
                                child instanceof ImageView) {
                                child.setVisibility(View.GONE);
                                Log.d(TAG, "  Hidden child view: " + childId);
                            }
                        }
                    }
                }
                
                @Override
                public void onAnimationRepeat(Animation animation) {}
            });
            
            decorView.startAnimation(fadeOut);
            Log.d(TAG, "✓ Strategy 4: Fade animation applied");
            return true;
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 4: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 5: Try to dismiss splash dialog using R.id.content
     */
    private boolean tryDismissDialog(Activity activity) {
        try {
            Log.d(TAG, "Strategy 5: Trying dialog dismissal...");
            
            int contentId = android.R.id.content;
            View contentView = activity.findViewById(contentId);
            
            if (contentView != null) {
                contentView.setVisibility(View.VISIBLE);
                contentView.bringToFront();
                Log.d(TAG, "✓ Strategy 5: Content view made visible");
                return true;
            }
            
            Log.d(TAG, "✗ Strategy 5: No content view found");
            return false;
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 5: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 6: NEW - Dismiss all active dialogs
     */
    private boolean tryDismissAllDialogs(Activity activity) {
        try {
            Log.d(TAG, "Strategy 6: Trying to dismiss all dialogs...");
            
            // Try to find dialog field in activity
            Field[] fields = activity.getClass().getDeclaredFields();
            boolean dismissed = false;
            
            for (Field field : fields) {
                try {
                    field.setAccessible(true);
                    Object value = field.get(activity);
                    
                    if (value instanceof Dialog) {
                        Dialog dialog = (Dialog) value;
                        if (dialog.isShowing()) {
                            dialog.dismiss();
                            Log.d(TAG, "  ✓ Dismissed dialog: " + field.getName());
                            dismissed = true;
                        }
                    }
                } catch (Exception e) {
                    // Skip this field
                }
            }
            
            if (dismissed) {
                Log.d(TAG, "✓ Strategy 6: Dialogs dismissed");
                return true;
            } else {
                Log.d(TAG, "✗ Strategy 6: No dialogs found");
                return false;
            }
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 6: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 7: NEW - Search and hide all window views
     */
    private boolean tryHideAllWindowViews(Activity activity) {
        try {
            Log.d(TAG, "Strategy 7: Searching all window views...");
            
            Window window = activity.getWindow();
            if (window == null) {
                Log.d(TAG, "✗ Strategy 7: Window is null");
                return false;
            }
            
            View decorView = window.getDecorView();
            boolean hidden = false;
            
            // Try to find and hide splash-related views
            if (decorView instanceof ViewGroup) {
                ViewGroup rootGroup = (ViewGroup) decorView;
                for (int i = 0; i < rootGroup.getChildCount(); i++) {
                    View child = rootGroup.getChildAt(i);
                    
                    // If it's a FrameLayout or LinearLayout at top level, might be splash container
                    if (child instanceof FrameLayout || child instanceof LinearLayout) {
                        // Check if it contains an ImageView (likely splash logo)
                        if (child instanceof ViewGroup) {
                            ViewGroup container = (ViewGroup) child;
                            for (int j = 0; j < container.getChildCount(); j++) {
                                View innerChild = container.getChildAt(j);
                                if (innerChild instanceof ImageView) {
                                    // This might be splash container
                                    Log.d(TAG, "  Found potential splash container with ImageView");
                                    child.setVisibility(View.GONE);
                                    hidden = true;
                                }
                            }
                        }
                    }
                }
            }
            
            if (hidden) {
                Log.d(TAG, "✓ Strategy 7: Window views hidden");
                return true;
            } else {
                Log.d(TAG, "✗ Strategy 7: No window views hidden");
                return false;
            }
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 7: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 8: NEW - Try OutSystems splash class via reflection
     */
    private boolean tryOutSystemsSplashReflection() {
        try {
            Log.d(TAG, "Strategy 8: Trying OutSystems splash class reflection...");
            
            // Try common OutSystems splash class names
            String[] classNames = {
                "com.outsystems.android.core.SplashScreen",
                "com.outsystems.android.SplashScreen",
                "io.outsystems.android.SplashScreen",
                "com.outsystems.plugins.splashscreen.SplashScreen"
            };
            
            for (String className : classNames) {
                try {
                    Class<?> splashClass = Class.forName(className);
                    Method hideMethod = splashClass.getMethod("hide");
                    hideMethod.invoke(null);
                    Log.d(TAG, "✓ Strategy 8: OutSystems splash hidden via " + className);
                    return true;
                } catch (ClassNotFoundException e) {
                    // Try next class
                } catch (NoSuchMethodException e) {
                    // Try removeSplash method instead
                    try {
                        Class<?> splashClass = Class.forName(className);
                        Method removeMethod = splashClass.getMethod("removeSplash");
                        removeMethod.invoke(null);
                        Log.d(TAG, "✓ Strategy 8: OutSystems splash removed via " + className);
                        return true;
                    } catch (Exception ex) {
                        // Skip
                    }
                }
            }
            
            Log.d(TAG, "✗ Strategy 8: No OutSystems splash class found");
            return false;
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 8: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 9: AGGRESSIVE - Hide DecorView children aggressively
     */
    private boolean tryAggressiveDecorViewHide(Activity activity) {
        try {
            Log.d(TAG, "Strategy 9: Aggressive DecorView hiding...");
            
            View decorView = activity.getWindow().getDecorView();
            if (decorView == null || !(decorView instanceof ViewGroup)) {
                Log.d(TAG, "✗ Strategy 9: DecorView not accessible");
                return false;
            }
            
            ViewGroup decorGroup = (ViewGroup) decorView;
            boolean hidden = false;
            
            // Hide all children except SystemWebView and ContentFrameLayout
            for (int i = 0; i < decorGroup.getChildCount(); i++) {
                View child = decorGroup.getChildAt(i);
                String className = child.getClass().getSimpleName();
                
                // DON'T hide webview or content
                if (!className.contains("WebView") && 
                    !className.contains("ContentFrame") &&
                    !className.contains("ActionBar")) {
                    
                    Log.d(TAG, "  Hiding: " + className);
                    child.setVisibility(View.GONE);
                    hidden = true;
                }
            }
            
            if (hidden) {
                Log.d(TAG, "✓ Strategy 9: Aggressive hiding succeeded");
                return true;
            } else {
                Log.d(TAG, "✗ Strategy 9: Nothing to hide");
                return false;
            }
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Strategy 9: Failed - " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 10: LAST RESORT - Delayed forced removal
     */
    private void scheduleDelayedRemoval(final Activity activity) {
        Log.d(TAG, "Strategy 10: Scheduling delayed forced removal...");
        
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "Strategy 10: Executing delayed removal...");
                    
                    View decorView = activity.getWindow().getDecorView();
                    if (decorView instanceof ViewGroup) {
                        ViewGroup decorGroup = (ViewGroup) decorView;
                        
                        // Force hide everything except webview
                        for (int i = 0; i < decorGroup.getChildCount(); i++) {
                            View child = decorGroup.getChildAt(i);
                            if (!child.getClass().getSimpleName().contains("WebView")) {
                                child.setVisibility(View.GONE);
                                child.setAlpha(0f);
                            }
                        }
                    }
                    
                    // Make sure content is visible
                    View content = activity.findViewById(android.R.id.content);
                    if (content != null) {
                        content.setVisibility(View.VISIBLE);
                        content.bringToFront();
                    }
                    
                    Log.d(TAG, "✓ Strategy 10: Delayed removal executed");
                    
                } catch (Exception e) {
                    Log.e(TAG, "✗ Strategy 10: Failed - " + e.getMessage());
                }
            }
        }, 500); // 500ms delay
    }
}