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
    private String backgroundColor = null;
    private boolean initialInjectionDone = false;

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
        
        // Store background color for later use
        backgroundColor = bgColor;
        
        // Set ONLY WebView and Activity background - DO NOT touch status bar
        final String finalBgColor = bgColor;
        cordova.getActivity().runOnUiThread(() -> {
            if (finalBgColor != null && !finalBgColor.isEmpty()) {
                try {
                    // Parse hex color (support both #RRGGBB and #AARRGGBB)
                    int color = parseHexColor(finalBgColor);
                    
                    // 1. Set Activity window background (prevents white flash)
                    cordova.getActivity().getWindow().setBackgroundDrawable(
                        new android.graphics.drawable.ColorDrawable(color)
                    );
                    
                    // 2. Set WebView background to SAME color (not transparent)
                    if (webView != null && webView.getView() != null) {
                        webView.getView().setBackgroundColor(color);
                    }
                    
                    android.util.Log.d(TAG, "Background set to: " + finalBgColor);
                } catch (IllegalArgumentException e) {
                    android.util.Log.e(TAG, "Invalid color: " + finalBgColor, e);
                }
            } else {
                android.util.Log.d(TAG, "No background color configured");
            }
        });
        
        // Pre-load CSS content
        cachedCSS = readCSSFromAssets();
        
        // Create handler for UI thread execution
        handler = new Handler(Looper.getMainLooper());
        
        android.util.Log.d(TAG, "CSSInjector initialized");
    }

    @Override
    public void onResume(boolean multitasking) {
        super.onResume(multitasking);
        
        // Inject CSS on first resume with longer delay to ensure DOM is ready
        if (!initialInjectionDone) {
            handler.postDelayed(() -> {
                injectAllContent();
                initialInjectionDone = true;
            }, 500); // Increased delay for DOM ready
        }
    }

    /**
     * Inject all content (background CSS, CDN CSS, config loader)
     */
    private void injectAllContent() {
        // 1. Inject background color CSS first
        if (backgroundColor != null && !backgroundColor.isEmpty()) {
            injectBackgroundColorCSS(backgroundColor);
        }
        
        // 2. Inject CDN CSS with delay
        handler.postDelayed(() -> {
            injectCSSIntoWebView();
        }, 100);
        
        // 3. Inject config loader script with delay
        handler.postDelayed(() -> {
            injectConfigLoaderScript();
        }, 300);
        
        android.util.Log.d(TAG, "Content injection scheduled");
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
            throw new IllegalArgumentException("Hex must be 6 or 8 chars");
        }
        
        try {
            if (hex.length() == 6) {
                // RGB - add FF for opacity
                return Color.parseColor("#FF" + hex);
            } else {
                // ARGB - use as is
                return Color.parseColor("#" + hex);
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid color: " + hexColor, e);
        }
    }

    /**
     * Inject background color CSS into WebView
     * Wait for DOM to be ready before injecting
     */
    private void injectBackgroundColorCSS(final String bgColor) {
        cordova.getActivity().runOnUiThread(() -> {
            try {
                CordovaWebView cordovaWebView = this.webView;
                if (cordovaWebView != null) {
                    String css = "html, body { background-color: " + bgColor + " !important; margin: 0; padding: 0; }";
                    String javascript = "(function() {" +
                        "  function inject() {" +
                        "    try {" +
                        "      var target = document.head || document.getElementsByTagName('head')[0] || document.documentElement;" +
                        "      if (!target) {" +
                        "        console.warn('[CSSInjector] DOM not ready, retrying...');" +
                        "        setTimeout(inject, 100);" +
                        "        return;" +
                        "      }" +
                        "      var s = document.getElementById('cordova-bg');" +
                        "      if (s) s.remove();" +
                        "      s = document.createElement('style');" +
                        "      s.id = 'cordova-bg';" +
                        "      s.textContent = '" + css.replace("'", "\\'") + "';" +
                        "      target.appendChild(s);" +
                        "      console.log('[CSSInjector] Background CSS: " + bgColor + "');" +
                        "    } catch(e) { console.error('[CSSInjector] BG failed:', e); }" +
                        "  }" +
                        "  if (document.readyState === 'loading') {" +
                        "    document.addEventListener('DOMContentLoaded', inject);" +
                        "  } else {" +
                        "    inject();" +
                        "  }" +
                        "})();";
                    
                    cordovaWebView.loadUrl("javascript:" + javascript);
                    android.util.Log.d(TAG, "Background CSS scheduled");
                }
            } catch (Exception e) {
                android.util.Log.e(TAG, "Background CSS failed", e);
            }
        });
    }

    /**
     * Inject config loader script
     */
    private void injectConfigLoaderScript() {
        cordova.getActivity().runOnUiThread(() -> {
            try {
                CordovaWebView cordovaWebView = this.webView;
                if (cordovaWebView != null) {
                    String scriptPath = "/StaffPortalMobile/scripts/StaffPortalMobile.configloader.js";
                    String javascript = "(function() {" +
                        "  function inject() {" +
                        "    try {" +
                        "      var target = document.head || document.getElementsByTagName('head')[0] || document.documentElement;" +
                        "      if (!target) {" +
                        "        console.warn('[CSSInjector] DOM not ready for config, retrying...');" +
                        "        setTimeout(inject, 100);" +
                        "        return;" +
                        "      }" +
                        "      var s = document.getElementById('cordova-config');" +
                        "      if (s) { console.log('[CSSInjector] Config exists'); return; }" +
                        "      s = document.createElement('script');" +
                        "      s.id = 'cordova-config';" +
                        "      s.src = '" + scriptPath + "';" +
                        "      s.onload = function() { console.log('[CSSInjector] Config loaded'); };" +
                        "      s.onerror = function() { console.error('[CSSInjector] Config failed'); };" +
                        "      target.appendChild(s);" +
                        "    } catch(e) { console.error('[CSSInjector] Config inject failed:', e); }" +
                        "  }" +
                        "  if (document.readyState === 'loading') {" +
                        "    document.addEventListener('DOMContentLoaded', inject);" +
                        "  } else {" +
                        "    inject();" +
                        "  }" +
                        "})();";
                    
                    cordovaWebView.loadUrl("javascript:" + javascript);
                    android.util.Log.d(TAG, "Config loader scheduled");
                }
            } catch (Exception e) {
                android.util.Log.e(TAG, "Config loader failed", e);
            }
        });
    }

    /**
     * Inject CDN CSS into WebView
     */
    private void injectCSSIntoWebView() {
        cordova.getActivity().runOnUiThread(() -> {
            try {
                String cssContent = cachedCSS;
                if (cssContent == null || cssContent.isEmpty()) {
                    cssContent = readCSSFromAssets();
                    cachedCSS = cssContent;
                }
                
                if (cssContent != null && !cssContent.isEmpty()) {
                    CordovaWebView cordovaWebView = this.webView;
                    if (cordovaWebView != null) {
                        String javascript = buildCSSInjectionScript(cssContent);
                        cordovaWebView.loadUrl("javascript:" + javascript);
                        android.util.Log.d(TAG, "CDN CSS scheduled (" + cssContent.length() + " bytes)");
                    }
                } else {
                    android.util.Log.w(TAG, "CSS file empty or not found");
                }
            } catch (Exception e) {
                android.util.Log.e(TAG, "CSS injection failed", e);
            }
        });
    }

    /**
     * Read CSS from assets
     */
    private String readCSSFromAssets() {
        StringBuilder cssContent = new StringBuilder();
        
        try {
            InputStream inputStream = cordova.getActivity().getAssets().open(CSS_FILE_PATH);
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
            android.util.Log.e(TAG, "Failed to read CSS", e);
            return null;
        }
        
        return cssContent.toString();
    }

    /**
     * Build CSS injection script (Base64 encoded with DOM ready check)
     */
    private String buildCSSInjectionScript(String cssContent) {
        try {
            byte[] cssBytes = cssContent.getBytes(StandardCharsets.UTF_8);
            String base64CSS = Base64.encodeToString(cssBytes, Base64.NO_WRAP);
            
            return "(function() {" +
                   "  function inject() {" +
                   "    try {" +
                   "      var target = document.head || document.getElementsByTagName('head')[0] || document.documentElement;" +
                   "      if (!target) {" +
                   "        console.warn('[CSSInjector] DOM not ready for CDN CSS, retrying...');" +
                   "        setTimeout(inject, 100);" +
                   "        return;" +
                   "      }" +
                   "      if (!document.getElementById('cdn-styles')) {" +
                   "        var b64 = '" + base64CSS + "';" +
                   "        var css = decodeURIComponent(escape(atob(b64)));" +
                   "        var s = document.createElement('style');" +
                   "        s.id = 'cdn-styles';" +
                   "        s.textContent = css;" +
                   "        target.appendChild(s);" +
                   "        console.log('[CSSInjector] CDN CSS loaded');" +
                   "      }" +
                   "    } catch(e) { console.error('[CSSInjector] CDN CSS failed:', e); }" +
                   "  }" +
                   "  if (document.readyState === 'loading') {" +
                   "    document.addEventListener('DOMContentLoaded', inject);" +
                   "  } else {" +
                   "    inject();" +
                   "  }" +
                   "})();";
        } catch (Exception e) {
            android.util.Log.e(TAG, "Base64 encode failed", e);
            return buildFallbackInjectionScript(cssContent);
        }
    }

    /**
     * Fallback injection (manual escaping with DOM ready check)
     */
    private String buildFallbackInjectionScript(String cssContent) {
        String escaped = cssContent
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "")
            .replace("\t", "\\t");
        
        return "(function() {" +
               "  function inject() {" +
               "    try {" +
               "      var target = document.head || document.getElementsByTagName('head')[0] || document.documentElement;" +
               "      if (!target) {" +
               "        setTimeout(inject, 100);" +
               "        return;" +
               "      }" +
               "      if (!document.getElementById('cdn-styles')) {" +
               "        var s = document.createElement('style');" +
               "        s.id = 'cdn-styles';" +
               "        s.textContent = '" + escaped + "';" +
               "        target.appendChild(s);" +
               "        console.log('[CSSInjector] CDN CSS loaded (escaped)');" +
               "      }" +
               "    } catch(e) { console.error('[CSSInjector] CDN CSS failed:', e); }" +
               "  }" +
               "  if (document.readyState === 'loading') {" +
               "    document.addEventListener('DOMContentLoaded', inject);" +
               "  } else {" +
               "    inject();" +
               "  }" +
               "})();";
    }
}
