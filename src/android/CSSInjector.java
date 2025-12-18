package com.vnkhoado.cordova.changeappinfo;

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
                // Read CSS content from assets
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
     * Read CSS content from assets/www/assets/cdn-styles.css
     */
    private String readCSSFromAssets() {
        StringBuilder cssContent = new StringBuilder();
        
        try {
            InputStream inputStream = cordova.getActivity().getAssets().open(CSS_FILE_PATH);
            BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream));
            
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
     */
    private String buildCSSInjectionScript(String cssContent) {
        // Escape CSS content for use in JavaScript string
        String escapedCSS = cssContent
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "\\n")
            .replace("\r", "");
        
        // JavaScript to inject CSS
        return "(function() {" +
               "  if (!document.getElementById('cdn-injected-styles')) {" +
               "    var style = document.createElement('style');" +
               "    style.id = 'cdn-injected-styles';" +
               "    style.textContent = '" + escapedCSS + "';" +
               "    document.head.appendChild(style);" +
               "    console.log('CSS injected by native code');" +
               "  }" +
               "})();";
    }
}
