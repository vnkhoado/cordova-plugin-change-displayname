package com.vnkhoado.cordova.changeappinfo;

import android.graphics.Color;
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
        
        // Read WEBVIEW_BACKGROUND_COLOR from preferences
        String bgColor = preferences.getString("WEBVIEW_BACKGROUND_COLOR", null);
        if (bgColor == null || bgColor.isEmpty()) {
            bgColor = preferences.getString("BackgroundColor", null);
        }
        if (bgColor == null || bgColor.isEmpty()) {
            bgColor = preferences.getString("SplashScreenBackgroundColor", null);
        }
        
        // Set WebView background color immediately to prevent white flash
        final String finalBgColor = bgColor;
        cordova.getActivity().runOnUiThread(() -> {
            if (webView != null && webView.getView() != null) {
                if (finalBgColor != null && !finalBgColor.isEmpty()) {
                    try {
                        // Normalize and parse hex color (support both #RRGGBB and #AARRGGBB)
                        int color = parseHexColor(finalBgColor);
                        webView.getView().setBackgroundColor(color);
                        android.util.Log.d(TAG, "WebView background set to: " + finalBgColor + " (parsed: 0x" + Integer.toHexString(color) + ")");
                        
                        // Also inject CSS style for html/body background
                        injectBackgroundColorCSS(finalBgColor);
                    } catch (IllegalArgumentException e) {
                        android.util.Log.e(TAG, "Invalid color format: " + finalBgColor + ", using transparent", e);
                        // Fallback to transparent
                        webView.getView().setBackgroundColor(Color.TRANSPARENT);
                    }
                } else {
                    // No config, use transparent
                    webView.getView().setBackgroundColor(Color.TRANSPARENT);
                    android.util.Log.d(TAG, "No WEBVIEW_BACKGROUND_COLOR configured, using transparent");
                }
            }
        });
        
        // Pre-load CSS content
        cachedCSS = readCSSFromAssets();
        
        // Create handler for UI thread execution
        handler = new Handler(Looper.getMainLooper());
        
        android.util.Log.d(TAG, "CSSInjector plugin initialized");
    }

    @Override
    public void onStart() {
        super.onStart();
        
        // Inject CSS immediately when app starts (no delay needed)
        injectCSSIntoWebView();
        
        // Inject config loader script
        injectConfigLoaderScript();
        
        android.util.Log.d(TAG, "CSS and config loader injected on start");
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
     * Parse hex color string to int color value
     * Supports both #RRGGBB (6 digits) and #AARRGGBB (8 digits)
     */
    private int parseHexColor(String hexColor) throws IllegalArgumentException {
        String hex = hexColor.trim();
        
        // Remove # if present
        if (hex.startsWith("#")) {
            hex = hex.substring(1);
        }
        
        // Validate length
        if (hex.length() != 6 && hex.length() != 8) {
            throw new IllegalArgumentException("Hex color must be 6 or 8 characters (got " + hex.length() + ")");
        }
        
        try {
            if (hex.length() == 6) {
                // RGB format - add FF for full opacity
                return Color.parseColor("#FF" + hex);
            } else {
                // ARGB format - use as is
                return Color.parseColor("#" + hex);
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid hex color format: " + hexColor, e);
        }
    }

    /**
     * Inject background color CSS into WebView at runtime
     * This prevents white flash even if index.html is rewritten
     */
    private void injectBackgroundColorCSS(final String bgColor) {
        cordova.getActivity().runOnUiThread(() -> {
            try {
                CordovaWebView cordovaWebView = this.webView;
                if (cordovaWebView != null) {
                    String css = "html, body { background-color: " + bgColor + " !important; margin: 0; padding: 0; }";
                    String javascript = "(function() {" +
                        "  try {" +
                        "    var existingStyle = document.getElementById('cordova-plugin-webview-bg');" +
                        "    if (existingStyle) { existingStyle.remove(); }" +
                        "    var style = document.createElement('style');" +
                        "    style.id = 'cordova-plugin-webview-bg';" +
                        "    style.textContent = '" + css.replace("'", "\\'") + "';" +
                        "    (document.head || document.documentElement).appendChild(style);" +
                        "    console.log('Background CSS injected: " + bgColor + "');" +
                        "  } catch(e) { console.error('Background CSS injection failed:', e); }" +
                        "})();";
                    
                    cordovaWebView.loadUrl("javascript:" + javascript);
                    android.util.Log.d(TAG, "Background color CSS injected: " + bgColor);
                }
            } catch (Exception e) {
                android.util.Log.e(TAG, "Failed to inject background CSS: " + e.getMessage(), e);
            }
        });
    }

    /**
     * Inject config loader script tag at runtime
     * This prevents loss when index.html is rewritten by OutSystems
     */
    private void injectConfigLoaderScript() {
        cordova.getActivity().runOnUiThread(() -> {
            try {
                CordovaWebView cordovaWebView = this.webView;
                if (cordovaWebView != null) {
                    String scriptPath = "/StaffPortalMobile/scripts/StaffPortalMobile.configloader.js";
                    String javascript = "(function() {" +
                        "  try {" +
                        "    var existingScript = document.getElementById('cordova-config-loader');" +
                        "    if (existingScript) {" +
                        "      console.log('Config loader already injected');" +
                        "      return;" +
                        "    }" +
                        "    var script = document.createElement('script');" +
                        "    script.id = 'cordova-config-loader';" +
                        "    script.src = '" + scriptPath + "';" +
                        "    script.onload = function() { console.log('Config loader loaded: " + scriptPath + "'); };" +
                        "    script.onerror = function() { console.error('Config loader failed to load: " + scriptPath + "'); };" +
                        "    (document.head || document.documentElement).appendChild(script);" +
                        "    console.log('Config loader script injected');" +
                        "  } catch(e) { console.error('Config loader injection failed:', e); }" +
                        "})();";
                    
                    cordovaWebView.loadUrl("javascript:" + javascript);
                    android.util.Log.d(TAG, "Config loader script injected: " + scriptPath);
                }
            } catch (Exception e) {
                android.util.Log.e(TAG, "Failed to inject config loader: " + e.getMessage(), e);
            }
        });
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
