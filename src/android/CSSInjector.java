package com.vnkhoado.cordova.changeappinfo;

import android.util.Base64;
import android.webkit.WebView;
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

    @Override
    public void pluginInitialize() {
        super.pluginInitialize();
        injectCSSIntoWebView();
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
                // Read CSS content from assets with UTF-8 encoding
                String cssContent = readCSSFromAssets();
                
                if (cssContent != null && !cssContent.isEmpty()) {
                    // Inject CSS into WebView
                    CordovaWebView webView = this.webView;
                    if (webView != null) {
                        String javascript = buildCSSInjectionScript(cssContent);
                        webView.loadUrl("javascript:" + javascript);
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
                   "      document.head.appendChild(style);" +
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
               "      document.head.appendChild(style);" +
               "      console.log('CSS injected by native code (escaped)');" +
               "    }" +
               "  } catch(e) {" +
               "    console.error('CSS injection failed:', e);" +
               "  }" +
               "})();";
    }
}
