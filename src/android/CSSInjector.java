package com.vnkhoado.cordova.changeappinfo;

import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.json.JSONArray;
import org.json.JSONException;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

public class CSSInjector extends CordovaPlugin {

    private static final String TAG = "CSSInjector";
    private static final String CSS_FILE_PATH = "www/assets/cdn-styles.css";
    private String cachedCSS = null;
    private Handler handler;

    @Override
    public void pluginInitialize() {
        super.pluginInitialize();
        
        // Pre-load CSS content
        cachedCSS = readCSSFromAssets();
        
        // Create handler for delayed execution
        handler = new Handler(Looper.getMainLooper());
        
        android.util.Log.d(TAG, "CSSInjector plugin initialized");
    }

    @Override
    public void onResume(boolean multitasking) {
        super.onResume(multitasking);
        
        // Inject CSS after a short delay to ensure DOM is ready
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                injectCSSIntoWebView();
                android.util.Log.d(TAG, "CSS injected on resume");
            }
        }, 500); // 500ms delay
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if (action.equals("injectCSS")) {
            injectCSSIntoWebView();
            callbackContext.success("CSS injected");
            return true;
        }
        return false;
    }

    /**
     * Read CSS from file and inject into WebView
     */
    private void injectCSSIntoWebView() {
        cordova.getActivity().runOnUiThread(() -> {
            try {
                // Use cached CSS or read from file
                String cssContent = cachedCSS;
                if (cssContent == null || cssContent.isEmpty()) {
                    cssContent = readCSSFromAssets();
                    cachedCSS = cssContent;
                }
                
                if (cssContent != null && !cssContent.isEmpty()) {
                    // Inject CSS into WebView
                    CordovaWebView cordovaWebView = this.webView;
                    if (cordovaWebView != null) {
                        String javascript = buildCSSInjectionScript(cssContent);
                        cordovaWebView.loadUrl("javascript:" + javascript);
                        android.util.Log.d(TAG, "CSS injected successfully (" + cssContent.length() + " bytes)");
                    }
                } else {
                    android.util.Log.w(TAG, "CSS file is empty or not found");
                }
            } catch (Exception e) {
                android.util.Log.e(TAG, "Failed to inject CSS: " + e.getMessage(), e);
            }
        });
    }

    /**
     * Read CSS content from assets/www/assets/cdn-styles.css with UTF-8 encoding
     */
    private String readCSSFromAssets() {
        StringBuilder cssContent = new StringBuilder();
        
        try {
            InputStream inputStream = cordova.getActivity().getAssets().open(CSS_FILE_PATH);
            // Use UTF-8 encoding to handle Unicode characters properly
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(inputStream, StandardCharsets.UTF_8)
            );
            
            String line;
            while ((line = reader.readLine()) != null) {
                cssContent.append(line).append("\n");
            }
            
            reader.close();
            inputStream.close();
            
        } catch (IOException e) {
            android.util.Log.e(TAG, "Failed to read CSS file: " + e.getMessage());
            return null;
        }
        
        return cssContent.toString();
    }

    /**
     * Build JavaScript code to inject CSS into page
     * Uses Base64 encoding to safely transfer CSS content
     */
    private String buildCSSInjectionScript(String cssContent) {
        try {
            // Encode CSS as Base64 to avoid escaping issues
            byte[] cssBytes = cssContent.getBytes(StandardCharsets.UTF_8);
            String base64CSS = Base64.encodeToString(cssBytes, Base64.NO_WRAP);
            
            // JavaScript to decode Base64 and inject CSS
            return "(function() {" +
                   "  try {" +
                   "    if (!document.getElementById('cdn-injected-styles')) {" +
                   "      var base64CSS = '" + base64CSS + "';" +
                   "      var decodedCSS = decodeURIComponent(escape(atob(base64CSS)));" +
                   "      var style = document.createElement('style');" +
                   "      style.id = 'cdn-injected-styles';" +
                   "      style.textContent = decodedCSS;" +
                   "      (document.head || document.documentElement).appendChild(style);" +
                   "      console.log('CSS injected by native code (Base64)');" +
                   "    }" +
                   "  } catch(e) {" +
                   "    console.error('CSS injection failed:', e);" +
                   "  }" +
                   "})();";
        } catch (Exception e) {
            android.util.Log.e(TAG, "Failed to encode CSS: " + e.getMessage());
            
            // Fallback: Use manual escaping if Base64 fails
            return buildFallbackInjectionScript(cssContent);
        }
    }

    /**
     * Fallback method using manual escaping (if Base64 encoding fails)
     */
    private String buildFallbackInjectionScript(String cssContent) {
        // Escape CSS content for use in JavaScript string
        String escapedCSS = cssContent
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "")
            .replace("\t", "\\t");
        
        // JavaScript to inject CSS
        return "(function() {" +
               "  try {" +
               "    if (!document.getElementById('cdn-injected-styles')) {" +
               "      var style = document.createElement('style');" +
               "      style.id = 'cdn-injected-styles';" +
               "      style.textContent = '" + escapedCSS + "';" +
               "      (document.head || document.documentElement).appendChild(style);" +
               "      console.log('CSS injected by native code (escaped)');" +
               "    }" +
               "  } catch(e) {" +
               "    console.error('CSS injection failed:', e);" +
               "  }" +
               "})();";
    }
}
