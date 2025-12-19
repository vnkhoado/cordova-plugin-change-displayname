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
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.FrameLayout;
import java.lang.reflect.Method;
import java.lang.reflect.Field;

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
                    Log.d(TAG, "  Fade animation completed - setting visibility to GONE");
                    // IMPORTANT: Set visibility to GONE after fade completes
                    decorView.setVisibility(View.GONE);
                    
                    // Also try to remove any splash-related layers
                    if (decorView instanceof ViewGroup) {
                        ViewGroup group = (ViewGroup) decorView;
                        for (int i = group.getChildCount() - 1; i >= 0; i--) {
                            View child = group.getChildAt(i);
                            String childId = getViewIdName(child);
                            if (childId.contains("splash") || childId.contains("loading")) {
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
}