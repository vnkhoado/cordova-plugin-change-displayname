package io.outsystems.android;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import android.util.Log;

/**
 * SplashScreenManager Plugin
 * 
 * Manages splash screen removal on app ready
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
     * Remove splash screen
     * Called when app is ready
     */
    private void removeSplash(final CallbackContext callbackContext) {
        cordova.getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "Removing splash screen...");
                    
                    // Try to hide splash using Cordova's SplashScreen plugin
                    try {
                        org.apache.cordova.splashscreen.SplashScreen.hide();
                        Log.d(TAG, "Splash removed via SplashScreen.hide()");
                    } catch (Exception e1) {
                        Log.w(TAG, "SplashScreen.hide() not available: " + e1.getMessage());
                    }
                    
                    // Also hide any splash dialogs
                    try {
                        if (cordova.getActivity() != null) {
                            android.app.Dialog dialog = (android.app.Dialog) cordova.getActivity().getWindow()
                                .getDecorView().getTag("splash_dialog");
                            if (dialog != null && dialog.isShowing()) {
                                dialog.dismiss();
                                Log.d(TAG, "Splash dialog dismissed");
                            }
                        }
                    } catch (Exception e2) {
                        Log.w(TAG, "Dialog dismiss failed: " + e2.getMessage());
                    }
                    
                    PluginResult result = new PluginResult(PluginResult.Status.OK, "Splash removed successfully");
                    callbackContext.sendPluginResult(result);
                    Log.d(TAG, "SUCCESS: Splash removed");
                    
                } catch (Exception e) {
                    Log.e(TAG, "Error removing splash: " + e.getMessage());
                    callbackContext.error("Failed to remove splash: " + e.getMessage());
                }
            }
        });
    }
}