import Foundation
import WebKit

@objc(CSSInjector)
class CSSInjector: CDVPlugin {
    
    private static let CSS_FILE_PATH = "www/assets/cdn-styles.css"
    
    override func pluginInitialize() {
        super.pluginInitialize()
        injectCSSIntoWebView()
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
     * Read CSS from file and inject into WebView
     */
    private func injectCSSIntoWebView() {
        DispatchQueue.main.async {
            guard let cssContent = self.readCSSFromBundle() else {
                print("[CSSInjector] CSS file not found or empty")
                return
            }
            
            guard let webView = self.webView else {
                print("[CSSInjector] WebView not available")
                return
            }
            
            let javascript = self.buildCSSInjectionScript(cssContent: cssContent)
            
            if let wkWebView = webView as? WKWebView {
                // WKWebView
                wkWebView.evaluateJavaScript(javascript) { (result, error) in
                    if let error = error {
                        print("[CSSInjector] Failed to inject CSS: \(error.localizedDescription)")
                    } else {
                        print("[CSSInjector] CSS injected successfully (\(cssContent.count) bytes)")
                    }
                }
            } else if let uiWebView = webView as? UIWebView {
                // UIWebView (deprecated but still supported)
                uiWebView.stringByEvaluatingJavaScript(from: javascript)
                print("[CSSInjector] CSS injected successfully (\(cssContent.count) bytes)")
            }
        }
    }
    
    /**
     * Read CSS content from bundle www/assets/cdn-styles.css
     */
    private func readCSSFromBundle() -> String? {
        guard let bundlePath = Bundle.main.path(forResource: "www", ofType: nil),
              let cssPath = (bundlePath as NSString).appendingPathComponent("assets/cdn-styles.css") as String? else {
            print("[CSSInjector] CSS file path not found")
            return nil
        }
        
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
        // Escape CSS content for use in JavaScript string
        let escapedCSS = cssContent
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "")
        
        // JavaScript to inject CSS
        return """
        (function() {
            if (!document.getElementById('cdn-injected-styles')) {
                var style = document.createElement('style');
                style.id = 'cdn-injected-styles';
                style.textContent = '\(escapedCSS)';
                document.head.appendChild(style);
                console.log('CSS injected by native code');
            }
        })();
        """
    }
}
