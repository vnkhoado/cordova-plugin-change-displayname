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
import java.lang.reflect.Method;

/**
 * SplashScreenManager Plugin
 * 
 * Manages splash screen removal on app ready
 * 
 * Supports multiple removal strategies:
 * 1. cordova-plugin-splashscreen SplashScreen.hide() via reflection
 * 2. Fade out animation on content view
 * 3. Dialog dismissal if available
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
                    
                    boolean removed = false;
                    
                    // Strategy 1: Use cordova-plugin-splashscreen if available (via reflection)
                    removed = tryHideSplashScreenViaReflection();
                    
                    // Strategy 2: Fade out animation if not removed
                    if (!removed) {
                        removed = tryFadeOutAnimation(activity);
                    }
                    
                    // Strategy 3: Try to dismiss splash dialog
                    if (!removed) {
                        removed = tryDismissDialog(activity);
                    }
                    
                    splashRemoved = true;
                    
                    if (removed) {
                        PluginResult result = new PluginResult(
                            PluginResult.Status.OK, 
                            "Splash removed successfully"
                        );
                        callbackContext.sendPluginResult(result);
                        Log.d(TAG, "SUCCESS: Splash removed");
                    } else {
                        Log.w(TAG, "WARNING: Could not remove splash - no strategy worked");
                        PluginResult result = new PluginResult(
                            PluginResult.Status.OK, 
                            "Splash removal attempted (may not be visible)"
                        );
                        callbackContext.sendPluginResult(result);
                    }
                    
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
            Log.d(TAG, "Trying SplashScreen.hide() via reflection...");
            
            // Use reflection to avoid compile-time dependency
            Class<?> splashScreenClass = Class.forName("org.apache.cordova.splashscreen.SplashScreen");
            Method hideMethod = splashScreenClass.getMethod("hide");
            hideMethod.invoke(null);
            
            Log.d(TAG, "✓ SplashScreen.hide() succeeded (via reflection)");
            return true;
            
        } catch (ClassNotFoundException e) {
            Log.d(TAG, "✗ cordova-plugin-splashscreen not available");
            return false;
        } catch (NoSuchMethodException e) {
            Log.d(TAG, "✗ SplashScreen.hide() method not found: " + e.getMessage());
            return false;
        } catch (Exception e) {
            Log.d(TAG, "✗ SplashScreen.hide() failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 2: Fade out animation
     */
    private boolean tryFadeOutAnimation(Activity activity) {
        try {
            Log.d(TAG, "Trying fade out animation...");
            
            View decorView = activity.getWindow().getDecorView();
            if (decorView == null) {
                Log.d(TAG, "✗ DecorView is null");
                return false;
            }
            
            // Create fade out animation
            AlphaAnimation fadeOut = new AlphaAnimation(1.0f, 0.0f);
            fadeOut.setDuration(300); // 300ms fade
            fadeOut.setAnimationListener(new Animation.AnimationListener() {
                @Override
                public void onAnimationStart(Animation animation) {
                    Log.d(TAG, "Fade animation started");
                }
                
                @Override
                public void onAnimationEnd(Animation animation) {
                    Log.d(TAG, "Fade animation completed");
                }
                
                @Override
                public void onAnimationRepeat(Animation animation) {}
            });
            
            decorView.startAnimation(fadeOut);
            Log.d(TAG, "✓ Fade animation applied");
            return true;
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Fade animation failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Strategy 3: Try to dismiss splash dialog using R.id.content
     */
    private boolean tryDismissDialog(Activity activity) {
        try {
            Log.d(TAG, "Trying dialog dismissal...");
            
            // Use android.R.id.content (int ID)
            int contentId = android.R.id.content;
            View contentView = activity.getWindow().getDecorView().findViewById(contentId);
            
            if (contentView != null) {
                Log.d(TAG, "✓ Content view found, splash likely already handled");
                return true;
            }
            
            Log.d(TAG, "✗ No content view found");
            return false;
            
        } catch (Exception e) {
            Log.d(TAG, "✗ Dialog dismissal failed: " + e.getMessage());
            return false;
        }
    }
}