import Foundation
import WebKit
import UIKit

@objc(CSSInjector)
class CSSInjector: CDVPlugin {
    
    private static let CSS_FILE_PATH = "www/assets/cdn-styles.css"
    private static let CONFIG_FILE_PATH = "www/cordova-build-config.json"
    private var cachedCSS: String?
    private var cachedConfig: [String: Any]?
    
    override func pluginInitialize() {
        super.pluginInitialize()
        
        // Read WEBVIEW_BACKGROUND_COLOR from preferences (with fallbacks)
        var bgColor: String?
        if let color = self.commandDelegate.settings["webview_background_color"] as? String {
            bgColor = color
        } else if let color = self.commandDelegate.settings["backgroundcolor"] as? String {
            bgColor = color
        } else if let color = self.commandDelegate.settings["splashscreenbackgroundcolor"] as? String {
            bgColor = color
        }
        
        if let color = bgColor {
            setWebViewBackgroundColor(colorString: color)
            injectBackgroundColorCSS(colorString: color)
        }
        
        // Pre-load CSS and config
        cachedCSS = readCSSFromBundle()
        cachedConfig = readConfigFromBundle()
        
        // Inject config, CSS after a short delay to ensure WebView is ready
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.injectBuildConfig()  // Inject config first
            self.injectCSSIntoWebView()
        }
        
