import Foundation
import WebKit

@objc(CSSInjector)
class CSSInjector: CDVPlugin, WKNavigationDelegate {
    
    private static let CSS_FILE_PATH = "www/assets/cdn-styles.css"
    private var cachedCSS: String?
    
    override func pluginInitialize() {
        super.pluginInitialize()
        
        // Pre-load CSS content
        cachedCSS = readCSSFromBundle()
        
        // Set up navigation delegate for WKWebView
        setupWebViewDelegate()
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
    
    /**
     * Setup WKNavigationDelegate to inject CSS on page load
     */
    private func setupWebViewDelegate() {
        DispatchQueue.main.async {
            if let wkWebView = self.webView as? WKWebView {
                wkWebView.navigationDelegate = self
                print("[CSSInjector] WKNavigationDelegate configured")
            } else if let uiWebView = self.webView as? UIWebView {
                // UIWebView doesn't have navigation delegate
                // Inject immediately for UIWebView
                self.injectCSSIntoWebView()
                print("[CSSInjector] UIWebView detected, CSS injected immediately")
            }
        }
    }
    
    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Inject CSS when page finishes loading
        injectCSSIntoWebView()
        print("[CSSInjector] CSS injected on page finished")
    }
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        print("[CSSInjector] Page started loading")
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("[CSSInjector] Page load failed: \(error.localizedDescription)")
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
            
            guard let webView = self.webView else {
                print("[CSSInjector] WebView not available")
                return
            }
            
            let javascript = self.buildCSSInjectionScript(cssContent: css)
            
            if let wkWebView = webView as? WKWebView {
                // WKWebView
                wkWebView.evaluateJavaScript(javascript) { (result, error) in
                    if let error = error {
                        print("[CSSInjector] Failed to inject CSS: \(error.localizedDescription)")
                    } else {
                        print("[CSSInjector] CSS injected successfully (\(css.count) bytes)")
                    }
                }
            } else if let uiWebView = webView as? UIWebView {
                // UIWebView (deprecated but still supported)
                uiWebView.stringByEvaluatingJavaScript(from: javascript)
                print("[CSSInjector] CSS injected successfully (\(css.count) bytes)")
            }
        }
    }
    
    /**
     * Read CSS content from bundle www/assets/cdn-styles.css with UTF-8 encoding
     */
    private func readCSSFromBundle() -> String? {
        guard let bundlePath = Bundle.main.path(forResource: "www", ofType: nil),
              let cssPath = (bundlePath as NSString).appendingPathComponent("assets/cdn-styles.css") as String? else {
            print("[CSSInjector] CSS file path not found")
            return nil
        }
        
        do {
            // Read with UTF-8 encoding to handle Unicode characters properly
            let cssContent = try String(contentsOfFile: cssPath, encoding: .utf8)
            return cssContent
        } catch {
            print("[CSSInjector] Failed to read CSS file: \(error.localizedDescription)")
            return nil
        }
    }
    
    /**
     * Build JavaScript code to inject CSS into page
     * Uses Base64 encoding to safely transfer CSS content
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
     * Fallback method using manual escaping (if Base64 encoding fails)
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
        
        // JavaScript to inject CSS
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