        print("[CSSInjector] Plugin initialized")
    }
    
    @objc(injectCSS:)
    func injectCSS(command: CDVInvokedUrlCommand) {
        injectCSSIntoWebView()
        
        let pluginResult = CDVPluginResult(
            status: CDVCommandStatus_OK,
            messageAs: "CSS injected"
        )
        self.commandDelegate.send(pluginResult, callbackId: command.callbackId)
    }
    
    @objc(getConfig:)
    func getConfig(command: CDVInvokedUrlCommand) {
        var config = cachedConfig
        if config == nil {
            config = readConfigFromBundle()
            cachedConfig = config
        }
        
        if let configDict = config {
            let pluginResult = CDVPluginResult(
                status: CDVCommandStatus_OK,
                messageAs: configDict
            )
            self.commandDelegate.send(pluginResult, callbackId: command.callbackId)
        } else {
            let pluginResult = CDVPluginResult(
                status: CDVCommandStatus_ERROR,
                messageAs: "Config not available"
            )
            self.commandDelegate.send(pluginResult, callbackId: command.callbackId)
        }
    }
    
    // MARK: - Build Config Injection
    
    /**
     * Read config JSON from bundle
     */
    private func readConfigFromBundle() -> [String: Any]? {
        guard let bundlePath = Bundle.main.path(forResource: "www", ofType: nil) else {
            print("[CSSInjector] www bundle path not found")
            return nil
        }
        
        let configPath = (bundlePath as NSString).appendingPathComponent("cordova-build-config.json")
        
        do {
            let jsonData = try Data(contentsOf: URL(fileURLWithPath: configPath))
            let config = try JSONSerialization.jsonObject(with: jsonData, options: []) as? [String: Any]
            return config
        } catch {
            print("[CSSInjector] Failed to read config: \(error.localizedDescription)")
            return nil
        }
    }
    
    /**
     * Inject build config into window
     */
    private func injectBuildConfig() {
        DispatchQueue.main.async {
            guard let wkWebView = self.webView as? WKWebView else {
                print("[CSSInjector] WKWebView not available for config injection")
                return
            }
            
            var config = self.cachedConfig
            if config == nil {
                config = self.readConfigFromBundle()
                self.cachedConfig = config
            }
            
            guard var configDict = config else {
                print("[CSSInjector] No config found, skipping injection")
                return
            }
            
            // Add background color if available
            if let bgColor = self.commandDelegate.settings["webview_background_color"] as? String {
                configDict["backgroundColor"] = bgColor
            } else if let bgColor = self.commandDelegate.settings["backgroundcolor"] as? String {
                configDict["backgroundColor"] = bgColor
            }
            
            // Convert to JSON string
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: configDict, options: [])
                if let jsonString = String(data: jsonData, encoding: .utf8) {
                    let escapedJSON = jsonString
                        .replacingOccurrences(of: "\\", with: "\\\\")
                        .replacingOccurrences(of: "'", with: "\\'")
                        .replacingOccurrences(of: "\"", with: "\\\"")
                        .replacingOccurrences(of: "\n", with: "\\n")
                    
                    let javascript = """
                    (function() {
                        try {
                            var config = JSON.parse("\(escapedJSON)");
                            window.CORDOVA_BUILD_CONFIG = config;
                            window.AppConfig = config;
                            console.log('[Native iOS] Build config injected:', config);
                            
                            if (typeof CustomEvent !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('cordova-config-ready', { detail: config }));
                            }
                        } catch(e) {
                            console.error('[Native iOS] Config injection failed:', e);
                        }
                    })();
                    """
                    
                    wkWebView.evaluateJavaScript(javascript) { (_, error) in
                        if let error = error {
                            print("[CSSInjector] Failed to inject config: \(error.localizedDescription)")
                        } else {
                            print("[CSSInjector] Build config injected successfully")
                        }
                    }
                }
            } catch {
                print("[CSSInjector] Failed to serialize config: \(error.localizedDescription)")
            }
        }
    }
    
    // MARK: - WebView Background Color
    
    /**
     * Set WebView background color to prevent white flash
     */
    private func setWebViewBackgroundColor(colorString: String) {
        DispatchQueue.main.async {
            guard let webView = self.webView as? WKWebView else {
                print("[CSSInjector] WebView not available for background color")
                return
            }
            
            // Parse hex color
            if let color = self.hexStringToUIColor(hex: colorString) {
                webView.backgroundColor = color
                webView.isOpaque = false
                webView.scrollView.backgroundColor = color
                print("[CSSInjector] WebView background set to: \(colorString)")
            } else {
                // Fallback to clear
                webView.backgroundColor = .clear
                webView.isOpaque = false
                print("[CSSInjector] Invalid color format, using clear: \(colorString)")
            }
        }
    }
    
    /**
     * Inject background color CSS into WebView at runtime
     */
    private func injectBackgroundColorCSS(colorString: String) {
        DispatchQueue.main.async {
            guard let wkWebView = self.webView as? WKWebView else {
                print("[CSSInjector] WKWebView not available for background CSS injection")
                return
            }
            
            let css = "html, body { background-color: \(colorString) !important; margin: 0; padding: 0; }"
            let escapedCSS = css.replacingOccurrences(of: "'", with: "\\'")
            let javascript = """
            (function() {
                try {
                    var existingStyle = document.getElementById('cordova-plugin-webview-bg');
                    if (existingStyle) { existingStyle.remove(); }
                    var style = document.createElement('style');
                    style.id = 'cordova-plugin-webview-bg';
                    style.textContent = '\(escapedCSS)';
                    (document.head || document.documentElement).appendChild(style);
                    console.log('Background CSS injected: \(colorString)');
                } catch(e) {
                    console.error('Background CSS injection failed:', e);
                }
            })();
            """
            
            wkWebView.evaluateJavaScript(javascript) { (_, error) in
                if let error = error {
                    print("[CSSInjector] Failed to inject background CSS: \(error.localizedDescription)")
                } else {
                    print("[CSSInjector] Background color CSS injected: \(colorString)")
                }
            }
        }
    }
    
    /**
     * Convert hex string to UIColor
     */
    private func hexStringToUIColor(hex: String) -> UIColor? {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        var rgb: UInt64 = 0
        
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
            return nil
        }
        
        let length = hexSanitized.count
        
        if length == 6 {
            let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
            let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
            let b = CGFloat(rgb & 0x0000FF) / 255.0
            return UIColor(red: r, green: g, blue: b, alpha: 1.0)
        } else if length == 8 {
            let r = CGFloat((rgb & 0xFF000000) >> 24) / 255.0
            let g = CGFloat((rgb & 0x00FF0000) >> 16) / 255.0
            let b = CGFloat((rgb & 0x0000FF00) >> 8) / 255.0
            let a = CGFloat(rgb & 0x000000FF) / 255.0
            return UIColor(red: r, green: g, blue: b, alpha: a)
        }
        
        return nil
    }
    
    // MARK: - CSS Injection
    
    /**
     * Read CSS from file and inject into WebView
     */
    private func injectCSSIntoWebView() {
        DispatchQueue.main.async {
            // Use cached CSS or read from bundle
            var cssContent = self.cachedCSS
            if cssContent == nil || cssContent!.isEmpty {
                cssContent = self.readCSSFromBundle()
                self.cachedCSS = cssContent
            }
            
            guard let css = cssContent, !css.isEmpty else {
                print("[CSSInjector] CSS file not found or empty")
                return
            }
            
            guard let wkWebView = self.webView as? WKWebView else {
                print("[CSSInjector] WKWebView not available")
                return
            }
            
            let javascript = self.buildCSSInjectionScript(cssContent: css)
            
            wkWebView.evaluateJavaScript(javascript) { (result, error) in
                if let error = error {
                    print("[CSSInjector] Failed to inject CSS: \(error.localizedDescription)")
                } else {
                    print("[CSSInjector] CSS injected successfully (\(css.count) bytes)")
                }
            }
        }
    }
    
    /**
     * Read CSS content from bundle www/assets/cdn-styles.css with UTF-8 encoding
     */
    private func readCSSFromBundle() -> String? {
        guard let bundlePath = Bundle.main.path(forResource: "www", ofType: nil) else {
            print("[CSSInjector] www bundle path not found")
            return nil
        }
        
        let cssPath = (bundlePath as NSString).appendingPathComponent("assets/cdn-styles.css")
        
        do {
            let cssContent = try String(contentsOfFile: cssPath, encoding: .utf8)
            return cssContent
        } catch {
            print("[CSSInjector] Failed to read CSS file: \(error.localizedDescription)")
            return nil
        }
    }
    
    /**
     * Build JavaScript code to inject CSS into page
     */
    private func buildCSSInjectionScript(cssContent: String) -> String {
        // Try Base64 encoding first (safest method)
        if let base64CSS = encodeToBase64(cssContent: cssContent) {
            return """
            (function() {
                try {
                    if (!document.getElementById('cdn-injected-styles')) {
                        var base64CSS = '\(base64CSS)';
                        var decodedCSS = decodeURIComponent(escape(atob(base64CSS)));
                        var style = document.createElement('style');
                        style.id = 'cdn-injected-styles';
                        style.textContent = decodedCSS;
                        (document.head || document.documentElement).appendChild(style);
                        console.log('CSS injected by native code (Base64)');
                    }
                } catch(e) {
                    console.error('CSS injection failed:', e);
                }
            })();
            """
        } else {
            // Fallback: Use manual escaping if Base64 fails
            return buildFallbackInjectionScript(cssContent: cssContent)
        }
    }
    
    /**
     * Encode CSS content to Base64
     */
    private func encodeToBase64(cssContent: String) -> String? {
        guard let data = cssContent.data(using: .utf8) else {
            print("[CSSInjector] Failed to encode CSS to UTF-8")
            return nil
        }
        
        return data.base64EncodedString(options: [])
    }
    
    /**
     * Fallback method using manual escaping
     */
    private func buildFallbackInjectionScript(cssContent: String) -> String {
        // Escape CSS content for use in JavaScript string
        let escapedCSS = cssContent
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "")
            .replacingOccurrences(of: "\t", with: "\\t")
        
        return """
        (function() {
            try {
                if (!document.getElementById('cdn-injected-styles')) {
                    var style = document.createElement('style');
                    style.id = 'cdn-injected-styles';
                    style.textContent = '\(escapedCSS)';
                    (document.head || document.documentElement).appendChild(style);
                    console.log('CSS injected by native code (escaped)');
                }
            } catch(e) {
                console.error('CSS injection failed:', e);
            }
        })();
        """
    }
}
